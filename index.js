'use strict';

require('dotenv').config()

const os = require("os")

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
	function buildLogObj(msg, data) {
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

	async function pgQuery(query, params = []) {
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
		logtail.info(buildLogObj(msg, data))
	}
	client.log_warn = (msg, data = null) => {
		logtail.warn(buildLogObj(msg, data))
	}
	client.log_error = (msg, data = null) => {
		logtail.error(buildLogObj(msg, data))
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

		let currentSessionId = nqHelper.getSessionId()

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
				if (Object.keys(conns).includes(data.id)) {
					conns[data.id] = client
				}

				if (data.uid) {
					client.uid = data.uid
				}
				else {
					client.uid = nqHelper.getUniqueId();

					if (conns.cyberspace != client) {
						pgQuery('INSERT INTO users (device_uid) VALUES ($1)', [client.uid])
					}
				}

				if (data.session_id) {
					if (data.session_id != currentSessionId) {
						client.log_warn('client handshake attempted with expired session, closing connection', data)
						client.close()
						return
					}
				}

				client.sessionId = currentSessionId;

				let connectData = {
					"uid": client.uid,
					"session_id": client.sessionId
				}

				client.send(JSON.stringify(connectData))

				if (conns.cyberspace && conns.cyberspace != client) {
					conns.cyberspace.send(JSON.stringify(connectData))
				}

				client.log_info('client connected', connectData)

				break
			case "impact":
				if (client.sessionId != nqHelper.getSessionId()) {
					client.log_warn('impact sent from expired session, closing connection', data)
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

				pgQuery('UPDATE users SET currency = currency + $1 WHERE device_uid = $2', [data.value, client.uid])

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
	console.log('Listening on ' + os.hostname());
	console.log(server.address())

	debug = server.address().address == "::"
});