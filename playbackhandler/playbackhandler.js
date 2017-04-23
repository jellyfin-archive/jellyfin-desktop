var processes = {};
var timeposition = 0;
var mainWindowRef
var mpv = require('node-mpv');
var mpvPlayer
var playerWindowId
var mpvPath
var playMediaSource
var playerStatus
var externalSubIndexes
var playerStarted = false;

function alert(text) {
    require('electron').dialog.showMessageBox(mainWindowRef, {
        message: text.toString(),
        buttons: ['ok']
    });
}

function download(url, dest) {
    return new Promise(function (resolve, reject) {
        var http = require('http');
        var fs = require('fs');
        var file = fs.createWriteStream(dest);
        var request = http.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(resolve);  // close() is async, call cb after close completes.
            });
        }).on('error', function (err) { // Handle errors
            fs.unlink(dest); // Delete the file async. (But we don't check the result)
            resolve();
        });
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

function set_audiostream(index) {

    return;
    var audioIndex = 0;
    var i, length, stream;
    var streams = playMediaSource.MediaStreams || [];
    for (i = 0, length = streams.length; i < length; i++) {
        stream = streams[i];
        if (stream.Type === 'Audio') {
            audioIndex++;
            if (stream.Index == index) {
                break;
            }
        }
    }
    mpvPlayer.setProperty("aid", audioIndex);
}

function set_subtitlestream(index) {

    if (index < 0) {
        mpvPlayer.setProperty("sid", "no");
    } else {
        var subIndex = 0;
        var i, length, stream;
        var streams = playMediaSource.MediaStreams || [];
        for (i = 0, length = streams.length; i < length; i++) {
            stream = streams[i];
            if (stream.Type === 'Subtitle') {
                subIndex++;

                if (stream.Index == index) {
                    if (stream.DeliveryMethod === 'External') {
                        if (stream.Index in externalSubIndexes) {
                            mpvPlayer.setProperty("sid", externalSubIndexes[stream.Index]);
                        } else {
                            var os = require('os');
                            var subtitlefile = os.tmpdir() + "/" + "subtitle" + new Date().getTime() + "." + stream.Codec.toLowerCase();
                            download(stream.DeliveryUrl, subtitlefile).then(() => {
                                mpvPlayer.addSubtitles(subtitlefile, "select", stream.DisplayTitle, stream.Language);
                                mpvPlayer.getProperty('sid').then(function (sid) {
                                    externalSubIndexes[stream.Index] = sid;
                                });
                            });
                        }
                    } else {
                        mpvPlayer.setProperty("sid", subIndex);
                    }

                    break;
                }
            }
        }
    }
}

function getReturnJson(positionTicks) {
    var playState = "playing";
    if (playerStatus.pause) {
        playState = "paused";
    }
    if (playerStatus['idle-active']) {
        playState = "idle";
    }

    var state = {
        isPaused: playerStatus.pause || false,
        isMuted: playerStatus.mute || false,
        volume: playerStatus.volume || 100,
        positionTicks: positionTicks || timeposition,
        playstate: playState
    }

    if (playerStatus.duration) {

        state.durationTicks = playerStatus.duration * 10000000;
    }

    return Promise.resolve(JSON.stringify(state));
}

function processRequest(request, body, callback) {

    var url = require('url');
    var url_parts = url.parse(request.url, true);
    var action = url_parts.pathname.substring(1);

    switch (action) {

        case 'play':
            createMpv();
            externalSubIndexes = {};
            var data = JSON.parse(body);
            var startPositionTicks = data["startPositionTicks"];
            playMediaSource = data.mediaSource;
            //console.log(playMediaSource);

            play(data.path).then(() => {

                set_audiostream(playMediaSource.DefaultAudioStreamIndex);
                set_subtitlestream(playMediaSource.DefaultSubtitleStreamIndex);

                if (startPositionTicks != 0) {
                    set_position(startPositionTicks);
                }

                getReturnJson(startPositionTicks).then(callback);
            });

            break;
        case 'stop':
            stop();
            getReturnJson().then(callback);
            break;
        case 'stopfade':
            // TODO: If playing audio, stop with a fade out
            stop();
            delete mpvPlayer;
            getReturnJson().then(callback);
            break;
        case 'positionticks':
            var data = url_parts.query["val"];
            set_position(data);
            timeposition = data;
            getReturnJson().then(callback);
            break;
        case 'unpause':
            pause_toggle();
            getReturnJson().then(callback);
            break;
        case 'playpause':
            pause_toggle();
            getReturnJson().then(callback);
            break;
        case 'pause':
            pause();
            getReturnJson().then(callback);
            break;
        case 'volume':
            var data = url_parts.query["val"];
            set_volume(data);
            getReturnJson().then(callback);
            break;
        case 'mute':
            mute();
            getReturnJson().then(callback);
            break;
        case 'unmute':
            unmute();
            getReturnJson().then(callback);
            break;
        case 'setaudiostreamindex':
            var data = url_parts.query["index"];
            set_audiostream(data);
            getReturnJson().then(callback);
            break;
        case 'setsubtitlestreamindex':
            var data = url_parts.query["index"];
            set_subtitlestream(data);
            getReturnJson().then(callback);
            break;
        default:
            // This could be a refresh, e.g. player polling for data
            getReturnJson().then(callback);
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

function processNodeRequest(req, res) {

    var body = [];

    req.on('data', function (chunk) {
        body.push(chunk);
    }).on('end', function () {

        body = Buffer.concat(body).toString();
        // at this point, `body` has the entire request body stored in it as a string

        processRequest(req, body, function (json) {

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(json);
        });
    });
}

function registerMediaPlayerProtocol(protocol, mainWindow) {

    mainWindowRef = mainWindow;

    var http = require('http');

    http.createServer(processNodeRequest).listen(8023, '127.0.0.1');
}

exports.initialize = initialize;
exports.registerMediaPlayerProtocol = registerMediaPlayerProtocol;