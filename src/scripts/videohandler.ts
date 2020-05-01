((require as unknown) as typeof define)(["playbackManager", "events"], function (playbackManager, events) {
    let videoOn;

    events.on(playbackManager, "playbackstart", () => {
        if (playbackManager.isPlayingVideo()) {
            videoOn = true;
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-on", true);
            xhr.send();
        }
    });

    events.on(playbackManager, "playbackstop", () => {
        if (videoOn) {
            videoOn = false;
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-off", true);
            xhr.send();
        }
    });

    function sendCommand(name): void {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `electronapphost://${name}`, true);

        xhr.send();
    }

    sendCommand("loaded");
});
