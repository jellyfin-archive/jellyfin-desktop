((require as unknown) as typeof define)(["playbackManager", "events"], function (playbackManager, events) {
    let videoOn;

    events.on(playbackManager, "playbackstart", () => {
        if (playbackManager.isPlayingVideo()) {
            videoOn = true;
            sendCommand("video-on", "POST");
        }
    });

    events.on(playbackManager, "playbackstop", () => {
        if (videoOn) {
            videoOn = false;
            sendCommand("video-off", "POST");
        }
    });

    function sendCommand(name: string, method = "GET"): void {
        fetch(`electronapphost://${name}`, {
            method,
        }).catch(console.error);
    }

    sendCommand("loaded");
});
