var processes = {};
var timeposition = 0;
var mainWindowRef
var mpv = require('node-mpv');
var mpvPlayer;
var playerWindowId;
var mpvPath;
var playMediaSource;
var playMediaType;
var playerStatus;
var externalSubIndexes;
var fadeTimeout;
var currentVolume;
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
            reject();
        });
    });
}

function play(player, path) {
    return new Promise(function (resolve, reject) {
        console.log('Play URL : ' + path);
        playerStarted = false;
        player.loadFile(path);

        (function checkStarted(i) {
            setTimeout(function () {
                if (playerStarted) resolve();
                if (--i) checkStarted(i);
                else reject();
            }, 100);
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

function unpause() {
    mpvPlayer.resume();
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

function set_audiostream(player, index) {

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
    player.setProperty("aid", audioIndex);
}

function set_subtitlestream(player, index) {

    if (index < 0) {
        player.setProperty("sid", "no");
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
                            player.setProperty("sid", externalSubIndexes[stream.Index]);
                        } else {
                            var os = require('os');
                            var subtitlefile = os.tmpdir() + "/" + "subtitle" + new Date().getTime() + "." + stream.Codec.toLowerCase();
                            download(stream.DeliveryUrl, subtitlefile).then(() => {
                                player.addSubtitles(subtitlefile, "select", stream.DisplayTitle, stream.Language);
                                player.getProperty('sid').then(function (sid) {
                                    externalSubIndexes[stream.Index] = sid;
                                }).catch(() => {
                                    console.log("Failed to download " + stream.DeliveryUrl);
                                });
                            });
                        }
                    } else {
                        player.setProperty("sid", subIndex);
                    }

                    break;
                }
            }
        }
    }
}

function getMpvVideoOptions(options) {

    var list = [];

    if (options.openglhq === 'yes') {
        list.push('--profile=opengl-hq');
    }

    list.push('--deinterlace=' + (options.deinterlace || 'auto'));

    list.push('--video-output-levels=' + (options.videoOutputLevels || 'auto'));

    if (options.videoSync) {

        list.push('--video-sync=' + (options.videoSync));
    }

    if (options.scale) {

        list.push('--scale=' + (options.scale));
    }

    if (options.interpolation == 'yes') {

        list.push('--interpolation');

        if (options.tscale) {

            list.push('--tscale=' + (options.tscale));
        }
    }

    var audioChannels = options.audioChannels || 'auto-safe';
    var audioFilters = [];
    if (audioChannels === '5.1') {
        audioChannels = '5.1,stereo';
    }
    else if (audioChannels === '7.1') {
        audioChannels = '7.1,5.1,stereo';
    }

    var audioChannelsFilter = getAudioChannelsFilter(options, 'Video');
    if (audioChannelsFilter) {
        audioFilters.push(audioChannelsFilter);
    }

    if (audioFilters.length) {

        list.push('--af=' + (audioFilters.join(',')));
    }

    list.push('--audio-channels=' + (audioChannels));

    if (options.audioSpdif) {
        list.push('--audio-spdif=' + (options.audioSpdif));
    }

    list.push('--ad-lavc-ac3drc=' + (options.dynamicRangeCompression || 0));


    return list;
}

function getMpvMusicOptions(options) {

    var list = [];
    var audioFilters = [];

    var audioChannelsFilter = getAudioChannelsFilter(options, 'Audio');
    if (audioChannelsFilter) {
        audioFilters.push(audioChannelsFilter);
    }

    if (audioFilters.length) {
        list.push('--af=' + audioFilters.join(','));
    }

    return list;
}

function getAudioChannelsFilter(options, mediaType) {

    var enableFilter = false;
    var upmixFor = (options.upmixAudioFor || '').split(',');

    if (mediaType === 'Audio') {
        if (upmixFor.indexOf('music') !== -1) {
            enableFilter = true;
        }
    }

    if (enableFilter) {
        var audioChannels = options.audioChannels || 'auto-safe';
        if (audioChannels === '5.1') {
            //return 'channels=6';
            return 'channels=6:[0-0,0-1,0-2,0-3,0-4,0-5]';
        }
        else if (audioChannels === '7.1') {
            //return 'channels=8';
            return 'channels=8:[0-0,0-1,0-2,0-3,0-4,0-5,0-6,0-7]';
        }
    }

    return '';
}

function fade(startingVolume) {
    var newVolume = Math.max(0, startingVolume - 0.15);
    set_volume(newVolume);

    if (newVolume <= 0) {
        return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {

        cancelFadeTimeout();

        fadeTimeout = setTimeout(function () {
            fade(newVolume).then(resolve, reject);
        }, 1);
    });
}

function cancelFadeTimeout() {
    var timeout = fadeTimeout;
    if (timeout) {
        clearTimeout(timeout);
        fadeTimeout = null;
    }
}

function cleanup() {
    mpvPlayer.quit();
    delete mpvPlayer;
    mpvPlayer = null;
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
        volume: currentVolume || playerStatus.volume || 100,
        positionTicks: positionTicks || timeposition,
        playstate: playState
    }

    if (playerStatus.duration) {

        state.durationTicks = playerStatus.duration * 10000000;
    } else if (playerStatus['demuxer-cache-time']) {
        state.durationTicks = playerStatus['demuxer-cache-time'] * 10000000;
    }

    return Promise.resolve(JSON.stringify(state));
}

