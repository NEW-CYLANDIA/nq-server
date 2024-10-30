'use strict';

require('dotenv').config()

const os = require("os")

// const pg = require('pg');
// const { Client } = pg
const db = require('./db');

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

app.get('/found_dreams', async (req, res) => {
	try {
		const result = await db.query(`
			select
				d.url_part,
				d.title,
				c.name as creator_name,
				c.website_url
			FROM
				dreams d
			LEFT JOIN
				creators c ON d.creator_id = c.id
			where 
				d.url_part in (
					SELECT
						e.dream_url_part 
					FROM
						events e 
					where
						e.device_uid = $1
						and e.type = 'handshake'
				)
		`, [req.query.nquid]);
		res.json(result.rows);
	} catch (err) {
		console.error(err);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/new_player', async (req, res) => {
	try {
		const uid = await nqHelper.dbCreatePlayer()
		res.json({uid: uid});
	} catch (err) {
		console.error(err);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/get_display_name', async (req, res) => {
	try {
		const result = await db.query(`select display_name from users where device_uid = $1`, [req.query.nquid]);
		res.json({ display_name: result.rows[0].display_name });
	} catch (err) {
		console.error(err);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/get_currency', async (req, res) => {
	try {
		const result = await db.query(`select currency from users where device_uid = $1`, [req.query.nquid]);
		res.json({ currency: result.rows[0].currency });
	} catch (err) {
		console.error(err);
		res.status(500).send('Internal Server Error');
	}
});

app.get('/set_display_name', async (req, res) => {
	try {
		const newDisplayName = nqHelper.generateDisplayName()

		const result = await db.query(`update users set display_name = $1 where device_uid = $2`, [newDisplayName, req.query.nquid]);
		res.json({ display_name: newDisplayName });
	} catch (err) {
		console.error(err);
		res.status(500).send('Internal Server Error');
	}
});

// app.get('/progress', async (req, res) => {
// 	try {
// 		console.log(req.query.nquid)

// 		const result = await db.query(`
// 			SELECT
// 				e.dream_id 
// 			FROM
// 				events e 
// 			where
// 				e.device_uid = $1
// 				and e.type = 'handshake'
// 		`, [req.query.nquid]);
// 		res.json(result.rows);
// 	} catch (err) {
// 		console.error(err);
// 		res.status(500).send('Internal Server Error');
// 	}
// });

logtail.debug({ msg: "SERVER UP" })
logtail.flush()

let uniqueConns = {
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
			session_hash: client.sessionHash
		}

		if (data) {
			obj.data = data
		}

		return obj
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

		let currentSessionHash = nqHelper.getSessionHash()

		switch (data.type) {
			case "registerUnique":
				if (Object.keys(uniqueConns).includes(data.id)) {
					uniqueConns[data.id] = client

					client.send(JSON.stringify({"session_hash": currentSessionHash}))
				}
				break;
			case "handshake":
				if (data.uid) {
					client.uid = data.uid
				}
				else {
					client.uid = nqHelper.dbCreatePlayer()
				}

				if (data.session_hash) {
					if (data.session_hash != currentSessionHash) {
						client.log_warn('client handshake attempted with expired session, closing connection', data)
						client.close()
						return
					}
				}

				client.sessionHash = currentSessionHash;

				let connectData = {
					"uid": client.uid,
					"session_hash": client.sessionHash
				}

				client.send(JSON.stringify(connectData))

				if (uniqueConns.cyberspace) {
					uniqueConns.cyberspace.send(JSON.stringify(connectData))
				}

				client.log_info('client connected', connectData)

				break
			case "impact":
				if (client.sessionHash != nqHelper.getSessionHash()) {
					client.log_warn('impact sent from expired session, closing connection', data)
					client.close()
					return
				}

				if (uniqueConns.cyberspace) {
					uniqueConns.cyberspace.send(JSON.stringify(data))
				}

				client.log_info(`impact requested: ${data.key}`, data)

				break
			case "currency":
				if (!data.value) {
					client.log_error('no value set for currency operation', data)
					return
				}

				db.query('UPDATE users SET currency = currency + $1 WHERE device_uid = $2', [data.value, client.uid])

				break
		}

		nqHelper.dbLogEvent(client.uid, client.sessionHash, data)

		// Ensure that all logs are sent to Logtail
		logtail.flush()
	})

	client.on('close', function () {
		client.log_info('client disconnected')

		if (client == uniqueConns.cyberspace) {
			uniqueConns.cyberspace = null
		}

		// Ensure that all logs are sent to Logtail
		logtail.flush()
	});
});

expressServer.listen(process.env.PORT || 8080, function () {
	console.log('Listening on ' + os.hostname());
	console.log(server.address())

	debug = server.address().address == "::"
});