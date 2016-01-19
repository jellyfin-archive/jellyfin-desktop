require(['playbackManager', 'events'], function (playbackManager, events) {

    events.on(playbackManager, "playbackstart", function () {
        if (playbackManager.isPlayingVideo()) {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-on", true);
            xhr.send();
        }
    });
    events.on(playbackManager, "playbackstop", function () {
        if (playbackManager.isPlayingVideo()) {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-off", true);
            xhr.send();
        }
    });
});