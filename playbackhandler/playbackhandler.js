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
var currentPlayResolve;
var currentPlayReject;

function alert(text) {
    require('electron').dialog.showMessageBox(mainWindowRef, {
        message: text.toString(),
        buttons: ['ok']
    });
}

function download(url, dest) {
    return new Promise(function (resolve, reject) {
        var http = url.toLowerCase().indexOf('https:') == -1 ? require('http') : require('https');
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
        currentPlayResolve = resolve;
        currentPlayReject = reject;

        if (path.toLowerCase('http').indexOf() != -1) {
            //player.loadStream(path);
            player.loadFile(path);
        } else {
            player.loadFile(path);
        }
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
    mpvPlayer.goToPosition(Math.round(data / 10000000));
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

function getMpvOptions(options, mediaType, mediaSource) {

    var list = [];

    if (options.openglhq) {
        list.push('--profile=opengl-hq');
    }

    list.push('--hwdec=' + (options.hwdec || 'no'));

    list.push('--deinterlace=' + (options.deinterlace || 'auto'));

    list.push('--video-output-levels=' + (options.videoOutputLevels || 'auto'));

    if (options.videoSync) {

        list.push('--video-sync=' + (options.videoSync));
    }

    if (options.scale) {

        list.push('--scale=' + (options.scale));
    }

    if (options.cscale) {

        list.push('--cscale=' + (options.cscale));
    }

    if (options.dscale) {

        list.push('--dscale=' + (options.dscale));
    }

    if (options.interpolation) {

        list.push('--interpolation');

        if (options.tscale) {

            list.push('--tscale=' + (options.tscale));
        }
    }

    if (options.correctdownscaling) {

        list.push('--correct-downscaling');
    }

    if (options.sigmoidupscaling) {

        list.push('--sigmoid-upscaling');
    }

    if (options.deband) {

        list.push('--deband');
    }

    if (options.ditherdepth) {

        list.push('--dither-depth=' + (options.ditherdepth));
    }

    var audioOptions = getMpvAudioOptions(options, mediaType);
    for (var i = 0, length = audioOptions.length; i < length; i++) {
        list.push(audioOptions[i]);
    }

    var videoStream = (mediaSource.MediaStreams || []).filter(function (v) {
        return v.Type == 'Video';
    })[0];

    var framerate = videoStream ? (videoStream.AverageFrameRate || videoStream.RealFrameRate) : 0;

    var audioDelay = framerate >= 23 && framerate <= 25 ? options.audioDelay2325 : options.audioDelay;
    if (audioDelay) {
        list.push('--audio-delay=' + (audioDelay / 1000));
    }

    if (options.genPts) {

        list.push('--demuxer-lavf-genpts-mode=lavf');
    }

    if (options.largeCache) {

        list.push('--demuxer-readahead-secs=1800');
        list.push('--cache-secs=1800');

        var cacheSize = 2097152;
        var backBuffer = Math.round(cacheSize * .8);
        list.push('--cache=' + cacheSize.toString());
        list.push('--cache-backbuffer=' + backBuffer.toString());
        list.push('--force-seekable=yes');
        list.push('--hr-seek=yes');
        //list.push('--demuxer-lavf-hacks=no');
    }

    if (mediaSource.RunTimeTicks == null) {
        list.push('--demuxer-lavf-analyzeduration=3');
    }

    return list;
}

function getMpvAudioOptions(options, mediaType) {

    var list = [];

    var audioChannels = options.audioChannels || 'auto-safe';
    var audioFilters = [];
    if (audioChannels === '5.1') {
        audioChannels = '5.1,stereo';
    }
    else if (audioChannels === '7.1') {
        audioChannels = '7.1,5.1,stereo';
    }

    var audioChannelsFilter = getAudioChannelsFilter(options, mediaType);
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

    if (options.exclusiveAudio && mediaType === 'Video') {
        list.push('--audio-exclusive=yes');
    } else {
        list.push('--audio-exclusive=no');
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

    var player = mpvPlayer;

    player.removeAllListeners('timeposition');
    player.removeAllListeners('started');
    player.removeAllListeners('statuschange');
    player.removeAllListeners('stopped');

    try {
        player.quit();
    }
    catch (err) {
        console.log('error quitting mpv: ' + err);
    }

    delete mpvPlayer;

    mpvPlayer = null;
    playMediaSource = null;
    playMediaType = null;
    playerStatus = null;
    externalSubIndexes = null;
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

function getAudioStats(player) {

    var properties = [
        { property: 'audio-codec-name' },
        { property: 'audio-out-params' },
        { property: 'audio-bitrate', name: 'Audio bitrate:', type: 'bitrate' },
        { property: 'current-ao', name: 'Audio renderer:' },
        { property: 'audio-out-detected-device', name: 'Audio output device:' }
    ];

    var promises = properties.map(function (p) {
        return player.getProperty(p.property);
    });

    return Promise.all(promises).then(function (responses) {

        var stats = [];

        if (responses[0]) {
            stats.push({
                label: 'Audio codec:',
                value: responses[0]
            });
        }

        var audioParams = responses[1] || {};

        if (audioParams.channels) {
            stats.push({
                label: 'Audio channels:',
                value: audioParams.channels
            });
        }
        if (audioParams.samplerate) {
            stats.push({
                label: 'Audio sample rate:',
                value: audioParams.samplerate
            });
        }

        for (var i = 2, length = properties.length; i < length; i++) {

            var name = properties[i].name;

            var value = responses[i];

            if (properties[i].type == 'bitrate') {
                value = getDisplayBitrate(value);
            }

            if (value != null) {
                stats.push({
                    label: name,
                    value: value
                });
            }
        }
        return {
            stats: stats,
            type: 'audio'
        };
    });
}

function getDisplayBitrate(bitrate) {

    if (bitrate > 1000000) {
        return (bitrate / 1000000).toFixed(1) + ' Mbps';
    } else {
        return Math.floor(bitrate / 1000) + ' kbps';
    }
}

function getDroppedFrames(responses) {

    var html = '';

    html += (responses[responses.length - 4] || '0');

    html += ', Decoder dropped: ' + (responses[responses.length - 3] || '0');

    html += ', Mistimed: ' + (responses[responses.length - 2] || '0');

    html += ', Delayed: ' + (responses[responses.length - 1] || '0');

    return html;
}

function getVideoStats(player) {

    var properties = [
        { property: 'video-out-params' },
        { property: 'video-codec', name: 'Video codec:' },
        { property: 'video-bitrate', name: 'Video bitrate:', type: 'bitrate' },
        { property: 'current-vo', name: 'Video renderer:' },
        { property: 'hwdec-current', name: 'Hardware acceleration:' },
        { property: 'display-names', name: 'Display devices:' },
        { property: 'display-fps', name: 'Display fps:' },
        { property: 'estimated-display-fps', name: 'Estimated display fps:' },
        { property: 'display-sync-active', name: 'Display sync active:' },
        { property: 'frame-drop-count' },
        { property: 'decoder-frame-drop-count' },
        { property: 'mistimed-drop-count' },
        { property: 'vo-delayed-frame-count' }
    ];

    var promises = properties.map(function (p) {
        return player.getProperty(p.property);
    });

    return Promise.all(promises).then(function (responses) {

        var stats = [];

        var videoParams = responses[0] || {};

        for (var i = 1, length = properties.length - 4; i < length; i++) {

            var name = properties[i].name;

            var value = responses[i];

            if (properties[i].type == 'bitrate') {
                value = getDisplayBitrate(value);
            }

            if (value != null) {
                stats.push({
                    label: name,
                    value: value
                });
            }
        }

        stats.push({
            label: 'Dropped frames:',
            value: getDroppedFrames(responses)
        });

        if (videoParams.w && videoParams.h) {
            stats.push({
                label: 'Video resolution:',
                value: videoParams.w + ' x ' + videoParams.h
            });
        }

        if (videoParams.aspect) {
            stats.push({
                label: 'Aspect ratio:',
                value: videoParams.aspect
            });
        }

        if (videoParams.pixelformat) {
            stats.push({
                label: 'Pixel format:',
                value: videoParams.pixelformat
            });
        }

        if (videoParams.colormatrix) {
            stats.push({
                label: 'Color matrix:',
                value: videoParams.colormatrix
            });
        }

        if (videoParams.primaries) {
            stats.push({
                label: 'Primaries:',
                value: videoParams.primaries
            });
        }

        if (videoParams.gamma) {
            stats.push({
                label: 'Gamma:',
                value: videoParams.gamma
            });
        }

        if (videoParams.colorlevels) {
            stats.push({
                label: 'Levels:',
                value: videoParams.colorlevels
            });
        }

        return {
            stats: stats,
            type: 'video'
        };
    });
}

function getMediaStats(player) {

    var properties = [
        { property: 'media-title', name: 'Title:' },
        { property: 'chapter', name: 'Chapter:' }
    ];

    var promises = properties.map(function (p) {
        return player.getProperty(p.property);
    });

    return Promise.all(promises).then(function (responses) {

        var stats = [];

        for (var i = 0, length = properties.length ; i < length; i++) {

            var name = properties[i].name;

            var value = responses[i];

            if (value != null) {
                stats.push({
                    label: name,
                    value: value
                });
            }
        }
        return {
            stats: stats,
            type: 'media'
        };
    });
}

function getStatsJson(player) {

    return Promise.all([getMediaStats(player), getVideoStats(player), getAudioStats(player)]).then(function (responses) {

        var categories = [];

        for (var i = 0, length = responses.length; i < length; i++) {
            categories.push(responses[i]);
        }

        return JSON.stringify({
            categories: categories
        });
    });
}

function processRequest(request, body) {
    return new Promise(function (resolve, reject) {
        var url = require('url');
        var url_parts = url.parse(request.url, true);
        var action = url_parts.pathname.substring(1).toLowerCase();

        switch (action) {

            case 'play':
                var data = JSON.parse(body);
                playMediaSource = data.mediaSource;
                createMpv(data.playerOptions, data.mediaType, playMediaSource);
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
            case 'stats':
                if (mpvPlayer) {
                    getStatsJson(mpvPlayer).then(resolve);
                } else {
                    resolve('[]');
                }
                break;
            case 'stop':
                stop();
                getReturnJson().then(resolve);
                break;
            case 'stopdestroy':

                getReturnJson().then(function (returnJson) {
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

                    resolve(returnJson);
                });

                break;
            case 'positionticks':
                var data = url_parts.query["val"];
                set_position(data);
                timeposition = data;
                getReturnJson().then(resolve);
                break;
            case 'seekrelative':
                var data = url_parts.query["val"];
                mpvPlayer.seek(Math.round(data / 10000000));
                //timeposition = (timeposition || 0) + data;
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

function onMpvTimePosition(data) {
    timeposition = data * 10000000;
}

function onMpvStarted() {
    var resolve = currentPlayResolve;
    if (resolve) {
        currentPlayResolve = null;
        currentPlayReject = null;
        resolve();
    }
    mainWindowRef.focus();
}

function onMpvStatusChange(status) {
    playerStatus = status;
}

function onMpvStopped() {
    timeposition = 0;
}

function onMpvError() {
    onMpvStopped();
    cleanup();
}

function createMpv(options, mediaType, mediaSource) {
    if (mpvPlayer) return;
    var isWindows = require('is-windows');

    var mpvOptions = getMpvOptions(options, mediaType, mediaSource);

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

    mpvPlayer.on('timeposition', onMpvTimePosition);
    mpvPlayer.on('started', onMpvStarted);
    mpvPlayer.on('statuschange', onMpvStatusChange);
    mpvPlayer.on('stopped', onMpvStopped);
    mpvPlayer.on('error', onMpvError);
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