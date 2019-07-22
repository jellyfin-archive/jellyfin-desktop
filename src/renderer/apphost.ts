/* tslint:disable:no-string-literal */
import { Remote } from "comlink";
import { TheaterApi } from "../shell/api";
import { WindowState } from "../types";

export class AppHost {
    public moreIcon: "dots-vert";

    private supportedFeatures = [];
    constructor(private api: Remote<TheaterApi>) {}

    public getCapabilities() {
        const caps = {
            PlayableMediaTypes: ["Audio", "Video"],

            SupportsPersistentIdentifier: true
        };

        return Promise.resolve(caps);
    }

    public getWindowState() {
        return document["windowState"] || "Normal";
    }

    public supportsVoiceInput() {
        return (
            typeof SpeechRecognition !== "undefined" ||
            window["webkitSpeechRecognition"] ||
            window["mozSpeechRecognition"] ||
            window["oSpeechRecognition"] ||
            window["msSpeechRecognition"]
        );
    }

    public setWindowState(state: WindowState) {
        this.api.setWindowState(state);
    }

    public supports(command) {
        if (!this.supportedFeatures) {
            this.supportedFeatures = this.getSupportedFeatures();
        }
        return this.supportedFeatures.includes(command.toLowerCase());
    }

    public capabilities() {
        return {
            PlayableMediaTypes: ["Audio", "Video"],

            SupportsPersistentIdentifier: true
        };
    }

    public exit() {
        this.api.execCommand("exit");
    }

    public sleep() {
        this.api.execCommand("sleep");
    }

    public restart() {
        this.api.execCommand("restart");
    }

    public shutdown() {
        this.api.execCommand("shutdown");
    }

    public init() {
        return Promise.resolve();
    }

    public appName() {
        return self["appStartInfo"].name;
    }

    public appVersion() {
        return self["appStartInfo"].version;
    }

    public deviceName() {
        return self["appStartInfo"].deviceName;
    }

    public deviceId() {
        return self["appStartInfo"].deviceId;
    }

    public getKeyOptions() {
        return {
            // chromium doesn't automatically handle these
            handleAltLeftBack: true,
            handleAltRightForward: true,
            keyMaps: {
                back: [
                    8,
                    // ESC
                    27
                ]
            }
        };
    }

    public setTheme(themeSettings) {
        const metaThemeColor = document.querySelector("meta[name=theme-color]");
        if (metaThemeColor) {
            metaThemeColor.setAttribute("content", themeSettings.themeColor);
        }
    }

    public setUserScalable(scalable) {
        const att = scalable
            ? "viewport-fit=cover, width=device-width, initial-scale=1, minimum-scale=1, user-scalable=yes"
            : "viewport-fit=cover, width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no";

        document
            .querySelector("meta[name=viewport]")
            .setAttribute("content", att);
    }

    public deviceIconUrl() {
        return null;
    }

    public getDefaultLayout() {
        return "desktop";
    }

    public getSyncProfile(profileBuilder, appSettings) {
        return profileBuilder();
    }

    public async getDeviceProfile(item) {
        const connectionManager: any = await new Promise((resolve, reject) =>
            requirejs(["connectionManager"], resolve, reject)
        );

        const profile = {
            MaxStreamingBitrate: 200000000,
            MaxStaticBitrate: 200000000,
            MusicStreamingTranscodingBitrate: 192000,
            DirectPlayProfiles: [],
            TranscodingProfiles: [],
            ContainerProfiles: [],
            CodecProfiles: [],
            SubtitleProfiles: [],
            ResponseProfiles: []
        };

        // leave container null for all
        profile.DirectPlayProfiles.push({
            Type: "Video"
        });

        const apiClient =
            item && item.ServerId
                ? connectionManager.getApiClient(item.ServerId)
                : null;
        const supportsEmptyContainer = apiClient
            ? apiClient.isMinServerVersion("3.2.60.1")
            : false;

        if (supportsEmptyContainer) {
            // leave container null for all
            profile.DirectPlayProfiles.push({
                Type: "Audio"
            });
        } else {
            // for older servers that don't support leaving container blank
            profile.DirectPlayProfiles.push({
                Container: [
                    "aac",
                    "mp3",
                    "mpa",
                    "wav",
                    "wma",
                    "mp2",
                    "ogg",
                    "oga",
                    "ogv",
                    "webma",
                    "ape",
                    "opus",
                    "alac",
                    "flac",
                    "m4a"
                ].join(","),
                Type: "Audio"
            });
        }

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
            SegmentLength: "3"
        });

        profile.TranscodingProfiles.push({
            Container: "ts",
            Type: "Audio",
            AudioCodec: "aac",
            Context: "Streaming",
            Protocol: "hls",
            BreakOnNonKeyFrames: true,
            SegmentLength: "3"
        });

        profile.TranscodingProfiles.push({
            Container: "mp3",
            Type: "Audio",
            AudioCodec: "mp3",
            Context: "Streaming",
            Protocol: "http"
        });

        // Subtitle profiles
        // External vtt or burn in
        profile.SubtitleProfiles.push({
            Format: "srt",
            Method: "External"
        });
        profile.SubtitleProfiles.push({
            Format: "ssa",
            Method: "External"
        });
        profile.SubtitleProfiles.push({
            Format: "ass",
            Method: "External"
        });
        profile.SubtitleProfiles.push({
            Format: "srt",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "subrip",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "ass",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "ssa",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "dvb_teletext",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "dvb_subtitle",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "dvbsub",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "pgs",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "pgssub",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "dvdsub",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "vtt",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "sub",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "idx",
            Method: "Embed"
        });
        profile.SubtitleProfiles.push({
            Format: "smi",
            Method: "Embed"
        });

        return profile;
    }

    private getSupportedFeatures() {
        const features = [
            "windowstate",
            "exit",
            "runatstartup",
            "filedownload",
            "externallinks",
            "sleep",
            // 'restart',
            "shutdown"
        ];

        if (navigator["share"]) {
            features.push("sharing");
        }

        if (self["appStartInfo"].supportsTransparentWindow) {
            features.push("windowtransparency");
        }

        if (this.supportsVoiceInput()) {
            features.push("voiceinput");
        }

        if (self["ServiceWorkerSyncRegistered"]) {
            features.push("sync");
        }

        features.push("youtube");
        features.push("connectsignup");

        features.push("soundeffects");
        features.push("displaymode");
        features.push("plugins");
        features.push("skins");
        features.push("exitmenu");
        features.push("htmlaudioautoplay");
        features.push("htmlvideoautoplay");
        features.push("fullscreenchange");
        features.push("displayableversion");

        // features.push('remotecontrol');

        features.push("multiserver");
        features.push("imageanalysis");

        features.push("remoteaudio");
        features.push("remotevideo");

        features.push("screensaver");

        features.push("otherapppromotions");
        features.push("fileinput");

        features.push("nativeblurayplayback");
        features.push("nativedvdplayback");
        features.push("subtitleappearancesettings");

        features.push("displaylanguage");

        return features;
    }
}
