'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');

const WebSocket = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, '/public')));

const server = createServer(app);
const wss = new WebSocket.Server({ server });

let mainGameConn = null
let debug = false

wss.getUniqueID = function (type, subtype) {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}
	return type + '-' + subtype + '-' + s4() + s4() + '-' + s4();
};

wss.isClientConnected = function (id) {
	var connected = false

	wss.clients.forEach(function each(client) {
		if (client.id == id) {
			connected = true
		}
	})

	return connected
}

wss.getClientList = function () {
	let ids = []

	wss.clients.forEach(function each(client) {
		ids.push(client.id)
	})

	return JSON.stringify(ids)
}

wss.on('connection', function (ws) {
	console.log("new connection established - awaiting handshake")

	ws.on('message', function(data) {
		try {
			data = JSON.parse(data)
		}
		catch {
			console.log("invalid JSON, ignoring message: " + data);
			return
		}

		if (debug && data.cmd) {
			switch (data.cmd) {
				case "listclients":
					ws.send(wss.getClientList())
					break;
				default:
					console.log(data.cmd)
					ws.send("debug enabled")
			}

			return
		}

		if (data.handshake) {
			if (data.type == "cyberspace") {
				mainGameConn = ws
			}

			ws.id = wss.getUniqueID(data.engine, data.id);
			console.log("✅ " + ws.id + " connected");
			ws.send(JSON.stringify({
				"uid": ws.id
			}))

			return
		}

		if (!mainGameConn) {
			console.log("WARNING - message recieved, but no main connection available for routing")
			return
		}

		if (!wss.isClientConnected(ws.id)) {
			console.log("WARNING - message recieved from unknown client")
			return
		}

		if (data.impact) {
			mainGameConn.send(JSON.stringify(data))
			console.log("impact requested: " + data.impact)
		}
	})  

	ws.on('close', function () {
		console.log("❌ " + ws.id + " disconnected");
	});
});

server.listen(8080, function () {
  console.log('Listening on http://0.0.0.0:8080');

	debug = wss.address().address == "::"
});