import { dialog, screen } from "electron";
import { createServer } from "http";
import * as isWindows from "is-windows";
import * as mpv from "node-mpv";

import * as isRpi from "detect-rpi";
import * as url from "url";

const processes = {};
let timeposition: any = 0;
let mainWindowRef;
let mpvPlayer;
let playerWindowId;
let mpvPath;
let playMediaSource;
let playMediaType;
let playerStatus;
let fadeTimeout;
let currentVolume;
let currentPlayResolve;
let currentPlayReject;

function alert(text) {
    dialog.showMessageBox(mainWindowRef, {
        message: text.toString(),
        buttons: ["ok"]
    });
}

function play(player, path: string) {
    return new Promise((resolve, reject) => {
        console.log(`Play URL : ${path}`);
        currentPlayResolve = resolve;
        currentPlayReject = reject;

        if (path.toLowerCase().includes("http")) {
            // player.loadStream(path);
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

function setAspectRatio(player, value) {
    switch (value) {
        case "4_3":
            player.setProperty("video-unscaled", "no");
            player.setProperty("video-aspect", "4:3");
            break;
        case "16_9":
            player.setProperty("video-unscaled", "no");
            player.setProperty("video-aspect", "16:9");
            break;
        case "bestfit":
            player.setProperty("video-unscaled", "no");
            player.setProperty("video-aspect", "-1");
            break;
        case "fill":
            // var size = player.getProperty("android-surface-size");
            // var aspect = parseFloat(size.split("x")[0]) / parseFloat(size.split("x")[1]);
            // player.setProperty("video-unscaled", "no");
            // player.setProperty("video-aspect", aspect);

            break;
        case "original":
            player.setProperty("video-unscaled", "downscale-big");
            player.setProperty("video-aspect", "-1");
            break;
    }
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

function video_toggle() {
    if (isRpi()) {
        mpvPlayer.cycleProperty("video");
    }
}

function set_audiostream(player, index) {
    let audioIndex = 0;
    let i;
    let length;
    let stream;
    const streams = playMediaSource.MediaStreams || [];
    for (i = 0, length = streams.length; i < length; i++) {
        stream = streams[i];
        if (stream.Type === "Audio") {
            audioIndex++;
            if (stream.Index === index) {
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
        let subIndex = 0;
        let i;
        let length;
        let stream;
        const streams = playMediaSource.MediaStreams || [];
        for (i = 0, length = streams.length; i < length; i++) {
            stream = streams[i];
            if (stream.Type === "Subtitle") {
                subIndex++;

                if (stream.Index === index) {
                    if (stream.DeliveryMethod === "External") {
                        player.addSubtitles(
                            stream.DeliveryUrl,
                            "cached",
                            stream.DisplayTitle,
                            stream.Language
                        );
                    } else {
                        player.setProperty("sid", subIndex);
                        if (stream.Codec === "dvb_teletext") {
                            setDvbTeletextPage(player, stream);
                        }
                    }

                    break;
                }
            }
        }
    }
}

function setDvbTeletextPage(player, stream) {
    // cases to handle:
    // 00000000: 0001 0001 10
    // 00000000: 1088 0888
    // 00000000: 1088
    // If the stream contains multiple languages, just use the first

    const extradata = stream.Extradata;

    if (extradata && extradata.length > 13) {
        let pageNumber = parseInt(extradata.substring(11, 14), 10);
        if (pageNumber < 100) {
            pageNumber += 800;
        }
        player.setProperty("teletext-page", pageNumber);
    }
}

function getMpvOptions(options, mediaType, mediaSource) {
    const list = [];

    if (options.openglhq) {
        list.push("--profile=opengl-hq");
    }
    if (isRpi()) {
        list.push("--fs");
    }

    list.push("--hwdec=" + (options.hwdec || "no"));

    if (options.deinterlace === "yes") {
        list.push("--deinterlace=" + (options.deinterlace || "auto"));
    }

    list.push("--video-output-levels=" + (options.videoOutputLevels || "auto"));

    if (options.videoSync) {
        list.push(`--video-sync=${options.videoSync}`);
    }

    // limitation that until we can pass the Windows monitor# (not the display name that MPV returns), is limited to Primary monitor
    if (options.displaySync) {
        const winPosition = mainWindowRef.getPosition();
        const winBounds = mainWindowRef.getBounds();
        const displayParamsActive = screen.getDisplayNearestPoint({
            x: winPosition[0],
            y: winPosition[1]
        });

        // rough test for fullscreen on playback start
        if (
            winBounds.width === displayParamsActive.size.width &&
            displayParamsActive.size.height === winBounds.height
        ) {
            const rfRate =
                options.displaySync_Override !== ""
                    ? `,refreshrate-rates="${options.displaySync_Override}"`
                    : "";
            const rfTheme = options.fullscreen ? "" : ",refreshrate-theme=true";

            list.push(
                `--script-opts=refreshrate-enabled=true${rfRate}${rfTheme}`
            );
        }
    }

    if (options.scale) {
        list.push(`--scale=${options.scale}`);
    }

    if (options.cscale) {
        list.push(`--cscale=${options.cscale}`);
    }

    if (options.dscale) {
        list.push(`--dscale=${options.dscale}`);
    }

    if (options.interpolation) {
        list.push("--interpolation");

        if (options.tscale) {
            list.push(`--tscale=${options.tscale}`);
        }
    }

    if (options.correctdownscaling) {
        list.push("--correct-downscaling");
    }

    if (options.sigmoidupscaling) {
        list.push("--sigmoid-upscaling");
    }

    if (options.deband) {
        list.push("--deband");
    }

    if (options.ditherdepth) {
        list.push(`--dither-depth=${options.ditherdepth}`);
    }

    if (options.videoStereoMode) {
        list.push(`--video-stereo-mode=${options.videoStereoMode}`);
    }

    if (options.subtitleFontFamily) {
        list.push(`--sub-font=${options.subtitleFontFamily}`);
    }

    if (options.subtitleFontSize) {
        list.push(`--sub-font-size=${options.subtitleFontSize}`);
    }

    const audioOptions = getMpvAudioOptions(options, mediaType);
    for (let i = 0, length = audioOptions.length; i < length; i++) {
        list.push(audioOptions[i]);
    }

    const videoStream = (mediaSource.MediaStreams || []).filter(
        v => v.Type === "Video"
    )[0];

    const framerate = videoStream
        ? videoStream.AverageFrameRate || videoStream.RealFrameRate
        : 0;

    const audioDelay =
        framerate >= 23 && framerate <= 25
            ? options.audioDelay2325
            : options.audioDelay;
    if (audioDelay) {
        list.push(`--audio-delay=${audioDelay / 1000}`);
    }

    if (options.genPts) {
        list.push("--demuxer-lavf-genpts-mode=lavf");
    }

    if (options.largeCache) {
        list.push("--demuxer-readahead-secs=1800");
        list.push("--cache-secs=1800");

        const cacheSize = 2097152;
        const backBuffer = Math.round(cacheSize * 0.8);
        list.push(`--cache=${cacheSize.toString()}`);
        list.push(`--cache-backbuffer=${backBuffer.toString()}`);
        list.push("--force-seekable=yes");
        list.push("--hr-seek=yes");
        // list.push('--demuxer-lavf-hacks=no');
    }

    if (mediaSource.RunTimeTicks == null) {
        list.push("--demuxer-lavf-analyzeduration=3");
    }

    return list;
}

function getMpvAudioOptions(options, mediaType) {
    const list = [];

    let audioChannels = options.audioChannels || "auto-safe";
    const audioFilters = [];
    if (audioChannels === "5.1") {
        audioChannels = "5.1,stereo";
    } else if (audioChannels === "7.1") {
        audioChannels = "7.1,stereo";
    }

    const audioChannelsFilter = getAudioChannelsFilter(options, mediaType);
    if (audioChannelsFilter) {
        audioFilters.push(audioChannelsFilter);
    }

    if (audioFilters.length) {
        list.push(`--af=lavfi=[${audioFilters.join(",")}]`);
    }

    list.push(`--audio-channels=${audioChannels}`);

    if (options.audioSpdif) {
        list.push(`--audio-spdif=${options.audioSpdif}`);
    }

    list.push(`--ad-lavc-ac3drc=${options.dynamicRangeCompression || 0}`);

    if (options.exclusiveAudio && mediaType === "Video") {
        list.push("--audio-exclusive=yes");
    }

    return list;
}

function getAudioChannelsFilter(options, mediaType) {
    let enableFilter = false;
    const upmixFor = (options.upmixAudioFor || "").split(",");

    if (mediaType === "Audio") {
        if (upmixFor.indexOf("music") !== -1) {
            enableFilter = true;
        }
    }

    // there's also a surround filter but haven't found good documentation to implement -PMR 20171225
    if (enableFilter) {
        const audioChannels = options.audioChannels || "";
        if (audioChannels === "5.1") {
            // return 'channels=6';
            return "pan=5.1|FL=FL|BL=FL|FR=FR|BR=FR|FC<0.5*FL + 0.5*FR";
        } else if (audioChannels === "7.1") {
            // return 'channels=8';
            return "pan=7.1|FL=FL|SL=FL|BL=FL|FR=FR|SR=FR|BR=FR|FC<0.5*FL + 0.5*FR";
        }
    }

    return "";
}

function fade(startingVolume) {
    const newVolume = Math.max(0, startingVolume - 0.15);
    set_volume(newVolume);

    if (newVolume <= 0) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        cancelFadeTimeout();

        fadeTimeout = setTimeout(() => {
            fade(newVolume).then(resolve, reject);
        }, 1);
    });
}

function cancelFadeTimeout() {
    const timeout = fadeTimeout;
    if (timeout) {
        clearTimeout(timeout);
        fadeTimeout = null;
    }
}

function cleanup() {
    const player = mpvPlayer;

    player.removeAllListeners("timeposition");
    player.removeAllListeners("started");
    player.removeAllListeners("statuschange");
    player.removeAllListeners("stopped");

    try {
        player.quit();
    } catch (err) {
        console.log(`error quitting mpv: ${err}`);
    }

    mpvPlayer = null;
    playMediaSource = null;
    playMediaType = null;
    playerStatus = null;
}

function getReturnJson(positionTicks?: number) {
    let playState = "playing";
    if (playerStatus.pause) {
        playState = "paused";
    }

    if (playerStatus["idle-active"]) {
        playState = "idle";
    }

    const state: any = {
        isPaused: playerStatus.pause || false,
        isMuted: playerStatus.mute || false,
        volume: currentVolume || playerStatus.volume || 100,
        positionTicks: positionTicks || timeposition,
        playstate: playState,
        demuxerCacheState: playerStatus["demuxer-cache-state"]
    };

    if (playerStatus.duration) {
        state.durationTicks = playerStatus.duration * 10000000;
    } else if (playerStatus["demuxer-cache-time"]) {
        state.durationTicks = playerStatus["demuxer-cache-time"] * 10000000;
    }

    return Promise.resolve(JSON.stringify(state));
}

function getAudioStats(player) {
    const properties = [
        { property: "audio-codec-name" },
        { property: "audio-out-params" },
        { property: "audio-bitrate", name: "Audio bitrate:", type: "bitrate" },
        { property: "current-ao", name: "Audio renderer:" },
        { property: "audio-out-detected-device", name: "Audio output device:" }
    ];

    const promises = properties.map(p => player.getProperty(p.property));

    return Promise.all(promises).then(responses => {
        const stats = [];

        if (responses[0]) {
            stats.push({
                label: "Audio codec:",
                value: responses[0]
            });
        }

        const audioParams = responses[1] || {};

        if (audioParams.channels) {
            stats.push({
                label: "Audio channels:",
                value: audioParams.channels
            });
        }
        if (audioParams.samplerate) {
            stats.push({
                label: "Audio sample rate:",
                value: audioParams.samplerate
            });
        }

        for (let i = 2, length = properties.length; i < length; i++) {
            const name = properties[i].name;

            let value = responses[i];

            if (properties[i].type === "bitrate") {
                value = getDisplayBitrate(value);
            }

            if (value !== null) {
                stats.push({
                    label: name,
                    value
                });
            }
        }
        return {
            stats,
            type: "audio"
        };
    });
}

function getDisplayBitrate(bitrate) {
    if (bitrate > 1000000) {
        return `${(bitrate / 1000000).toFixed(1)} Mbps`;
    } else {
        return `${Math.floor(bitrate / 1000)} kbps`;
    }
}

function getDroppedFrames(responses) {
    let html = "";

    html += responses[responses.length - 4] || "0";

    html += ", Decoder dropped: " + (responses[responses.length - 3] || "0");

    html += ", Mistimed: " + (responses[responses.length - 2] || "0");

    html += ", Delayed: " + (responses[responses.length - 1] || "0");

    return html;
}

function getVideoStats(player) {
    const properties = [
        { property: "video-out-params" },
        { property: "video-codec", name: "Video codec:" },
        { property: "video-bitrate", name: "Video bitrate:", type: "bitrate" },
        { property: "current-vo", name: "Video renderer:" },
        { property: "hwdec-current", name: "Hardware acceleration:" },
        { property: "display-names", name: "Display devices:" },
        { property: "display-fps", name: "Display fps:" },
        { property: "estimated-display-fps", name: "Estimated display fps:" },
        { property: "display-sync-active", name: "Display sync active:" },
        { property: "frame-drop-count" },
        { property: "decoder-frame-drop-count" },
        { property: "mistimed-drop-count" },
        { property: "vo-delayed-frame-count" }
    ];

    const promises = properties.map(p => player.getProperty(p.property));

    return Promise.all(promises).then(responses => {
        const stats = [];

        const videoParams = responses[0] || {};

        for (let i = 1, length = properties.length - 4; i < length; i++) {
            const name = properties[i].name;

            let value = responses[i];

            if (properties[i].type === "bitrate") {
                value = getDisplayBitrate(value);
            }

            if (value != null) {
                stats.push({
                    label: name,
                    value
                });
            }
        }

        stats.push({
            label: "Dropped frames:",
            value: getDroppedFrames(responses)
        });

        const winPosition = mainWindowRef.getPosition();
        const displayParams = screen.getDisplayNearestPoint({
            x: winPosition[0],
            y: winPosition[1]
        });

        stats.push({
            label: "Display Fullscreen Resolution:",
            value: `${displayParams.size.width} x ${displayParams.size.height}`
        });

        if (videoParams.w && videoParams.h) {
            stats.push({
                label: "Video resolution:",
                value: `${videoParams.w} x ${videoParams.h}`
            });
        }

        if (videoParams.aspect) {
            stats.push({
                label: "Aspect ratio:",
                value: videoParams.aspect
            });
        }

        if (videoParams.pixelformat) {
            stats.push({
                label: "Pixel format:",
                value: videoParams.pixelformat
            });
        }

        if (videoParams.colormatrix) {
            stats.push({
                label: "Color matrix:",
                value: videoParams.colormatrix
            });
        }

        if (videoParams.primaries) {
            stats.push({
                label: "Primaries:",
                value: videoParams.primaries
            });
        }

        if (videoParams.gamma) {
            stats.push({
                label: "Gamma:",
                value: videoParams.gamma
            });
        }

        if (videoParams.colorlevels) {
            stats.push({
                label: "Levels:",
                value: videoParams.colorlevels
            });
        }

        return {
            stats,
            type: "video"
        };
    });
}

function getMediaStats(player) {
    const properties = [
        { property: "media-title", name: "Title:" },
        { property: "chapter", name: "Chapter:" }
    ];

    const promises = properties.map(p => player.getProperty(p.property));

    return Promise.all(promises).then(responses => {
        const stats = [];

        for (let i = 0, length = properties.length; i < length; i++) {
            const name = properties[i].name;

            const value = responses[i];

            if (value != null) {
                stats.push({
                    label: name,
                    value
                });
            }
        }
        return {
            stats,
            type: "media"
        };
    });
}

function getStatsJson(player) {
    return Promise.all([
        getMediaStats(player),
        getVideoStats(player),
        getAudioStats(player)
    ]).then(responses => {
        const categories = [];

        for (let i = 0, length = responses.length; i < length; i++) {
            categories.push(responses[i]);
        }

        return JSON.stringify({
            categories
        });
    });
}

function processRequest(request, body) {
    return new Promise((resolve, reject) => {
        const urlParts = url.parse(request.url, true);
        const action = urlParts.pathname.substring(1).toLowerCase();

        switch (action) {
            case "play":
                const playData = JSON.parse(body);
                playMediaSource = playData.mediaSource;
                createMpv(
                    playData.playerOptions,
                    playData.mediaType,
                    playMediaSource
                );
                playMediaType = playData.mediaType;

                const startPositionTicks = playData.startPositionTicks;

                mpvPlayer.volume(playData.playerOptions.volume || 100);

                play(mpvPlayer, playData.path)
                    .then(() => {
                        if (
                            playMediaSource.DefaultAudioStreamIndex != null &&
                            playData.playMethod !== "Transcode"
                        ) {
                            set_audiostream(
                                mpvPlayer,
                                playMediaSource.DefaultAudioStreamIndex
                            );
                        }

                        if (
                            playMediaSource.DefaultSubtitleStreamIndex != null
                        ) {
                            set_subtitlestream(
                                mpvPlayer,
                                playMediaSource.DefaultSubtitleStreamIndex
                            );
                        } else {
                            set_subtitlestream(mpvPlayer, -1);
                        }

                        if (startPositionTicks !== 0) {
                            set_position(startPositionTicks);
                        }

                        getReturnJson(startPositionTicks).then(resolve);
                    })
                    .catch(reject);

                break;
            case "stats":
                if (mpvPlayer) {
                    getStatsJson(mpvPlayer).then(resolve);
                } else {
                    resolve("[]");
                }
                break;
            case "stop":
                stop();
                getReturnJson().then(resolve);
                break;
            case "stopdestroy":
                getReturnJson().then(returnJson => {
                    if (playMediaType.toLowerCase() === "audio") {
                        currentVolume = playerStatus.volume || 100;
                        fade(currentVolume)
                            .then(() => {
                                stop();
                                set_volume(currentVolume);
                                currentVolume = null;
                                cleanup();
                            })
                            .catch(reject);
                    } else {
                        stop();
                        cleanup();
                    }

                    resolve(returnJson);
                });

                break;
            case "positionticks":
                const ticksData = urlParts.query.val;
                set_position(ticksData);
                timeposition = ticksData;
                getReturnJson().then(resolve);
                break;
            case "seekrelative":
                const seekData: any = urlParts.query.val;
                mpvPlayer.seek(Math.round(seekData / 10000000));
                // timeposition = (timeposition || 0) + data;
                getReturnJson().then(resolve);
                break;
            case "unpause":
                unpause();
                getReturnJson().then(resolve);
                break;
            case "playpause":
                pause_toggle();
                getReturnJson().then(resolve);
                break;
            case "pause":
                pause();
                getReturnJson().then(resolve);
                break;
            case "volumeup":
                set_volume(
                    Math.min(
                        100,
                        (currentVolume || playerStatus.volume || 100) + 2
                    )
                );
                getReturnJson().then(resolve);
                break;
            case "volumedown":
                set_volume(
                    Math.max(
                        1,
                        (currentVolume || playerStatus.volume || 100) - 2
                    )
                );
                getReturnJson().then(resolve);
                break;
            case "volume":
                const volumeData = urlParts.query.val;
                set_volume(volumeData);
                getReturnJson().then(resolve);
                break;
            case "aspectratio":
                const aspectData = urlParts.query.val;
                setAspectRatio(mpvPlayer, aspectData);
                getReturnJson().then(resolve);
                break;
            case "mute":
                mute();
                getReturnJson().then(resolve);
                break;
            case "unmute":
                unmute();
                getReturnJson().then(resolve);
                break;
            case "setaudiostreamindex":
                const audioData = urlParts.query.index;
                set_audiostream(mpvPlayer, audioData);
                getReturnJson().then(resolve);
                break;
            case "setsubtitlestreamindex":
                const subtitleData = urlParts.query.index;
                set_subtitlestream(mpvPlayer, subtitleData);
                getReturnJson().then(resolve);
                break;
            case "video_toggle":
                video_toggle();
                getReturnJson().then(resolve);
                break;
            default:
                // This could be a refresh, e.g. player polling for data
                getReturnJson().then(resolve);
                break;
        }
    });
}

export function initialize(playerWindowIdString, mpvBinaryPath) {
    playerWindowId = playerWindowIdString;
    mpvPath = mpvBinaryPath;
}

function onMpvTimePosition(data) {
    timeposition = data * 10000000;
}

function onMpvStarted() {
    const resolve = currentPlayResolve;
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
    if (mpvPlayer) {
        return;
    }
    const mpvOptions = getMpvOptions(options, mediaType, mediaSource);

    mpvOptions.push(`--wid=${playerWindowId}`);
    mpvOptions.push("--no-osc");

    const mpvInitOptions: any = {
        debug: false
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

    mpvPlayer.observeProperty("idle-active", 13);
    mpvPlayer.observeProperty("demuxer-cache-time", 14);
    mpvPlayer.observeProperty("demuxer-cache-state", 15);

    mpvPlayer.on("timeposition", onMpvTimePosition);
    mpvPlayer.on("started", onMpvStarted);
    mpvPlayer.on("statuschange", onMpvStatusChange);
    mpvPlayer.on("stopped", onMpvStopped);
    mpvPlayer.on("error", onMpvError);
}

function processNodeRequest(req, res) {
    let body: any = [];

    req.on("data", chunk => {
        body.push(chunk);
    }).on("end", () => {
        body = Buffer.concat(body).toString();
        // at this point, `body` has the entire request body stored in it as a string

        processRequest(req, body)
            .then(json => {
                if (json != null) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(json);
                } else {
                    res.writeHead(500);
                    res.end();
                }
            })
            .catch(() => {
                res.writeHead(500);
                res.end();
            });
    });
}

export function registerMediaPlayerProtocol(protocol, mainWindow) {
    mainWindowRef = mainWindow;
    createServer(processNodeRequest).listen(8023, "127.0.0.1");
}
