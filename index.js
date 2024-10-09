'use strict';

require('dotenv').config()

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

// const logger = require('pino')();

// logger.info('Hello from Pino logger');

logtail.error("Something bad happend.");
logtail.info("Log message with structured data.", {
	item: "Orange Soda",
	price: 100.00
});

// Ensure that all logs are sent to Logtail
logtail.flush()


let conns = {
	'cyberspace': null
}
let logMsgs = []
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

server.logMessage = (level, msg, uid) => {
	const LOGLEVEL = [
		"ℹ️ INFO",
		"⚠️ WARNING",
		"❌ ERROR"
	]

	let timestamp = new Date()

	console.log(`${timestamp} - ${LOGLEVEL[level]} - ${msg}`)

	logMsgs.push([
		timestamp,
		LOGLEVEL[level],
		msg,
		uid
	])
}

server.on('connection', function (client) {
	client.on('message', function (data) {
		try {
			data = JSON.parse(data)
		}
		catch {
			console.log("invalid JSON, ignoring message: " + data);
			return
		}

		if (debug && data.cmd) {
			let returnData = {
				"cmd": data.cmd,
				"payload": ""
			}

			switch (data.cmd) {
				case "listclients":
					returnData.payload = nqHelper.getClientDataFormatted(
						server.getConnectedClients()
					)
					break;
				default:
					client.send("invalid cmd")
			}

			client.send(JSON.stringify(returnData))

			return
		}

		if (data.handshake) {
			if (Object.keys(conns).includes(data.type)) {
				conns[data.type] = client
			}

			if (data.uid) {
				client.uid = data.uid
			}
			else {
				client.uid = nqHelper.getUniqueId();
			}
			client.sessionId = nqHelper.getSessionId();

			server.logMessage(0, 'client connected', client.uid)
			client.send(JSON.stringify({
				"uid": client.uid
			}))

			if (data.type == "bridge") {
				if (conns.cyberspace) {
					conns.cyberspace.send(JSON.stringify({
						"uid": client.uid
					}))
				}
			}

			return
		}

		if (!conns.cyberspace) {
			server.logMessage(1, 'message recieved, but no main connection available for routing', client.uid)
			return
		}

		if (!server.isClientConnected(client.uid)) {
			server.logMessage(1, 'message recieved from unknown client', null)
			return
		}

		if (data.impact) {
			if (client.sessionId != nqHelper.getSessionId()) {
				server.logMessage(1, 'impact sent from expired session, closing bridge', client.uid)
				client.close()
				return
			}

			conns.cyberspace.send(JSON.stringify(data))
			server.logMessage(0, `impact requested: ${data.impact}`, client.uid)
		}
	})

	client.on('close', function () {
		server.logMessage(0, 'client disconnected', client.uid)

		if (client == conns.cyberspace) {
			conns.cyberspace = null
		}
	});
});

expressServer.listen(8080, function () {
	console.log('Listening on http://0.0.0.0:8080');

	debug = server.address().address == "::"
});