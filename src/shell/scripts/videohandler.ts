require(["playbackManager", "events"], function (playbackManager, events) {
    function sendCommand(name: string, method = "GET"): void {
        fetch(`electronapphost://${name}`, {
            method,
        }).catch(console.error);
    }

    let videoOn: boolean | undefined;

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

    sendCommand("loaded");
});
