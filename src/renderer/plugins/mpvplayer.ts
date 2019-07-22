import { Remote } from "comlink";
import { TheaterApi } from "../../shell/api";
import { IMpvState } from "../../types";

define([
    "globalize",
    "apphost",
    "playbackManager",
    "pluginManager",
    "events",
    "appRouter",
    "appSettings",
    "userSettings",
    "loading",
    "dom",
    "require",
    "connectionManager"
], (
    globalize,
    appHost,
    playbackManager,
    pluginManager,
    events,
    appRouter,
    appSettings,
    userSettings,
    loading,
    dom,
    require,
    connectionManager
): (() => any) => {
    "use strict";

    function getTextTrackUrl(subtitleStream, serverId) {
        return playbackManager.getSubtitleUrl(subtitleStream, serverId);
    }

    const api: Remote<TheaterApi> = window["theaterApi"];

    class MpvPlayer {
        public name = "MPV";
        public type = "mediaplayer";
        public id = "mpvmediaplayer";
        public priority = -1;

        public currentSrc_;
        public playerState: IMpvState = {
            volume: parseInt(appSettings.get("mpv-volume") || "100", 10)
        };
        public ignoreEnded;
        public videoDialog;
        public currentAspectRatio = "bestfit";

        public supportedFeatures: string[];

        public timeUpdateInterval;

        constructor() {
            document.addEventListener("video-osd-show", async () => {
                // alert("OSD Shown");
                await this.sendCommand("video_toggle");
            });

            document.addEventListener("video-osd-hide", async () => {
                // alert("OSD Hidden");
                await this.sendCommand("video_toggle");
            });
        }

        public getRoutes() {
            const routes = [];

            routes.push({
                path: "mpvplayer/audio.html",
                transition: "slide",
                controller: pluginManager.mapPath(this, "mpvplayer/audio.js"),
                type: "settings",
                title: "Audio",
                category: "Playback",
                thumbImage: ""
            });

            if (appHost.supports("windowtransparency")) {
                routes.push({
                    path: "mpvplayer/video.html",
                    transition: "slide",
                    controller: pluginManager.mapPath(
                        this,
                        "mpvplayer/video.js"
                    ),
                    type: "settings",
                    title: "Video",
                    category: "Playback",
                    thumbImage: ""
                });
            }

            return routes;
        }

        public getTranslations() {
            const files: Array<{
                lang: string;
                path: string;
            }> = [];

            files.push({
                lang: "cs",
                path: pluginManager.mapPath(this, "mpvplayer/strings/cs.json")
            });

            files.push({
                lang: "en-us",
                path: pluginManager.mapPath(
                    this,
                    "mpvplayer/strings/en-US.json"
                )
            });

            files.push({
                lang: "en-GB",
                path: pluginManager.mapPath(
                    this,
                    "mpvplayer/strings/en-GB.json"
                )
            });

            files.push({
                lang: "fr",
                path: pluginManager.mapPath(this, "mpvplayer/strings/fr.json")
            });

            files.push({
                lang: "hr",
                path: pluginManager.mapPath(this, "mpvplayer/strings/hr.json")
            });

            files.push({
                lang: "it",
                path: pluginManager.mapPath(this, "mpvplayer/strings/it.json")
            });

            files.push({
                lang: "lt-LT",
                path: pluginManager.mapPath(
                    this,
                    "mpvplayer/strings/lt-LT.json"
                )
            });

            files.push({
                lang: "pl",
                path: pluginManager.mapPath(this, "mpvplayer/strings/pl.json")
            });

            files.push({
                lang: "pt-PT",
                path: pluginManager.mapPath(
                    this,
                    "mpvplayer/strings/pt-PT.json"
                )
            });

            files.push({
                lang: "ru",
                path: pluginManager.mapPath(this, "mpvplayer/strings/ru.json")
            });

            files.push({
                lang: "sv",
                path: pluginManager.mapPath(this, "mpvplayer/strings/sv.json")
            });

            files.push({
                lang: "zh-CN",
                path: pluginManager.mapPath(
                    this,
                    "mpvplayer/strings/zh-CN.json"
                )
            });

            return files;
        }

        public canPlayMediaType(mediaType) {
            if ((mediaType || "").toLowerCase() === "video") {
                return appHost.supports("windowtransparency");
            }
            return (mediaType || "").toLowerCase() === "audio";
        }

        public getDirectPlayProtocols() {
            return ["File", "Http", "Rtp", "Rtmp", "Rtsp", "Ftp"];
        }

        public currentSrc() {
            return this.currentSrc_;
        }

        public async play(options) {
            await this.createMediaElement(options);
            await this.playInternal(options);
        }

        public getCurrentTime() {
            return (this.playerState.positionTicks || 0) / 10000;
        }

        // Save this for when playback stops, because querying the time at that point might return 0
        public async setCurrentTime(val) {
            await this.sendCommand("positionticks", { val: val * 10000 });
            events.trigger(this, "seek");
            await this.onTimeUpdate();
            return;
        }

        public async rewind(offsetMs) {
            await this.seekRelative(0 - offsetMs);
        }

        public async fastForward(offsetMs) {
            await this.seekRelative(offsetMs);
        }

        public duration(val) {
            if (typeof this.playerState.durationTicks !== "number") {
                return null;
            }

            return this.playerState.durationTicks / 10000;
        }

        public async stop(destroyPlayer) {
            const cmd = destroyPlayer ? "stopdestroy" : "stop";

            await this.sendCommand(cmd);
            this.onEnded();

            if (destroyPlayer) {
                await this.destroyInternal(false);
            }
        }

        public async destroy() {
            await this.destroyInternal(true);
        }

        public async playPause() {
            const state = await this.sendCommand("playpause");
            if (state.isPaused) {
                this.onPause();
            } else {
                this.onUnpause();
            }
        }

        public async pause() {
            await this.sendCommand("pause");
            this.onPause();
        }

        public async unpause() {
            await this.sendCommand("unpause");
            this.onUnpause();
        }

        public paused() {
            return this.playerState.isPaused || false;
        }

        public async volumeUp(val) {
            await this.sendCommand("volumeUp");
            this.onVolumeChange();
        }

        public async volumeDown(val) {
            await this.sendCommand("volumeDown");
            this.onVolumeChange();
        }

        public getVolume() {
            return this.playerState.volume || 0;
        }

        public async setVolume(val) {
            this.sendCommand("volume", { val }).then(this.onVolumeChange);
        }

        public async setSubtitleStreamIndex(index) {
            await this.sendCommand("setSubtitleStreamIndex", { index });
        }

        public async setAudioStreamIndex(index) {
            await this.sendCommand("setAudioStreamIndex?index=", { index });
        }

        public canSetAudioStreamIndex = () => true;

        public async setMute(mute: "mute" | "unmute") {
            const cmd = mute ? "mute" : "unmute";

            await this.sendCommand(cmd);
            this.onVolumeChange();
        }

        public isMuted() {
            return this.playerState.isMuted || false;
        }

        public async getStats() {
            await this.sendCommand("stats");
        }

        public supports(feature) {
            if (!this.supportedFeatures) {
                this.supportedFeatures = this.getSupportedFeatures();
            }

            return this.supportedFeatures.includes(feature);
        }

        public async setAspectRatio(val) {
            this.currentAspectRatio = val;
            await this.sendCommand("aspectratio", { val });
        }

        public getAspectRatio() {
            return this.currentAspectRatio;
        }

        public getSupportedAspectRatios() {
            return [
                { name: "4:3", id: "4_3" },
                { name: "16:9", id: "16_9" },
                {
                    name: globalize.translate("sharedcomponents#Auto"),
                    id: "bestfit"
                },
                // { name: globalize.translate('sharedcomponents#Fill'), id: 'fill' },
                {
                    name: globalize.translate("sharedcomponents#Original"),
                    id: "original"
                }
            ];
        }

        public getBufferedRanges() {
            const cacheState = this.playerState.demuxerCacheState;
            if (cacheState) {
                const ranges = cacheState["seekable-ranges"];

                if (ranges) {
                    return ranges.map(this.mapRange);
                }
            }
            return [];
        }

        public seekable = () => true;

        private onNavigatedToOsd() {
            if (this.videoDialog) {
                this.videoDialog.classList.remove(
                    "mpv-videoPlayerContainer-withBackdrop"
                );
                this.videoDialog.classList.remove(
                    "mpv-videoPlayerContainer-onTop"
                );
            }
        }

        private async createMediaElement(options) {
            if (options.mediaType !== "Video") {
                return;
            }

            return new Promise(resolve => {
                let dlg: HTMLElement = document.querySelector(
                    ".mpv-videoPlayerContainer"
                );

                if (!dlg) {
                    require(["css!./mpvplayer"], () => {
                        loading.show();

                        dlg = document.createElement("div");

                        dlg.classList.add("mpv-videoPlayerContainer");

                        if (options.backdropUrl) {
                            dlg.classList.add(
                                "mpv-videoPlayerContainer-withBackdrop"
                            );
                            dlg.style.backgroundImage = `url('${options.backdropUrl}')`;
                        }

                        if (options.fullscreen) {
                            dlg.classList.add("mpv-videoPlayerContainer-onTop");
                        }

                        document.body.insertBefore(
                            dlg,
                            document.body.firstChild
                        );
                        this.videoDialog = dlg;

                        if (options.fullscreen) {
                            this.zoomIn(dlg).then(resolve);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    if (options.backdropUrl) {
                        dlg.classList.add(
                            "mpv-videoPlayerContainer-withBackdrop"
                        );
                        dlg.style.backgroundImage = `url('${options.backdropUrl}')`;
                    }

                    resolve();
                }
            });
        }

        private async playInternal(options: {
            item: {
                MediaType: string;
                ServerId: any;
                Type: string;
            };
            url: string;
            mediaSource: {
                MediaStreams: Array<{
                    Type: string;
                    DeliveryMethod: string;
                    DeliveryUrl: string;
                }>;
                RunTimeTicks: number;
            };
            fullscreen: boolean;
            playMethod: any;
            playerStartPositionTicks?: number;
            mediaType: any;
        }) {
            const item = options.item;
            const mediaSource = options.mediaSource;

            const url = options.url;

            this.ignoreEnded = false;
            this.currentSrc_ = url;
            this.currentAspectRatio = "bestfit";

            // var isVideo = options.mimeType.toLowerCase('video').indexOf() == 0;
            const isVideo = options.item.MediaType === "Video";

            for (const track of mediaSource.MediaStreams) {
                if (track.Type === "Subtitle") {
                    if (track.DeliveryMethod === "External") {
                        track.DeliveryUrl = getTextTrackUrl(
                            track,
                            item.ServerId
                        );
                    }
                }
            }

            const enableFullscreen = options.fullscreen !== false;

            const subtitleAppearanceSettings = userSettings.getSubtitleAppearanceSettings();
            let fontSize;
            switch (subtitleAppearanceSettings.textSize || "") {
                case "smaller":
                    fontSize = 35;
                    break;
                case "small":
                    fontSize = 45;
                    break;
                case "larger":
                    fontSize = 75;
                    break;
                case "extralarge":
                    fontSize = 85;
                    break;
                case "large":
                    fontSize = 65;
                    break;
                default:
                    break;
            }
            let fontFamily;
            switch (subtitleAppearanceSettings.font || "") {
                case "smallcaps":
                case "typewriter":
                case "console":
                    fontFamily = "monospace";
                    break;
                case "print":
                    fontFamily = "Times New Roman";
                    break;
                case "cursive":
                    fontFamily = "cursive";
                    break;
                case "casual":
                    fontFamily = "Comic Sans MS";
                    break;
                default:
                    break;
            }

            const requestBody = {
                path: url,
                isVideo,
                playMethod: options.playMethod,
                // item: options.item,
                mediaSource,
                startPositionTicks: options.playerStartPositionTicks || 0,
                fullscreen: enableFullscreen,
                mediaType: options.mediaType,
                playerOptions: {
                    dynamicRangeCompression:
                        parseInt(appSettings.get("mpv-drc") || "0", 10) / 100,
                    audioChannels: appSettings.get("mpv-speakerlayout"),
                    audioSpdif: appSettings.get("mpv-audiospdif"),
                    videoOutputLevels: appSettings.get("mpv-outputlevels"),
                    deinterlace: appSettings.get("mpv-deinterlace"),
                    hwdec: appSettings.get("mpv-hwdec"),
                    upmixAudioFor: appSettings.get("mpv-upmixaudiofor"),
                    scale: appSettings.get("mpv-scale"),
                    cscale: appSettings.get("mpv-cscale"),
                    dscale: appSettings.get("mpv-dscale"),
                    tscale: appSettings.get("mpv-tscale"),
                    ditherdepth: appSettings.get("mpv-ditherdepth"),
                    videoStereoMode: appSettings.get("mpv-videostereomode"),
                    openglhq: appSettings.get("mpv-openglhq") === "true",
                    exclusiveAudio:
                        appSettings.get("mpv-exclusiveaudio") === "true",
                    videoSync:
                        appSettings.get("mpv-videosync") === "true"
                            ? "display-resample"
                            : null,
                    displaySync: appSettings.get("mpv-displaysync") === "true",
                    displaySync_Override: appSettings.get(
                        "mpv-displaysync_override"
                    ),
                    interpolation:
                        appSettings.get("mpv-interpolation") === "true",
                    correctdownscaling:
                        appSettings.get("mpv-correctdownscaling") === "true",
                    sigmoidupscaling:
                        appSettings.get("mpv-sigmoidupscaling") === "true",
                    deband: appSettings.get("mpv-deband") === "true",
                    fullscreen: enableFullscreen,
                    // genPts: mediaSource.RunTimeTicks ? false : true,
                    audioDelay: parseInt(
                        appSettings.get("mpv-audiodelay") || "0",
                        10
                    ),
                    audioDelay2325: parseInt(
                        appSettings.get("mpv-audiodelay2325") || 0,
                        10
                    ),
                    largeCache:
                        mediaSource.RunTimeTicks === null ||
                        options.item.Type === "Recording",
                    subtitleFontSize: fontSize,
                    subtitleFontFamily: fontFamily,
                    volume: this.playerState.volume || 100
                }
            };

            this.playerState.volume = requestBody.playerOptions.volume;

            try {
                await this.sendCommand("play", requestBody);
            } catch (e) {
                this.stopTimeUpdateInterval();
                throw e;
            }
            if (isVideo) {
                if (enableFullscreen) {
                    await appRouter.showVideoOsd();
                    this.onNavigatedToOsd();
                } else {
                    appRouter.setTransparency("backdrop");

                    if (this.videoDialog) {
                        this.videoDialog.classList.remove(
                            "mpv-videoPlayerContainer-withBackdrop"
                        );
                        this.videoDialog.classList.remove(
                            "mpv-videoPlayerContainer-onTop"
                        );
                    }
                }
            }

            this.startTimeUpdateInterval();
        }

        private async seekRelative(offsetMs) {
            await this.sendCommand("seekrelative", {
                val: offsetMs * 10000
            });
            events.trigger(this, "seek");
            await this.onTimeUpdate();
        }

        private async destroyInternal(destroyCommand) {
            if (destroyCommand) {
                await this.sendCommand("stopdestroy");
            }

            appRouter.setTransparency("none");

            const dlg = this.videoDialog;
            if (dlg) {
                this.videoDialog = null;

                dlg.parentNode.removeChild(dlg);
            }
        }

        private mapRange(range) {
            let offset;
            // var currentPlayOptions = instance._currentPlayOptions;
            // if (currentPlayOptions) {
            //    offset = currentPlayOptions.transcodingOffsetTicks;
            // }

            offset = offset || 0;

            return {
                start: range.start * 10000000 + offset,
                end: range.end * 10000000 + offset
            };
        }

        private getSupportedFeatures() {
            const list = [];

            list.push("SetAspectRatio");

            return list;
        }

        private startTimeUpdateInterval() {
            this.stopTimeUpdateInterval();
            this.timeUpdateInterval = setInterval(this.onTimeUpdate, 250);
        }

        private stopTimeUpdateInterval() {
            if (this.timeUpdateInterval) {
                clearInterval(this.timeUpdateInterval);
                this.timeUpdateInterval = null;
            }
        }

        private onEnded() {
            this.stopTimeUpdateInterval();

            if (!this.ignoreEnded) {
                this.ignoreEnded = true;
                events.trigger(this, "stopped");
            }
        }

        private async onTimeUpdate() {
            await this.updatePlayerState();
            events.trigger(this, "timeupdate");
        }

        private onVolumeChange() {
            appSettings.set("mpv-volume", this.getVolume());
            events.trigger(this, "volumechange");
        }

        private onUnpause() {
            events.trigger(this, "unpause");
        }

        private onPause() {
            events.trigger(this, "pause");
        }

        private onError() {
            this.stopTimeUpdateInterval();
            events.trigger(this, "error");
        }

        private zoomIn(elem) {
            return new Promise(resolve => {
                const duration = 240;
                elem.style.animation = `mpvvideoplayer-zoomin ${duration}ms ease-in normal`;
                dom.addEventListener(elem, dom.whichAnimationEvent(), resolve, {
                    once: true
                });
            });
        }

        private async sendCommand(
            name: string,
            body?: any
        ): Promise<IMpvState> {
            const state = await api.mpvCommand(name, body);

            const previousPlayerState = this.playerState;

            if (
                state.playstate === "idle" &&
                previousPlayerState.playstate !== "idle" &&
                previousPlayerState.playstate
            ) {
                this.onEnded();
                return this.playerState;
            }

            this.playerState = state;

            if (
                previousPlayerState.isMuted !== state.isMuted ||
                previousPlayerState.volume !== state.volume
            ) {
                this.onVolumeChange();
            }

            if (previousPlayerState.isPaused !== state.isPaused) {
                if (state.isPaused) {
                    this.onPause();
                } else if (previousPlayerState.isPaused) {
                    this.onUnpause();
                }
            }
            return state;
        }

        private updatePlayerState() {
            return this.sendCommand("refresh");
        }
    }

    return () => new MpvPlayer();
});