function processRequest(request, body) {
    return new Promise(function (resolve, reject) {
        var url = require('url');
        var url_parts = url.parse(request.url, true);
        var action = url_parts.pathname.substring(1).toLowerCase();

        switch (action) {

            case 'play':
                var data = JSON.parse(body);
                createMpv(data.playerOptions, data.mediaType);
                playMediaSource = data.mediaSource;
                playMediaType = data.mediaType;

                externalSubIndexes = {};
                var startPositionTicks = data["startPositionTicks"];

                play(mpvPlayer, data.path).then(() => {
                    if (playMediaSource.DefaultAudioStreamIndex != null) {
                        set_audiostream(mpvPlayer, playMediaSource.DefaultAudioStreamIndex);
                    }

                    if (playMediaSource.DefaultSubtitleStreamIndex != null) {
                        set_subtitlestream(mpvPlayer, playMediaSource.DefaultSubtitleStreamIndex);
                    }
                    else {
                        set_subtitlestream(mpvPlayer, -1);
                    }

                    if (startPositionTicks != 0) {
                        set_position(startPositionTicks);
                    }

                    getReturnJson(startPositionTicks).then(resolve);
                }).catch(reject);

                break;
            case 'stop':
                stop();
                getReturnJson().then(resolve);
                break;
            case 'stopdestroy':
                if (playMediaType.toLowerCase() === 'audio') {
                    currentVolume = playerStatus.volume || 100;
                    fade(currentVolume).then(() => {
                        stop();
                        set_volume(currentVolume);
                        currentVolume = null;
                        cleanup();
                    }).catch(reject);
                } else {
                    stop();
                    cleanup();
                }
                getReturnJson().then(resolve);
                break;
            case 'positionticks':
                var data = url_parts.query["val"];
                set_position(data);
                timeposition = data;
                getReturnJson().then(resolve);
                break;
            case 'unpause':
                unpause();
                getReturnJson().then(resolve);
                break;
            case 'playpause':
                pause_toggle();
                getReturnJson().then(resolve);
                break;
            case 'pause':
                pause();
                getReturnJson().then(resolve);
                break;
            case 'volume':
                var data = url_parts.query["val"];
                set_volume(data);
                getReturnJson().then(resolve);
                break;
            case 'mute':
                mute();
                getReturnJson().then(resolve);
                break;
            case 'unmute':
                unmute();
                getReturnJson().then(resolve);
                break;
            case 'setaudiostreamindex':
                var data = url_parts.query["index"];
                set_audiostream(mpvPlayer, data);
                getReturnJson().then(resolve);
                break;
            case 'setsubtitlestreamindex':
                var data = url_parts.query["index"];
                set_subtitlestream(mpvPlayer, data);
                getReturnJson().then(resolve);
                break;
            default:
                // This could be a refresh, e.g. player polling for data
                getReturnJson().then(resolve);
                break;
        }
    });
}

function initialize(playerWindowIdString, mpvBinaryPath) {
    playerWindowId = playerWindowIdString;
    mpvPath = mpvBinaryPath;
}

function createMpv(options, mediaType) {
    if (mpvPlayer) return;
    var isWindows = require('is-windows');

    var mpvOptions = mediaType === 'Audio' ? getMpvMusicOptions(options) : getMpvVideoOptions(options);

    mpvOptions.push('--wid=' + playerWindowId);
    mpvOptions.push('--no-osc');

    var mpvInitOptions = {
        "debug": false
    };

    if (mpvPath) {
        mpvInitOptions.binary = mpvPath;
    }

    if (isWindows()) {

        mpvInitOptions.socket = "\\\\.\\pipe\\emby-pipe";
        mpvInitOptions.ipc_command = "--input-ipc-server";
    } else {

        mpvInitOptions.socket = "/tmp/emby.sock";
        mpvInitOptions.ipc_command = "--input-unix-socket";
    }

    mpvPlayer = new mpv(mpvInitOptions, mpvOptions);

    mpvPlayer.observeProperty('idle-active', 13);
    mpvPlayer.observeProperty('demuxer-cache-time', 14);

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

        processRequest(req, body).then((json) => {
            if (json != null) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(json);
            } else {
                res.writeHead(500);
                res.end();
            }
        }).catch(() => {
            res.writeHead(500);
            res.end();
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