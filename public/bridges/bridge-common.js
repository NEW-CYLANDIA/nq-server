const protocol = window.location.protocol.includes('https') ? 'wss' : 'ws'
window.WS = new WebSocket(`${protocol}://${window.location.host}`);

let sessionHash

window.WS.onopen = function (event) {
    // console.log("opened connection")

    // let displayName = prompt("what's your name!")

    var path = window.location.pathname;
    var bridgeId = path.split("/").pop().replace(".html", "");

    window.WS.send(JSON.stringify({
        "type": "handshake",
        "id": bridgeId,
        "uid": localStorage.getItem("nquid"),
        // "displayName": displayName
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
        // "id": bridgeId,
        "session_hash": sessionHash,
        "uid": localStorage.getItem("nquid"),
        // "displayName": displayName
    }));
}