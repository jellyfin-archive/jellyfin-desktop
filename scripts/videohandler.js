require(['playbackManager', 'events'], function (playbackManager, events) {
    'use strict';

    events.on(playbackManager, "playbackstart", function (e, player) {
        if (player.requiresVideoTransparency && playbackManager.isPlayingVideo()) {
            var xhr = new XMLHttpRequest();
            xhr.open("POST", "electronapphost://video-on", true);
            xhr.send();
        }
    });
    events.on(playbackManager, "playbackstop", function (e, stopInfo) {
        var player = stopInfo.player;
        if (player.requiresVideoTransparency) {
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