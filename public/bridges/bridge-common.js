const protocol = window.location.protocol.includes('https') ? 'wss' : 'ws'
window.WS = new WebSocket(`${protocol}://${window.location.host}`);

window.WS.onopen = function (event) {
    // console.log("opened connection")

    // let displayName = prompt("what's your name!")

    var path = window.location.pathname;
    var bridgeId = path.split("/").pop().replace(".html", "");

    window.WS.send(JSON.stringify({
        "handshake": true,
        "type": "bridge",
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
}