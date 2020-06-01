import isRpi from "detect-rpi";
import * as url from "url";
import isWindows from "is-windows";
import * as http from "http";
import * as Mpv from "node-mpv";
import { IncomingMessage, ServerResponse } from "http";
import bind from "@chbrown/bind";
import { Protocol, BrowserWindow, screen } from "electron";
import { JsonObject } from "../common/types";
import { join } from "path";
import { mkdirSync } from "fs";

declare class Mpv {
    constructor(initOptions: JsonObject, mpvOptions: string[]);

    stop(): void;
    pause(): void;
    togglePause(): void;
    resume(): void;
    quit(): void;
    goToPosition(position: number): void;
    seek(value: number): void;
    setProperty(key: string, value: string | number | boolean): void;
    volume(volume: number): void;
    mute(): void;
    unmute(): void;
    cycleProperty(key: string): void;
    observeProperty(key: string, value: number): void;
    removeAllListeners(event: string): void;
    on(event: string, listener: (value: any) => void): void;
}

interface Stat {
    label: string;
    value: string;
}

export class PlaybackHandler {
    private timeposition = 0;
    private mainWindowRef: BrowserWindow;
    private mpvPlayer: Mpv;
    private readonly playerWindowId: string;
    private readonly mpvPath: string;
    private playMediaSource: JsonObject;
    private playMediaType: string;
    private playerStatus: JsonObject;
    private fadeInterval: NodeJS.Timeout;
    private currentVolume?: number;
    private currentPlayResolve: () => void;
    private currentPlayReject: (err: any) => void;

    public constructor(playerWindowIdString: string, mpvBinaryPath: string, mainWindow: BrowserWindow) {
        this.playerWindowId = playerWindowIdString;
        this.mpvPath = mpvBinaryPath;
        this.mainWindowRef = mainWindow;
    }

    public registerMediaPlayerProtocol(protocol: Protocol): void {
        http.createServer(this.processNodeRequest).listen(8023, "127.0.0.1");
    }

