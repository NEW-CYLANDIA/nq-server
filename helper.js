require('dotenv').config()

const PublicGoogleSheetsParser = require('public-google-sheets-parser')
const spreadsheetId = process.env.GSHEET_ID
const parser = new PublicGoogleSheetsParser(spreadsheetId)

// Importing 'crypto' module
const crypto = require('crypto'), hash = crypto.getHashes();

exports.bridgeData = {}

// TODO - dump/insert bridge data to db on server start?
parser.parse().then(data => {
    data.forEach((item) => {
        if (item.impact_keys) {
            item.impact_keys = item.impact_keys.split(",")
        }

        exports.bridgeData[item.id] = item
    })
})

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

// TODO update to use db
// exports.getUserData = (device_uid) => {
//     let data = []

//     for (const [key, value] of Object.entries(exports.clientData)) {
//         data.push([
//             key,
//             "blah",
//             connectedUids.includes(key)
//         ])
//     }

//     return JSON.stringify(data)
// }

// exports.getAllUserData = (connectedUids) => {
//     let data = []

//     for (const [key, value] of Object.entries(exports.clientData)) {
//         data.push([
//             key,
//             "blah",
//             connectedUids.includes(key)
//         ])
//     }

//     return JSON.stringify(data)
// }