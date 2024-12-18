require('dotenv').config()

const PublicGoogleSheetsParser = require('public-google-sheets-parser')
const spreadsheetId = process.env.GSHEET_ID
const parser = new PublicGoogleSheetsParser(spreadsheetId)

// Importing 'crypto' module
const crypto = require('crypto'), hash = crypto.getHashes();

const { uniqueNamesGenerator, colors, animals, names, NumberDictionary } = require('unique-names-generator');
const sleepAdjectives = require('./adjectives.json')

const db = require('./db');

exports.getSessionId = () => {
    const now = new Date()

    return now.getHours() + "-" + (now.getMinutes() >= 30 ? "halfpast" : "zero")
}

exports.getUniqueId = () => {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
}

exports.getSessionHash = () => {
    // Create hash of SHA1 type
    x = exports.getSessionId()

    // 'digest' is the output 
    // of hash function containing
    // only hexadecimal digits
    hashPwd = crypto.createHash('sha1')
        .update(x).digest('hex');

    return hashPwd
}

exports.generateDisplayName = () => {
    const numberDictionary = NumberDictionary.generate({ min: 69, max: 420 });
    const dictOptions = [
        [sleepAdjectives, animals, numberDictionary],
        [colors, animals, numberDictionary],
        [sleepAdjectives, names, numberDictionary]
    ]

    let randomName = uniqueNamesGenerator({
        dictionaries: dictOptions[Math.floor(Math.random() * dictOptions.length)],
        style: Math.random() > 0.5 ? "capital" : "lowerCase",
        separator: ""
    })

    if (Math.random() < 0.1) {
        randomName = randomName.replace(/[a-z]/gi, c => c[`to${randomName ? 'Upp' : 'Low'}erCase`](randomName = !randomName))
    }

    return randomName
}

exports.dbCreatePlayer = async () => {
    const uid = exports.getUniqueId();
    console.log(uid)
    const displayName = exports.generateDisplayName()

    await db.query('INSERT INTO users (device_uid, display_name) VALUES ($1, $2)', [uid, displayName])

    return uid
}

exports.dbGetPlayerName = async (uid) => {
    try {
        let result = await db.query(`select display_name from users where device_uid = $1`, [uid])

        return result.rows[0].display_name
    } catch (err) {
        console.log(err)
        return exports.generateDisplayName()
    }
}

exports.dbGetChatMessage = async (url_part) => {
    let result = await db.query(`select chat_message from dreams where url_part = $1`, [url_part])

    return result.rows[0].chat_message
}

// TODO why is event logging ever throwing errors
exports.dbLogEvent = async (uid, session_hash, data) => {
    try {
        await db.query(
            'INSERT INTO events (device_uid, session_hash, type, impact_key, currency_value, dream_url_part) VALUES ($1, $2, $3, $4, $5, $6)',
            [uid, session_hash, data.type, data.key || null, data.value || null, data.dream_url_part || null]
        )
    } catch (err) {
        console.log(err)
    }
    
}

exports.dbSyncDreamTable = async () => {
    const fs = require('fs');
    const oldEvents = await db.query('select * from events')

    if (oldEvents.rowCount > 0) {
        fs.writeFile(`events-old_${Date.now()}.json`, JSON.stringify(oldEvents.rows), (err) => {
            if (err) throw err
            console.log("events-old.json written")
        })
    }

    var QRCode = require('qrcode')

    QRCode.toFile(
        `qr/quinton.png`,
        `https://dreamscape-explorer.app/quinton.wav`,
        {
            color: {
                dark: "#a50997",
                light: "#f4d4b1"
            }
        },
        function (err) {
            if (err) throw err
        }
    )

    // drop outdated rows
    await db.query('DELETE FROM events')
    await db.query('DELETE FROM dreams')

    const authorIds = (await db.query('select id, name from creators order by id asc')).rows.map((row)=> {
        return row.name
    })

    const dirs = [
        "bitsy/",
        "twine/",
        "puzzlescript/",
        "downpour/"
    ]

    const extensions = [
        "bitsy",
        "twee",
        "ps",
        "json"
    ]

    let testEntryCreated = false

    for (let dirIndex in dirs) {
        fs.readdir(`public/bridges/src/${dirs[dirIndex]}`, function (err, files) {
            if (err) {
                console.error("Could not list the directory.", err);
                process.exit(1);
            }

            files.forEach(async function (file, index) {
                if (file.indexOf(`.${extensions[dirIndex]}`) == -1) return

                let url_part = file.split('.')[0]

                if (url_part.includes("TEST_") || url_part == "editor") {
                    url_part = "debug"
                }

                let author
                let title

                try {
                    const dreamSrc = fs.readFileSync(`public/bridges/src/${dirs[dirIndex]}/${file}`, 'utf8');

                    switch (extensions[dirIndex]) {
                        case "bitsy":
                            title = dreamSrc.match(`(})(.*?)({)`)[0]
                            title = title.substring(
                                title.indexOf("}") + 1,
                                title.lastIndexOf("{")
                            )
                            let authorStart = dreamSrc.substring(dreamSrc.indexOf("by ") + 3)
                            author = authorStart.split("\n")[0]
                            break
                        case "twee":
                            title = dreamSrc.split('\n')[1]
                            let storyData = dreamSrc.substring(
                                dreamSrc.indexOf("{"),
                                dreamSrc.indexOf("}") + 1
                            )
                            storyData = JSON.parse(storyData)
                            author = storyData.author
                            break
                        case "ps":
                            title = dreamSrc.split('\n')[0].replace("title ", "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
                            author = dreamSrc.split('\n')[1].replace("author ", "").replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
                            break
                        case "json":
                            let json = JSON.parse(dreamSrc)
                            title = json.name
                            author = json.author
                            break
                    }

                    if (url_part == "debug") {
                        title = "test"
                        author = "izzy kestrel"

                        if (testEntryCreated) return
                        testEntryCreated = true
                    }

                    QRCode.toFile(
                        `qr/${url_part}.png`,
                        `https://dreamscape-explorer.app/bridges/${url_part}.html`,
                        {
                            color: {
                                dark: "#a50997",
                                light: "#f4d4b1"
                            }
                        },
                        function (err) {
                            if (err) throw err
                        }
                    )

                    await db.query('insert into dreams (url_part, creator_id, title, chat_message) values ($1, $2, $3, $4)', [url_part, authorIds.indexOf(author) + 1, title, "this is a placeholder message! replace me! @~@"])
                } catch (err) {
                    console.error(err);
                }
            });
        });
    }
}
