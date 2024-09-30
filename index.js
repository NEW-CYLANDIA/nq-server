'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');

const nqHelper = require('./helper')

const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const server = createServer(app);
const wss = new WebSocket.Server({ server });

let conns = {
	'cyberspace': null
}
let logMsgs = []
let debug = false

wss.getConnectedClients = () => {
	let uids = []

	wss.clients.forEach(function each(client) {
		uids.push(client.uid)
	})

	return uids
}

wss.isClientConnected = (uid) => {
	var connected = false

	wss.clients.forEach(function each(client) {
		if (client.uid == uid) {
			connected = true
		}
	})

	return connected
}

wss.logMessage = (level, msg, uid) => {
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

wss.on('connection', function (ws) {
	ws.on('message', function (data) {
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
						wss.getConnectedClients()
					)
					break;
				default:
					ws.send("invalid cmd")
			}

			ws.send(JSON.stringify(returnData))

			return
		}

		if (data.handshake) {
			if (Object.keys(conns).includes(data.type)) {
				conns[data.type] = ws
			}

			if (data.uid) {
				ws.uid = data.uid
			}
			else {
				ws.uid = nqHelper.getUniqueId();
			}
			ws.sessionId = nqHelper.getSessionId();

			wss.logMessage(0, 'client connected', ws.uid)
			// console.log("✅ " + ws.uid + " connected");
			ws.send(JSON.stringify({
				"uid": ws.uid
			}))

			if (data.type == "bridge") {
				if (conns.cyberspace) {
					conns.cyberspace.send(JSON.stringify({
						"uid": ws.uid
					}))
				}
			}

			return
		}

		if (!conns.cyberspace) {
			wss.logMessage(1, 'message recieved, but no main connection available for routing', ws.uid)
			return
		}

		if (!wss.isClientConnected(ws.uid)) {
			wss.logMessage(1, 'message recieved from unknown client', null)
			return
		}

		if (data.impact) {
			if (ws.sessionId != nqHelper.getSessionId()) {
				wss.logMessage(1, 'impact sent from expired session, closing bridge', ws.uid)
				ws.close()
				return
			}

			conns.cyberspace.send(JSON.stringify(data))
			wss.logMessage(0, `impact requested: ${data.impact}`, ws.uid)
		}
	})

	ws.on('close', function () {
		wss.logMessage(0, 'client disconnected', ws.uid)

		if (ws == conns.cyberspace) {
			conns.cyberspace = null
		}
	});
});

server.listen(8080, function () {
	console.log('Listening on http://0.0.0.0:8080');

	debug = wss.address().address == "::"
});