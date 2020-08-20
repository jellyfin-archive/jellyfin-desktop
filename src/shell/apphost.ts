import { JsonObject, WindowState } from "../common/types";

define([], function () {
    "use strict";

    function getCapabilities(): Promise<JsonObject> {
        const caps = {
            PlayableMediaTypes: ["Audio", "Video"],

            SupportsPersistentIdentifier: true,
        };

        return Promise.resolve(caps);
    }

    function getWindowState(): WindowState {
        return document["windowState"] || "Normal";
    }

    function setWindowState(state: WindowState): Promise<void> {
        // Normal
        // Minimized
        // Maximized

        return sendCommand(`windowstate-${state}`);
    }

    function sendCommand(name: string): Promise<void> {
        return fetch(`electronapphost://${name}`)
            .then((response) => {
                if (!response.ok) {
                    console.error("Error sending command: ", response);
                    throw response;
                }
            })
            .catch(console.error);
    }

    function supportsVoiceInput(): boolean {
        return (
            (window as any).SpeechRecognition ||
            (window as any)["webkitSpeechRecognition"] ||
            (window as any)["mozSpeechRecognition"] ||
            (window as any)["oSpeechRecognition"] ||
            !!(window as any)["msSpeechRecognition"]
        );
    }

    const supportedFeatures = (function (): string[] {
        const features = [
            "windowstate",
            "exit",
            "runatstartup",
            "filedownload",
            "externallinks",
            "sleep",
            //'restart',
            "shutdown",
        ];

        if (navigator["share"]) {
            features.push("sharing");
        }

        if (window["appStartInfo"].supportsTransparentWindow) {
            features.push("windowtransparency");
        }

        if (supportsVoiceInput()) {
            features.push("voiceinput");
        }

        if (window["ServiceWorkerSyncRegistered"]) {
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

        //features.push('remotecontrol');

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
    })();

    return {
        getWindowState: getWindowState,
        setWindowState: setWindowState,
        supports: function (command: string): boolean {
            return supportedFeatures.includes(command.toLowerCase());
        },
        capabilities: function (): JsonObject {
            return {
                PlayableMediaTypes: ["Audio", "Video"],

                SupportsPersistentIdentifier: true,
            };
        },
        getCapabilities: getCapabilities,
        exit: function (): Promise<void> {
            return sendCommand("exit");
        },
        sleep: function (): Promise<void> {
            return sendCommand("sleep");
        },
        restart: function (): Promise<void> {
            return sendCommand("restart");
        },
        shutdown: function (): Promise<void> {
            return sendCommand("shutdown");
        },
        init: function (): Promise<void> {
            return Promise.resolve();
        },
        appName: function (): string {
            return window["appStartInfo"].name;
        },
        appVersion: function (): string {
            return window["appStartInfo"].version;
        },
        deviceName: function (): string {
            return window["appStartInfo"].deviceName;
        },
        deviceId: function (): string {
            return window["appStartInfo"].deviceId;
        },

        moreIcon: "dots-vert",
        getKeyOptions: function (): JsonObject {
            return {
                // chromium doesn't automatically handle these
                handleAltLeftBack: true,
                handleAltRightForward: true,
                keyMaps: {
                    back: [
                        8,
                        // ESC
                        27,
                    ],
                },
            };
        },

        setTheme: function (themeSettings: { themeColor: string }): void {
            const metaThemeColor = document.querySelector("meta[name=theme-color]");
            if (metaThemeColor) {
                metaThemeColor.setAttribute("content", themeSettings.themeColor);
            }
        },

        setUserScalable: function (scalable: boolean): void {
            const att = scalable
                ? "viewport-fit=cover, width=device-width, initial-scale=1, minimum-scale=1, user-scalable=yes"
                : "viewport-fit=cover, width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no";

            document.querySelector("meta[name=viewport]")?.setAttribute("content", att);
        },

        deviceIconUrl: function (): string | null {
            return null;
        },
    };
});
