'use strict';

require('dotenv').config()

const pg = require('pg');
const { Client } = pg

const { Node: Logtail } = require("@logtail/js");
const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

const express = require('express');
const path = require('path');
const { createServer } = require('http');

const nqHelper = require('./helper')

const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const expressServer = createServer(app);
const server = new WebSocket.Server({ server: expressServer });

logtail.debug({ msg: "SERVER UP" })
logtail.flush()

let conns = {
	'cyberspace': null
}
let debug = false

server.getConnectedClients = () => {
	let uids = []

	server.clients.forEach(function each(client) {
		uids.push(client.uid)
	})

	return uids
}

server.isClientConnected = (uid) => {
	var connected = false

	server.clients.forEach(function each(client) {
		if (client.uid == uid) {
			connected = true
		}
	})

	return connected
}

server.on('connection', function (client) {
	function build_log_obj(msg, data) {
		let obj = {
			uid: client.uid,
			msg: msg,
			session_id: client.sessionId
		}

		if (data) {
			obj.data = data
		}

		return obj
	}

	async function pg_query(query, params = []) {
		const pg_client = new Client()
		await pg_client.connect()

		const res = await pg_client.query(query, params)

		client.log_info('db query sent', {
			query: query,
			params: params,
			result: res
		})

		await pg_client.end()
	}

	client.log_info = (msg, data = null) => {
		logtail.info(build_log_obj(msg, data))
	}
	client.log_warn = (msg, data = null) => {
		logtail.warn(build_log_obj(msg, data))
	}
	client.log_error = (msg, data = null) => {
		logtail.error(build_log_obj(msg, data))
	}

	client.on('message', function (data) {
		try {
			data = JSON.parse(data)
		}
		catch {
			client.log_error("invalid JSON, ignoring message", data);
			return
		}

		if (!server.isClientConnected(client.uid)) {
			client.log_warn('message recieved from unknown client', data)
			return
		}

		switch (data.type) {
			case "debug":
				let returnData = {
					"cmd": data.cmd,
					"payload": ""
				}

				switch (data.cmd) {
					case "listclients":
						returnData.payload = nqHelper.getUserData(
							server.getConnectedClients()
						)
						break;
					default:
						client.send("invalid cmd")
				}

				client.send(JSON.stringify(returnData))

				break
			case "handshake":
				if (Object.keys(conns).includes(data.type)) {
					conns[data.type] = client
				}

				if (data.uid) {
					client.uid = data.uid
				}
				else {
					client.uid = nqHelper.getUniqueId();
					pg_query('INSERT INTO users (device_uid) VALUES ($1)', [client.uid])
				}
				client.sessionId = nqHelper.getSessionId();

				let connect_data = {
					"uid": client.uid,
					"session_id": client.sessionId
				}

				client.send(JSON.stringify(connect_data))

				if (conns.cyberspace) {
					conns.cyberspace.send(JSON.stringify(connect_data))
				}

				client.log_info('client connected', connect_data)

				break
			case "impact":
				if (client.sessionId != nqHelper.getSessionId()) {
					client.log_warn('impact sent from expired session, closing bridge', data)
					client.close()
					return
				}

				if (conns.cyberspace) {
					conns.cyberspace.send(JSON.stringify(data))
				}

				client.log_info(`impact requested: ${data.key}`, data)

				break
			case "currency":
				if (!data.value) {
					client.log_error('no value set for currency operation', data)
					return
				}

				pg_query('UPDATE users SET currency = currency + $1 WHERE device_uid = $2', [data.value, client.uid])

				break
		}

		// Ensure that all logs are sent to Logtail
		logtail.flush()
	})

	client.on('close', function () {
		client.log_info('client disconnected')

		if (client == conns.cyberspace) {
			conns.cyberspace = null
		}

		// Ensure that all logs are sent to Logtail
		logtail.flush()
	});
});

expressServer.listen(8080, function () {
	console.log('Listening on http://0.0.0.0:8080');

	debug = server.address().address == "::"
});