    private play(player, path): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`Play URL : ${path}`);
            this.currentPlayResolve = resolve;
            this.currentPlayReject = reject;

            if (path.toLowerCase().startsWith("http")) {
                //player.loadStream(path);
                player.loadFile(path);
            } else {
                player.loadFile(path);
            }
        });
    }

    private stop(): void {
        this.mpvPlayer.stop();
    }

    private pause(): void {
        this.mpvPlayer.pause();
    }

    private pauseToggle(): void {
        this.mpvPlayer.togglePause();
    }

    private unpause(): void {
        this.mpvPlayer.resume();
    }

    private setPosition(data): void {
        this.mpvPlayer.goToPosition(Math.round(data / 10000000));
    }

    private setAspectRatio(player: Mpv, value): void {
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
                //var size = player.getProperty("android-surface-size");
                //var aspect = parseFloat(size.split("x")[0]) / parseFloat(size.split("x")[1]);
                //player.setProperty("video-unscaled", "no");
                //player.setProperty("video-aspect", aspect);

                break;
            case "original":
                player.setProperty("video-unscaled", "downscale-big");
                player.setProperty("video-aspect", "-1");
                break;
        }
    }

    private setVolume(data: number): void {
        this.mpvPlayer.volume(data);
    }

    private mute(): void {
        this.mpvPlayer.mute();
    }

    private unmute(): void {
        this.mpvPlayer.unmute();
    }

    private videoToggle(): void {
        if (isRpi()) {
            this.mpvPlayer.cycleProperty("video");
        }
    }

    private setAudiostream(player, index: number): void {
        let audioIndex = 0;
        const streams = (this.playMediaSource.MediaStreams as JsonObject[]) || [];
        for (const stream of streams) {
            if (stream.Type == "Audio") {
                audioIndex++;
                if (stream.Index == index) {
                    break;
                }
            }
        }
        player.setProperty("aid", audioIndex);
    }

    private setSubtitlestream(player, index): void {
        if (index < 0) {
            player.setProperty("sid", "no");
        } else {
            let subIndex = 0;
            const streams = (this.playMediaSource.MediaStreams as JsonObject[]) || [];
            for (const stream of streams) {
                if (stream.Type == "Subtitle") {
                    subIndex++;

                    if (stream.Index == index) {
                        if (stream.DeliveryMethod == "External") {
                            player.addSubtitles(stream.DeliveryUrl, "cached", stream.DisplayTitle, stream.Language);
                        } else {
                            player.setProperty("sid", subIndex);
                            if (stream.Codec == "dvb_teletext") {
                                this.setDvbTeletextPage(player, stream);
                            }
                        }

                        break;
                    }
                }
            }
        }
    }

    private setDvbTeletextPage(player, stream): void {
        // cases to handle:
        // 00000000: 0001 0001 10
        // 00000000: 1088 0888
        // 00000000: 1088
        // If the stream contains multiple languages, just use the first

        const extradata = stream.Extradata;

        if (extradata && extradata.length > 13) {
            let pageNumber = parseInt(extradata.substring(11, 14));
            if (pageNumber < 100) {
                pageNumber += 800;
            }
            player.setProperty("teletext-page", pageNumber);
        }
    }

    private getMpvOptions(options, mediaType, mediaSource): string[] {
        const list: string[] = [];

        if (options.openglhq) {
            list.push("--profile=opengl-hq");
        }
        if (isRpi()) {
            list.push("--fs");
        }

        list.push(`--hwdec=${options.hwdec || "no"}`);

        if (options.deinterlace == "yes") {
            list.push(`--deinterlace=${options.deinterlace || "auto"}`);
        }

        list.push(`--video-output-levels=${options.videoOutputLevels || "auto"}`);

        if (options.videoSync) {
            list.push(`--video-sync=${options.videoSync}`);
        }

        //limitation that until we can pass the Windows monitor# (not the display name that MPV returns), is limited to Primary monitor
        if (options.displaySync) {
            const winPosition = this.mainWindowRef.getPosition();
            const winBounds = this.mainWindowRef.getBounds();
            const displayParamsActive = screen.getDisplayNearestPoint({
                x: winPosition[0],
                y: winPosition[1],
            });

            //rough test for fullscreen on playback start
            if (
                winBounds.width == displayParamsActive.size.width &&
                displayParamsActive.size.height == winBounds.height
            ) {
                const rfRate =
                    options.displaySync_Override != "" ? `,refreshrate-rates="${options.displaySync_Override}"` : "";
                const rfTheme = options.fullscreen ? "" : ",refreshrate-theme=true";

                list.push(`--script-opts=refreshrate-enabled=true${rfRate}${rfTheme}`);
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

        const audioOptions = this.getMpvAudioOptions(options, mediaType);
        for (const audioOption of audioOptions) {
            list.push(audioOption);
        }

        const videoStream = (mediaSource.MediaStreams || []).filter(function (v) {
            return v.Type == "Video";
        })[0];

        const framerate = videoStream ? videoStream.AverageFrameRate || videoStream.RealFrameRate : 0;

        const audioDelay = framerate >= 23 && framerate <= 25 ? options.audioDelay2325 : options.audioDelay;
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
            //list.push('--demuxer-lavf-hacks=no');
        }

        if (mediaSource.RunTimeTicks == null) {
            list.push("--demuxer-lavf-analyzeduration=3");
        }

        return list;
    }

    private getMpvAudioOptions(options, mediaType): string[] {
        const list: string[] = [];

        let audioChannels = options.audioChannels || "auto-safe";
        const audioFilters = [];
        if (audioChannels === "5.1") {
            audioChannels = "5.1,stereo";
        } else if (audioChannels === "7.1") {
            audioChannels = "7.1,stereo";
        }

        const audioChannelsFilter = this.getAudioChannelsFilter(options, mediaType);
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

    private getAudioChannelsFilter(options: { upmixAudioFor?: string; audioChannels?: string }, mediaType): string {
        let enableFilter = false;
        const upmixFor = (options.upmixAudioFor || "").split(",");

        if (mediaType === "Audio") {
            if (upmixFor.includes("music")) {
                enableFilter = true;
            }
        }

        //there's also a surround filter but haven't found good documentation to implement -PMR 20171225
        if (enableFilter) {
            const audioChannels = options.audioChannels || "";
            if (audioChannels === "5.1") {
                //return 'channels=6';
                return "pan=5.1|FL=FL|BL=FL|FR=FR|BR=FR|FC<0.5*FL + 0.5*FR";
            } else if (audioChannels === "7.1") {
                //return 'channels=8';
                return "pan=7.1|FL=FL|SL=FL|BL=FL|FR=FR|SR=FR|BR=FR|FC<0.5*FL + 0.5*FR";
            }
        }

        return "";
    }

    private fade(startingVolume): Promise<void> {
        let volume: number = startingVolume;
        let res: () => void;
        let rej: (err: any) => void;

        const finishedPromise = new Promise<void>((resolve, reject) => {
            res = resolve;
            rej = reject;
        });

        this.fadeInterval = setInterval(() => {
            try {
                volume = Math.max(0, volume - 0.15);
                if (volume <= 0) {
                    this.cancelFade();
                    this.setVolume(0);
                    res();
                } else {
                    this.setVolume(volume);
                }
            } catch (e) {
                this.cancelFade();
                rej(e);
            }
        }, 1);

        return finishedPromise;
    }

    private cancelFade(): void {
        const interval = this.fadeInterval;
        if (interval) {
            clearInterval(interval);
            this.fadeInterval = undefined;
        }
    }

    private cleanup(): void {
        const player = this.mpvPlayer;

        player.removeAllListeners("timeposition");
        player.removeAllListeners("started");
        player.removeAllListeners("statuschange");
        player.removeAllListeners("stopped");

        try {
            player.quit();
        } catch (err) {
            console.log(`Error quitting mpv: ${err}`);
        }

        delete this.mpvPlayer;

        this.mpvPlayer = undefined;
        this.playMediaSource = undefined;
        this.playMediaType = undefined;
        this.playerStatus = undefined;
    }

    private getReturnJson(positionTicks?: number): Promise<string> {
        let playState = "playing";
        if (this.playerStatus.pause) {
            playState = "paused";
        }

        if (this.playerStatus["idle-active"]) {
            playState = "idle";
        }

        const state: JsonObject = {
            isPaused: this.playerStatus.pause || false,
            isMuted: this.playerStatus.mute || false,
            volume: this.currentVolume || this.playerStatus.volume || 100,
            positionTicks: positionTicks || this.timeposition,
            playstate: playState,
            demuxerCacheState: this.playerStatus["demuxer-cache-state"],
        };

        if (this.playerStatus.duration) {
            state.durationTicks = (this.playerStatus.duration as number) * 10000000;
        } else if (this.playerStatus["demuxer-cache-time"]) {
            state.durationTicks = (this.playerStatus["demuxer-cache-time"] as number) * 10000000;
        }

        return Promise.resolve(JSON.stringify(state));
    }

    private getAudioStats(
        player
    ): Promise<{
        stats: Stat[];
        type: "audio";
    }> {
        const properties = [
            { property: "audio-codec-name" },
            { property: "audio-out-params" },
            { property: "audio-bitrate", name: "Audio bitrate:", type: "bitrate" },
            { property: "current-ao", name: "Audio renderer:" },
            { property: "audio-out-detected-device", name: "Audio output device:" },
        ];

        const promises = properties.map((p) => player.getProperty(p.property));

        return Promise.all(promises).then((responses) => {
            const stats: Stat[] = [];

            if (responses[0]) {
                stats.push({
                    label: "Audio codec:",
                    value: responses[0],
                });
            }

            const audioParams = responses[1] || {};

            if (audioParams.channels) {
                stats.push({
                    label: "Audio channels:",
                    value: audioParams.channels,
                });
            }
            if (audioParams.samplerate) {
                stats.push({
                    label: "Audio sample rate:",
                    value: audioParams.samplerate,
                });
            }

            let i = 2;
            const length = properties.length;
            // noinspection DuplicatedCode
            for (; i < length; i++) {
                const name = properties[i].name;

                let value = responses[i];

                if (properties[i].type == "bitrate") {
                    value = this.getDisplayBitrate(value);
                }

                if (value != null) {
                    stats.push({
                        label: name,
                        value: value,
                    });
                }
            }
            return {
                stats: stats,
                type: "audio",
            };
        });
    }

    private getDisplayBitrate(bitrate): string {
        if (bitrate > 1000000) {
            return `${(bitrate / 1000000).toFixed(1)} Mbps`;
        } else {
            return `${Math.floor(bitrate / 1000)} kbps`;
        }
    }

    private getDroppedFrames(responses): string {
        // TODO: unsafe?
        let html = "";

        html += responses[responses.length - 4] || "0";

        html += `, Decoder dropped: ${responses[responses.length - 3] || "0"}`;

        html += `, Mistimed: ${responses[responses.length - 2] || "0"}`;

        html += `, Delayed: ${responses[responses.length - 1] || "0"}`;

        return html;
    }

    private getVideoStats(
        player
    ): Promise<{
        stats: Stat[];
        type: "video";
    }> {
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
            { property: "vo-delayed-frame-count" },
        ];

        const promises = properties.map(function (p) {
            return player.getProperty(p.property);
        });

        return Promise.all(promises).then((responses) => {
            const stats = [];

            const videoParams = responses[0] || {};

            let i = 1;
            const length = properties.length - 4;
            // noinspection DuplicatedCode
            for (; i < length; i++) {
                const name = properties[i].name;

                let value = responses[i];

                if (properties[i].type == "bitrate") {
                    value = this.getDisplayBitrate(value);
                }

                if (value != null) {
                    stats.push({
                        label: name,
                        value: value,
                    });
                }
            }

            stats.push({
                label: "Dropped frames:",
                value: this.getDroppedFrames(responses),
            });

            const winPosition = this.mainWindowRef.getPosition();
            const displayParams = screen.getDisplayNearestPoint({
                x: winPosition[0],
                y: winPosition[1],
            });

            stats.push({
                label: "Display Fullscreen Resolution:",
                value: `${displayParams.size.width} x ${displayParams.size.height}`,
            });

            if (videoParams.w && videoParams.h) {
                stats.push({
                    label: "Video resolution:",
                    value: `${videoParams.w} x ${videoParams.h}`,
                });
            }

            if (videoParams.aspect) {
                stats.push({
                    label: "Aspect ratio:",
                    value: videoParams.aspect,
                });
            }

            if (videoParams.pixelformat) {
                stats.push({
                    label: "Pixel format:",
                    value: videoParams.pixelformat,
                });
            }

            if (videoParams.colormatrix) {
                stats.push({
                    label: "Color matrix:",
                    value: videoParams.colormatrix,
                });
            }

            if (videoParams.primaries) {
                stats.push({
                    label: "Primaries:",
                    value: videoParams.primaries,
                });
            }

            if (videoParams.gamma) {
                stats.push({
                    label: "Gamma:",
                    value: videoParams.gamma,
                });
            }

            if (videoParams.colorlevels) {
                stats.push({
                    label: "Levels:",
                    value: videoParams.colorlevels,
                });
            }

            return {
                stats: stats,
                type: "video",
            };
        });
    }

    private getMediaStats(
        player
    ): Promise<{
        stats: Stat[];
        type: "media";
    }> {
        const properties = [
            { property: "media-title", name: "Title:" },
            { property: "chapter", name: "Chapter:" },
        ];

        const promises = properties.map((p) => player.getProperty(p.property));

        return Promise.all(promises).then((responses) => {
            const stats = [];

            let i = 0;
            const length = properties.length;
            for (; i < length; i++) {
                const name = properties[i].name;

                const value = responses[i];

                if (value != null) {
                    stats.push({
                        label: name,
                        value: value,
                    });
                }
            }
            return {
                stats: stats,
                type: "media",
            };
        });
    }

    private getStatsJson(player): Promise<string> {
        return Promise.all([this.getMediaStats(player), this.getVideoStats(player), this.getAudioStats(player)]).then(
            (responses) => {
                const categories = [];

                for (const response of responses) {
                    categories.push(response);
                }

                return JSON.stringify({
                    categories: categories,
                });
            }
        );
    }

    private processRequest(request, body): Promise<string> {
        return new Promise((resolve, reject) => {
            const urlParts = url.parse(request.url, true);
            const action = urlParts.pathname.substring(1).toLowerCase();

            let data: any;
            let startPositionTicks: number;

            switch (action) {
                case "play":
                    data = JSON.parse(body);
                    this.playMediaSource = data.mediaSource;
                    this.createMpv(data.playerOptions, data.mediaType, this.playMediaSource);
                    this.playMediaType = data.mediaType;

                    startPositionTicks = data["startPositionTicks"];

                    this.mpvPlayer.volume(data.playerOptions.volume || 100);

                    this.play(this.mpvPlayer, data.path)
                        .then(() => {
                            if (
                                this.playMediaSource.DefaultAudioStreamIndex !== null &&
                                data.playMethod != "Transcode"
                            ) {
                                this.setAudiostream(
                                    this.mpvPlayer,
                                    this.playMediaSource.DefaultAudioStreamIndex as number
                                );
                            }

                            if (this.playMediaSource.DefaultSubtitleStreamIndex !== null) {
                                this.setSubtitlestream(this.mpvPlayer, this.playMediaSource.DefaultSubtitleStreamIndex);
                            } else {
                                this.setSubtitlestream(this.mpvPlayer, -1);
                            }

                            if (startPositionTicks !== 0) {
                                this.setPosition(startPositionTicks);
                            }

                            this.getReturnJson(startPositionTicks).then(resolve);
                        })
                        .catch(reject);

                    break;
                case "stats":
                    if (this.mpvPlayer) {
                        this.getStatsJson(this.mpvPlayer).then(resolve);
                    } else {
                        resolve("[]");
                    }
                    break;
                case "stop":
                    this.stop();
                    this.getReturnJson().then(resolve);
                    break;
                case "stopdestroy":
                    this.getReturnJson().then((returnJson) => {
                        if (this.playMediaType.toLowerCase() === "audio") {
                            this.currentVolume = (this.playerStatus.volume as number) || 100;
                            this.fade(this.currentVolume)
                                .then(() => {
                                    this.stop();
                                    this.setVolume(this.currentVolume);
                                    this.currentVolume = null;
                                    this.cleanup();
                                })
                                .catch(reject);
                        } else {
                            this.stop();
                            this.cleanup();
                        }

                        resolve(returnJson);
                    });

                    break;
                case "positionticks":
                    data = urlParts.query["val"];
                    this.setPosition(data);
                    this.timeposition = data;
                    this.getReturnJson().then(resolve);
                    break;
                case "seekrelative":
                    data = urlParts.query["val"];
                    this.mpvPlayer.seek(Math.round(data / 10000000));
                    //timeposition = (timeposition || 0) + data;
                    this.getReturnJson().then(resolve);
                    break;
                case "unpause":
                    this.unpause();
                    this.getReturnJson().then(resolve);
                    break;
                case "playpause":
                    this.pauseToggle();
                    this.getReturnJson().then(resolve);
                    break;
                case "pause":
                    this.pause();
                    this.getReturnJson().then(resolve);
                    break;
                case "volumeup":
                    this.setVolume(
                        Math.min(100, (this.currentVolume || (this.playerStatus.volume as number) || 100) + 2)
                    );
                    this.getReturnJson().then(resolve);
                    break;
                case "volumedown":
                    this.setVolume(
                        Math.max(1, (this.currentVolume || (this.playerStatus.volume as number) || 100) - 2)
                    );
                    this.getReturnJson().then(resolve);
                    break;
                case "volume":
                    data = urlParts.query["val"];
                    this.setVolume(data);
                    this.getReturnJson().then(resolve);
                    break;
                case "aspectratio":
                    data = urlParts.query["val"];
                    this.setAspectRatio(this.mpvPlayer, data);
                    this.getReturnJson().then(resolve);
                    break;
                case "mute":
                    this.mute();
                    this.getReturnJson().then(resolve);
                    break;
                case "unmute":
                    this.unmute();
                    this.getReturnJson().then(resolve);
                    break;
                case "setaudiostreamindex":
                    data = urlParts.query["index"];
                    this.setAudiostream(this.mpvPlayer, data);
                    this.getReturnJson().then(resolve);
                    break;
                case "setsubtitlestreamindex":
                    data = urlParts.query["index"];
                    this.setSubtitlestream(this.mpvPlayer, data);
                    this.getReturnJson().then(resolve);
                    break;
                case "video_toggle":
                    this.videoToggle();
                    this.getReturnJson().then(resolve);
                    break;
                default:
                    // This could be a refresh, e.g. player polling for data
                    this.getReturnJson().then(resolve);
                    break;
            }
        });
    }

    @bind
    private onMpvTimePosition(data): void {
        this.timeposition = data * 10000000;
    }

    @bind
    private onMpvStarted(): void {
        const resolve = this.currentPlayResolve;
        if (resolve) {
            this.currentPlayResolve = null;
            this.currentPlayReject = null;
            resolve();
        }
        this.mainWindowRef.focus();
    }

    @bind
    private onMpvStatusChange(status): void {
        this.playerStatus = status;
    }

    @bind
    private onMpvStopped(): void {
        this.timeposition = 0;
    }

    @bind
    private onMpvError(): void {
        this.onMpvStopped();
        this.cleanup();
    }

    private createMpv(options: {}, mediaType, mediaSource): void {
        if (this.mpvPlayer) return;
        console.info("Starting mpv...");
        const mpvOptions = this.getMpvOptions(options, mediaType, mediaSource);

        mpvOptions.push(`--wid=${this.playerWindowId}`);
        mpvOptions.push("--no-osc");

        const mpvInitOptions: JsonObject = {
            debug: false,
        };

        if (this.mpvPath) {
            mpvInitOptions.binary = this.mpvPath;
        }

        // Create private sockets
        if (isWindows()) {
            mpvInitOptions.socket = `\\\\.\\pipe\\jellyfin-pipe-${process.pid}`;
            // eslint-disable-next-line @typescript-eslint/camelcase
            mpvInitOptions.ipc_command = "--input-ipc-server";
        } else {
            const sockDir = `/run/jellyfin-desktop/${process.pid}`;
            mkdirSync(sockDir, { recursive: true });
            mpvInitOptions.socket = join(sockDir, "jellyfin.sock");
            // eslint-disable-next-line @typescript-eslint/camelcase
            mpvInitOptions.ipc_command = "--input-unix-socket";
        }

        this.mpvPlayer = new Mpv(mpvInitOptions, mpvOptions);

        this.mpvPlayer.observeProperty("idle-active", 13);
        this.mpvPlayer.observeProperty("demuxer-cache-time", 14);
        this.mpvPlayer.observeProperty("demuxer-cache-state", 15);

        this.mpvPlayer.on("timeposition", this.onMpvTimePosition);
        this.mpvPlayer.on("started", this.onMpvStarted);
        this.mpvPlayer.on("statuschange", this.onMpvStatusChange);
        this.mpvPlayer.on("stopped", this.onMpvStopped);
        this.mpvPlayer.on("error", this.onMpvError);
    }

    @bind
    private processNodeRequest(req: IncomingMessage, res: ServerResponse): void {
        const body = [];

        req.on("data", function (chunk) {
            body.push(chunk);
        }).on("end", () => {
            const buffer = Buffer.concat(body).toString();
            // at this point, `body` has the entire request body stored in it as a string

            this.processRequest(req, buffer)
                .then((json) => {
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
}
