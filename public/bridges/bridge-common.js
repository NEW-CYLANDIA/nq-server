const protocol = window.location.protocol.includes('https') ? 'wss' : 'ws'
window.WS = new WebSocket(`${protocol}://${window.location.host}`);

let path = window.location.pathname;
const urlPart = path.split("/").pop().replace(".html", "");

let sessionHash

window.WS.onopen = function (event) {
    window.WS.send(JSON.stringify({
        "type": "handshake",
        "dream_url_part": urlPart,
        "uid": localStorage.getItem("nquid"),
    }));
};

window.WS.onmessage = function (event) {
    if (!event.data || localStorage.getItem("nquid")) { return }

    let data = JSON.parse(event.data)

    if (data.uid) {
        localStorage.setItem("nquid", data.uid)
    }
    if (data.session_hash) {
        sessionHash = data.session_hash
    }
}

function requestImpact(impactKey) {
    window.WS.send(JSON.stringify({
        "type": "impact",
        "session_hash": sessionHash,
        "key": impactKey
    }))
}

function requestCurrency(value) {
    window.WS.send(JSON.stringify({
        "type": "currency",
        "value": value,
        "dream_url_part": urlPart,
        "session_hash": sessionHash,
        "uid": localStorage.getItem("nquid"),
        // "displayName": displayName
    }));
}