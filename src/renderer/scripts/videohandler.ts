// tslint:disable-next-line:no-var-requires
requirejs(["playbackManager", "events"], (playbackManager, events) => {
    "use strict";

    let videoOn;

    events.on(playbackManager, "playbackstart", (e, player) => {
        if (playbackManager.isPlayingVideo()) {
            videoOn = true;
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-on", true);
            xhr.send();
        }
    });
    events.on(playbackManager, "playbackstop", (e, stopInfo) => {
        const player = stopInfo.player;
        if (videoOn) {
            videoOn = false;
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-off", true);
            xhr.send();
        }
    });

    function sendCommand(name) {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "electronapphost://" + name, true);

        xhr.send();
    }

    sendCommand("loaded");
});
