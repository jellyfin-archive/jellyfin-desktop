require(['playbackManager', 'events'], function (playbackManager, events) {
    'use strict';

    var videoOn;

    events.on(playbackManager, "playbackstart", function (e, player) {
        if (playbackManager.isPlayingVideo()) {
            videoOn = true;
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-on", true);
            xhr.send();
        }
    });
    events.on(playbackManager, "playbackstop", function (e, stopInfo) {
        var player = stopInfo.player;
        if (videoOn) {
            videoOn = false;
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-off", true);
            xhr.send();
        }
    });

    function sendCommand(name) {

        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'electronapphost://' + name, true);

        xhr.send();
    }

    sendCommand('loaded');
});