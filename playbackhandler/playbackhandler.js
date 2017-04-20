var processes = {};
var timeposition = 0;
var mainWindowRef
var mpv = require('node-mpv');
var mpvPlayer
var playerWindowId
var mpvPath
var playerStatus
var playerStarted = false;

function alert(text) {
    require('electron').dialog.showMessageBox(mainWindowRef, {
        message: text.toString(),
        buttons: ['ok']
    });
}

function play(path) {
    return new Promise(function (resolve, reject) {
        console.log('Play URL : ' + path);
        playerStarted = false;
        mpvPlayer.loadFile(path);

        (function checkStarted(i) {
            setTimeout(function () {
                if (playerStarted) resolve();
                if (--i) checkStarted(i);
                else resolve();
            }, 100)
        })(100);
    });
}

function stop() {
    mpvPlayer.stop();
}

function pause() {
    mpvPlayer.pause();
}

function pause_toggle() {
    mpvPlayer.togglePause();
}

function set_position(data) {
    mpvPlayer.goToPosition(data / 10000000);
}

function set_volume(data) {
    mpvPlayer.volume(data);
}

function mute() {
    mpvPlayer.mute();
}

function unmute() {
    mpvPlayer.unmute();
}

function getReturnJson(positionTicks) {
    var playState = "playing";
    if (playerStatus.pause) {
        playState = "paused";
    }
    if (playerStatus['idle-active']) {;
        playState = "idle";
    }

    var state = {
        isPaused: playerStatus.pause || false,
        isMuted: playerStatus.mute || false,
        volume: playerStatus.volume || 100,
        durationTicks: playerStatus.duration * 100000 || 0,
        positionTicks: positionTicks || timeposition,
        playstate: playState
    }
    //console.log(state);
    return JSON.stringify(state);
}

function processRequest(request, callback) {

    var url = require('url');
    var url_parts = url.parse(request.url, true);
    var action = url_parts.host;

    switch (action) {

        case 'play':
            createMpv();
            var data = url_parts.query["path"];
            var startPositionTicks = url_parts.query["startPositionTicks"];

            play(data).then(() => {
                if (startPositionTicks != 0) {
                    set_position(startPositionTicks);
                }
                callback(getReturnJson(startPositionTicks));
            });

            break;
        case 'stop':
            stop();
            callback(getReturnJson());
            break;
        case 'stopfade':
            // TODO: If playing audio, stop with a fade out
            stop();
            delete mpvPlayer;
            callback(getReturnJson());
            break;
        case 'positionticks':
            var data = url_parts.query["val"];
            set_position(data);
            timeposition = data;
            callback(getReturnJson());
            break;
        case 'unpause':
            pause_toggle();
            callback(getReturnJson());
            break;
        case 'playpause':
            pause_toggle();
            callback(getReturnJson());
            break;
        case 'pause':
            pause();
            callback(getReturnJson());
            break;
        case 'volume':
            var data = url_parts.query["val"];
            set_volume(data);
            callback(getReturnJson());
            break;
        case 'mute':
            mute();
            callback(getReturnJson());
            break;
        case 'unmute':
            unmute();
            callback(getReturnJson());
            break;
        case 'setAudioStreamIndex':
            break;
        case 'setSubtitleStreamIndex':
            break;
        default:
            // This could be a refresh, e.g. player polling for data
            callback(getReturnJson());
            break;
    }
}

function initialize(playerWindowIdString, mpvBinaryPath) {
    playerWindowId = playerWindowIdString;
    mpvPath = mpvBinaryPath;
}

function createMpv() {
    if (mpvPlayer) return;
    var isWindows = require('is-windows');
    if (isWindows()) {
        mpvPlayer = new mpv({
            "binary": mpvPath,
            "ipc_command": "--input-ipc-server",
            "socket": "\\\\.\\pipe\\emby-pipe",
            "debug": false
        },
            [
            "--wid=" + playerWindowId,
            "--no-osc"
            ]);
    } else {
        mpvPlayer = new mpv({
            "binary": mpvPath,
            "ipc_command": "--input-unix-socket",
            "socket": "/tmp/emby.sock",
            "debug": false
        },
            [
            "--wid=" + playerWindowId,
            "--no-osc"
            ]);
    }
    mpvPlayer.observeProperty('idle-active', 13);

    mpvPlayer.on('timeposition', function (data) {
        timeposition = data * 10000000;
    });

    mpvPlayer.on('started', function () {
        playerStarted = true;
        mainWindowRef.focus();
    });

    mpvPlayer.on('statuschange', function (status) {
        playerStatus = status;
    });

    mpvPlayer.on('stopped', function () {
        timeposition = 0;
    });
}

function registerMediaPlayerProtocol(protocol, mainWindow) {

    protocol.registerStringProtocol('mpvplayer', function (request, callback) {
        mainWindowRef = mainWindow;
        processRequest(request, callback);
    });

}

exports.initialize = initialize;
exports.registerMediaPlayerProtocol = registerMediaPlayerProtocol;