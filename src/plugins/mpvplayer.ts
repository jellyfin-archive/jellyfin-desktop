import { JsonObject } from "../utils/types";
import bind from "@chbrown/bind";

interface Route {
    path: string;
    transition: string;
    controller: string;
    type: string;
    title: string;
    category: string;
    thumbImage: string;
}

interface TranslationFile {
    lang: string;
    path: string;
}

interface PlayerState {
    playstate?: string;
    demuxerCacheState?: any;
    isMuted?: boolean;
    isPaused?: boolean;
    durationTicks?: number;
    positionTicks?: number;
    volume: number;
}

interface Range {
    start: number;
    end: number;
}

define([
    "globalize",
    "apphost",
    "playbackManager",
    "pluginManager",
    "events",
    "embyRouter",
    "appSettings",
    "userSettings",
    "loading",
    "dom",
    "require",
    "connectionManager",
], function (
    globalize,
    appHost,
    playbackManager,
    pluginManager,
    events,
    embyRouter,
    appSettings,
    userSettings,
    loading,
    dom,
    require,
    connectionManager
) {
    function getTextTrackUrl(subtitleStream: any, serverId: string): string {
        return playbackManager.getSubtitleUrl(subtitleStream, serverId);
    }

    class MpvPlayer {
        name = "MPV";
        type = "mediaplayer";
        id = "mpvmediaplayer";
        priority = -1;

        private currentInternalSrc: string;
        private playerState: PlayerState = {
            volume: parseInt(appSettings.get("mpv-volume") || "100"),
        };
        private ignoreEnded;
        private videoDialog: HTMLDivElement | null;
        private currentAspectRatio = "bestfit";

        constructor() {
            document.addEventListener("video-osd-show", () => {
                //alert("OSD Shown");
                this.sendCommand("video_toggle");
            });

            document.addEventListener("video-osd-hide", () => {
                //alert("OSD Hidden");
                this.sendCommand("video_toggle");
            });
        }

        public getRoutes(): Route[] {
            const routes: Route[] = [];

            routes.push({
                path: "mpvplayer/audio.html",
                transition: "slide",
                controller: pluginManager.mapPath(this, "mpvplayer/audio.js"),
                type: "settings",
                title: "Audio",
                category: "Playback",
                thumbImage: "",
            });

            if (appHost.supports("windowtransparency")) {
                routes.push({
                    path: "mpvplayer/video.html",
                    transition: "slide",
                    controller: pluginManager.mapPath(this, "mpvplayer/video.js"),
                    type: "settings",
                    title: "Video",
                    category: "Playback",
                    thumbImage: "",
                });
            }

            return routes;
        }

        public getTranslations(): TranslationFile[] {
            const files: TranslationFile[] = [];

            files.push({
                lang: "cs",
                path: this.mapResPath("mpvplayer/strings/cs.json"),
            });

            files.push({
                lang: "en-us",
                path: this.mapResPath("mpvplayer/strings/en-US.json"),
            });

            files.push({
                lang: "en-GB",
                path: this.mapResPath("mpvplayer/strings/en-GB.json"),
            });

            files.push({
                lang: "fr",
                path: this.mapResPath("mpvplayer/strings/fr.json"),
            });

            files.push({
                lang: "hr",
                path: this.mapResPath("mpvplayer/strings/hr.json"),
            });

            files.push({
                lang: "it",
                path: this.mapResPath("mpvplayer/strings/it.json"),
            });

            files.push({
                lang: "lt-LT",
                path: this.mapResPath("mpvplayer/strings/lt-LT.json"),
            });

            files.push({
                lang: "pl",
                path: this.mapResPath("mpvplayer/strings/pl.json"),
            });

            files.push({
                lang: "pt-PT",
                path: this.mapResPath("mpvplayer/strings/pt-PT.json"),
            });

            files.push({
                lang: "ru",
                path: this.mapResPath("mpvplayer/strings/ru.json"),
            });

            files.push({
                lang: "sv",
                path: this.mapResPath("mpvplayer/strings/sv.json"),
            });

            files.push({
                lang: "zh-CN",
                path: this.mapResPath("mpvplayer/strings/zh-CN.json"),
            });

            return files;
        }

        public canPlayMediaType(mediaType): boolean {
            if ((mediaType || "").toLowerCase() === "video") {
                return appHost.supports("windowtransparency");
            }
            return (mediaType || "").toLowerCase() === "audio";
        }

        public getDeviceProfile(item): Promise<JsonObject> {
            const profile: JsonObject = {};

            profile.MaxStreamingBitrate = 200000000;
            profile.MaxStaticBitrate = 200000000;
            profile.MusicStreamingTranscodingBitrate = 192000;

            profile.DirectPlayProfiles = [];

            // leave container null for all
            profile.DirectPlayProfiles.push({
                Type: "Video",
            });

            const apiClient = item && item.ServerId ? connectionManager.getApiClient(item.ServerId) : null;
            const supportsEmptyContainer = apiClient ? apiClient.isMinServerVersion("3.2.60.1") : false;

            if (supportsEmptyContainer) {
                // leave container null for all
                profile.DirectPlayProfiles.push({
                    Type: "Audio",
                });
            } else {
                // for older servers that don't support leaving container blank
                profile.DirectPlayProfiles.push({
                    Container: "aac,mp3,mpa,wav,wma,mp2,ogg,oga,webma,ape,opus,alac,flac,m4a",
                    Type: "Audio",
                });
            }

            profile.TranscodingProfiles = [];

            profile.TranscodingProfiles.push({
                Container: "ts",
                Type: "Video",
                AudioCodec: "ac3,mp3,aac",
                VideoCodec: "h264,mpeg2video,hevc",
                Context: "Streaming",
                Protocol: "hls",
                MaxAudioChannels: "6",
                MinSegments: "1",
                BreakOnNonKeyFrames: true,
                SegmentLength: "3",
            });

            profile.TranscodingProfiles.push({
                Container: "ts",
                Type: "Audio",
                AudioCodec: "aac",
                Context: "Streaming",
                Protocol: "hls",
                BreakOnNonKeyFrames: true,
                SegmentLength: "3",
            });

            profile.TranscodingProfiles.push({
                Container: "mp3",
                Type: "Audio",
                AudioCodec: "mp3",
                Context: "Streaming",
                Protocol: "http",
            });

            profile.ContainerProfiles = [];

            profile.CodecProfiles = [];

            // Subtitle profiles
            // External vtt or burn in
            profile.SubtitleProfiles = [];
            profile.SubtitleProfiles.push({
                Format: "srt",
                Method: "External",
            });
            profile.SubtitleProfiles.push({
                Format: "ssa",
                Method: "External",
            });
            profile.SubtitleProfiles.push({
                Format: "ass",
                Method: "External",
            });
            profile.SubtitleProfiles.push({
                Format: "srt",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "subrip",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "ass",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "ssa",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "dvb_teletext",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "dvb_subtitle",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "dvbsub",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "pgs",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "pgssub",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "dvdsub",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "vtt",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "sub",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "idx",
                Method: "Embed",
            });
            profile.SubtitleProfiles.push({
                Format: "smi",
                Method: "Embed",
            });

            profile.ResponseProfiles = [];

            return Promise.resolve(profile);
        }

        public getDirectPlayProtocols(): string[] {
            return ["File", "Http", "Rtp", "Rtmp", "Rtsp", "Ftp"];
        }

        public currentSrc(): string {
            return this.currentInternalSrc;
        }

        @bind
        private onNavigatedToOsd(): void {
            if (this.videoDialog) {
                this.videoDialog.classList.remove("mpv-videoPlayerContainer-withBackdrop");
                this.videoDialog.classList.remove("mpv-videoPlayerContainer-onTop");
            }
        }

        private createMediaElement(options): Promise<void> {
            if (options.mediaType !== "Video") {
                return Promise.resolve();
            }

            return new Promise((resolve) => {
                let dlg: HTMLDivElement = document.querySelector(".mpv-videoPlayerContainer");

                if (!dlg) {
                    require(["css!./mpvplayer"], () => {
                        loading.show();

                        dlg = document.createElement("div");

                        dlg.classList.add("mpv-videoPlayerContainer");

                        if (options.backdropUrl) {
                            dlg.classList.add("mpv-videoPlayerContainer-withBackdrop");
                            dlg.style.backgroundImage = `url('${options.backdropUrl}')`;
                        }

                        if (options.fullscreen) {
                            dlg.classList.add("mpv-videoPlayerContainer-onTop");
                        }

                        document.body.insertBefore(dlg, document.body.firstChild);
                        this.videoDialog = dlg;

                        if (options.fullscreen) {
                            this.zoomIn(dlg).then(resolve);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    if (options.backdropUrl) {
                        dlg.classList.add("mpv-videoPlayerContainer-withBackdrop");
                        dlg.style.backgroundImage = `url('${options.backdropUrl}')`;
                    }

                    resolve();
                }
            });
        }

        public play(options): Promise<void> {
            return this.createMediaElement(options).then(() => this.playInternal(options));
        }

        private playInternal(options): Promise<void> {
            const item = options.item;
            const mediaSource = JSON.parse(JSON.stringify(options.mediaSource));

            const url = options.url;

            this.ignoreEnded = false;
            this.currentInternalSrc = url;
            this.currentAspectRatio = "bestfit";

            //var isVideo = options.mimeType.toLowerCase('video').indexOf() == 0;
            const isVideo = options.item.MediaType == "Video";

            let i = 0;
            const length = mediaSource.MediaStreams.length;
            for (; i < length; i++) {
                const track = mediaSource.MediaStreams[i];

                if (track.Type === "Subtitle") {
                    if (track.DeliveryMethod === "External") {
                        track.DeliveryUrl = getTextTrackUrl(track, item.ServerId);
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

            const requestBody: JsonObject = {
                path: url,
                isVideo: isVideo,
                playMethod: options.playMethod,
                //item: options.item,
                mediaSource: mediaSource,
                startPositionTicks: options.playerStartPositionTicks || 0,
                fullscreen: enableFullscreen,
                mediaType: options.mediaType,
                playerOptions: {
                    dynamicRangeCompression: parseInt(appSettings.get("mpv-drc") || "0") / 100,
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
                    exclusiveAudio: appSettings.get("mpv-exclusiveaudio") === "true",
                    videoSync: appSettings.get("mpv-videosync") === "true" ? "display-resample" : null,
                    displaySync: appSettings.get("mpv-displaysync") === "true",
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    displaySync_Override: appSettings.get("mpv-displaysync_override"),
                    interpolation: appSettings.get("mpv-interpolation") === "true",
                    correctdownscaling: appSettings.get("mpv-correctdownscaling") === "true",
                    sigmoidupscaling: appSettings.get("mpv-sigmoidupscaling") === "true",
                    deband: appSettings.get("mpv-deband") === "true",
                    fullscreen: enableFullscreen,
                    //genPts: mediaSource.RunTimeTicks ? false : true,
                    audioDelay: parseInt(appSettings.get("mpv-audiodelay") || "0"),
                    audioDelay2325: parseInt(appSettings.get("mpv-audiodelay2325") || 0),
                    largeCache: mediaSource.RunTimeTicks == null || options.item.Type === "Recording",
                    subtitleFontSize: fontSize,
                    subtitleFontFamily: fontFamily,
                    volume: this.playerState.volume || 100,
                },
            };

            this.playerState.volume = this.playerState.volume || 100;

            return this.sendCommand("play", requestBody).then(
                () => {
                    if (isVideo) {
                        if (enableFullscreen) {
                            embyRouter.showVideoOsd().then(this.onNavigatedToOsd);
                        } else {
                            embyRouter.setTransparency("backdrop");

                            if (this.videoDialog) {
                                this.videoDialog.classList.remove("mpv-videoPlayerContainer-withBackdrop");
                                this.videoDialog.classList.remove("mpv-videoPlayerContainer-onTop");
                            }
                        }
                    }

                    this.startTimeUpdateInterval();

                    return Promise.resolve();
                },
                (err) => {
                    this.stopTimeUpdateInterval();
                    throw err;
                }
            );
        }

        // Save this for when playback stops, because querying the time at that point might return 0
        public currentTime(val: number): void;
        public currentTime(): number;
        public currentTime(val?: number): number | void {
            if (typeof val === "number") {
                this.sendCommand(`positionticks?val=${val * 10000}`).then(() => {
                    events.trigger(this, "seek");
                    this.onTimeUpdate();
                });
                return;
            }

            return (this.playerState.positionTicks || 0) / 10000;
        }

        private seekRelative(offsetMs: number): Promise<void> {
            return this.sendCommand(`seekrelative?val=${offsetMs * 10000}`).then(() => {
                events.trigger(this, "seek");
                this.onTimeUpdate();
            });
        }

        public rewind(offsetMs: number): Promise<void> {
            return this.seekRelative(-offsetMs);
        }

        public fastForward(offsetMs: number): Promise<void> {
            return this.seekRelative(offsetMs);
        }

        public duration(): number | null {
            if (this.playerState.durationTicks === null) {
                return null;
            }

            return this.playerState.durationTicks / 10000;
        }

        public stop(destroyPlayer): Promise<void> {
            const cmd = destroyPlayer ? "stopdestroy" : "stop";

            return this.sendCommand(cmd).then(() => {
                this.onEnded();

                if (destroyPlayer) {
                    this.destroyInternal(false);
                }
            });
        }

        private destroyInternal(destroyCommand): void {
            if (destroyCommand) {
                this.sendCommand("stopdestroy");
            }

            embyRouter.setTransparency("none");

            const dlg = this.videoDialog;
            if (dlg) {
                this.videoDialog = null;

                dlg.remove();
            }
        }

        public destroy(): void {
            this.destroyInternal(true);
        }

        public playPause(): Promise<void> {
            return this.sendCommand("playpause").then((state) => {
                if (state.isPaused) {
                    this.onPause();
                } else {
                    this.onUnpause();
                }
            });
        }

        public pause(): Promise<void> {
            return this.sendCommand("pause").then(this.onPause);
        }

        public unpause(): Promise<void> {
            return this.sendCommand("unpause").then(this.onUnpause);
        }

        public paused(): boolean {
            return this.playerState.isPaused || false;
        }

        public volumeUp(): Promise<void> {
            return this.sendCommand("volumeUp").then(this.onVolumeChange);
        }

        public volumeDown(): Promise<void> {
            return this.sendCommand("volumeDown").then(this.onVolumeChange);
        }

        public volume(val: number): Promise<void>;
        public volume(): number;
        public volume(val?: number): number | Promise<void> {
            if (typeof val === "number") {
                return this.sendCommand(`volume?val=${val}`).then(this.onVolumeChange);
            }

            return this.playerState.volume || 0;
        }

        public setSubtitleStreamIndex(index: number): Promise<void> {
            return this.sendCommand(`setSubtitleStreamIndex?index=${index}`);
        }

        public setAudioStreamIndex(index: number): Promise<void> {
            return this.sendCommand(`setAudioStreamIndex?index=${index}`);
        }

        public canSetAudioStreamIndex(): boolean {
            return true;
        }

        public setMute(mute: boolean): Promise<void> {
            const cmd = mute ? "mute" : "unmute";

            return this.sendCommand(cmd).then(this.onVolumeChange);
        }

        public isMuted(): boolean {
            return this.playerState.isMuted || false;
        }

        public getStats(): any {
            return this.sendCommand("stats");
        }

        private static mapRange(range: Range): Range {
            const offset = 0;
            //var currentPlayOptions = instance._currentPlayOptions;
            //if (currentPlayOptions) {
            //    offset = currentPlayOptions.transcodingOffsetTicks;
            //}

            return {
                start: range.start * 10000000 + offset,
                end: range.end * 10000000 + offset,
            };
        }

        private supportedFeatures?: string[];

        private getSupportedFeatures(): string[] {
            return ["SetAspectRatio"];
        }

        public supports(feature: string): boolean {
            if (!this.supportedFeatures) {
                this.supportedFeatures = this.getSupportedFeatures();
            }

            return this.supportedFeatures.includes(feature);
        }

        public setAspectRatio(val: string): Promise<void> {
            this.currentAspectRatio = val;
            return this.sendCommand(`aspectratio?val=${val}`);
        }

        public getAspectRatio(): string {
            return this.currentAspectRatio;
        }

        public getSupportedAspectRatios(): Array<{ name: string; id: string }> {
            return [
                { name: "4:3", id: "4_3" },
                { name: "16:9", id: "16_9" },
                { name: globalize.translate("sharedcomponents#Auto"), id: "bestfit" },
                //{ name: globalize.translate('sharedcomponents#Fill'), id: 'fill' },
                { name: globalize.translate("sharedcomponents#Original"), id: "original" },
            ];
        }

        public getBufferedRanges(): Range[] {
            const cacheState = this.playerState.demuxerCacheState;
            if (cacheState) {
                const ranges: Range[] = cacheState["seekable-ranges"];

                if (ranges) {
                    return ranges.map(MpvPlayer.mapRange);
                }
            }
            return [];
        }

        public seekable(): true {
            return true;
        }

        timeUpdateInterval?: NodeJS.Timeout;

        private startTimeUpdateInterval(): void {
            this.stopTimeUpdateInterval();
            this.timeUpdateInterval = setInterval(this.onTimeUpdate, 250);
        }

        private stopTimeUpdateInterval(): void {
            if (this.timeUpdateInterval) {
                clearInterval(this.timeUpdateInterval);
                this.timeUpdateInterval = undefined;
            }
        }

        private onEnded(): void {
            this.stopTimeUpdateInterval();

            if (!this.ignoreEnded) {
                this.ignoreEnded = true;
                events.trigger(this, "stopped");
            }
        }

        @bind
        private onTimeUpdate(): void {
            this.updatePlayerState();
            events.trigger(this, "timeupdate");
        }

        @bind
        private onVolumeChange(): void {
            appSettings.set("mpv-volume", this.volume());
            events.trigger(this, "volumechange");
        }

        @bind
        private onUnpause(): void {
            events.trigger(this, "unpause");
        }

        @bind
        private onPause(): void {
            events.trigger(this, "pause");
        }

        private onError(): void {
            this.stopTimeUpdateInterval();
            events.trigger(this, "error");
        }

        private zoomIn(elem): Promise<void> {
            return new Promise((resolve) => {
                const duration = 240;
                elem.style.animation = `mpvvideoplayer-zoomin ${duration}ms ease-in normal`;
                dom.addEventListener(elem, dom.whichAnimationEvent(), resolve, {
                    once: true,
                });
            });
        }

        private async sendCommand(name: string, body?: JsonObject): Promise<any> {
            const headers = {};

            if (body) {
                headers["Content-Type"] = "application/json;charset=UTF-8";
            }

            const response = await fetch(`http://127.0.0.1:8023/${name}`, {
                method: "POST",
                headers,
                body: body ? JSON.stringify(body) : null,
            });

            if (name === "stats") {
                return await response.json();
            }

            const state = await response.json();
            const previousPlayerState = this.playerState;

            if (state.playstate == "idle" && previousPlayerState.playstate != "idle" && previousPlayerState.playstate) {
                this.onEnded();
                return this.playerState;
            }

            this.playerState = state;

            if (previousPlayerState.isMuted !== state.isMuted || previousPlayerState.volume !== state.volume) {
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

        private updatePlayerState(): Promise<void> {
            return this.sendCommand("refresh");
        }

        private mapResPath(path: string): string {
            return pluginManager.mapPath(this, `../../res/plugins/${path}`);
        }
    }

    return MpvPlayer;
});
