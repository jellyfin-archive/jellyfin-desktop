import {
    Command,
    IAppHost,
    IAppInfo,
    IDownloadInfo,
    IMediaInfo,
    Layout,
    INativeShell,
} from "@cromefire_/nativeshell-api-definition";
import { Remote, wrap } from "comlink";
import { MainApi } from "../common/ipc/api";
import { mainProcObjectEndpoint } from "comlink-electron-adapter";
import { ipcRenderer } from "electron";

const mainApi: Remote<MainApi> = wrap<MainApi>(mainProcObjectEndpoint(ipcRenderer));

const appName = "Jellyfin Desktop";
// TODO: Remove once jf-web#1826 is stable
let appVersion = "";
let deviceId = "";
let deviceName = "";

const appHost: any = {
    appName(): string {
        return appName;
    },
    appVersion(): string {
        return appVersion;
    },
    deviceId(): string {
        return deviceId;
    },
    deviceName(): string {
        return deviceName;
    },
    exit(): void {},
    getDefaultLayout(): Layout {
        return Layout.DESKTOP;
    },
    async getDeviceProfile(profileBuilder: unknown): Promise<unknown> {
        return {};
    },
    getSyncProfile(profileBuilder: unknown, appSettings: unknown): Promise<unknown> {
        return Promise.resolve(undefined);
    },
    async init(): Promise<IAppInfo> {
        const appVersion$ = mainApi.appVersion();
        const deviceId$ = mainApi.deviceId();
        const deviceName$ = mainApi.deviceName();
        appVersion = await appVersion$;
        deviceId = await deviceId$;
        deviceName = await deviceName$;
        // TODO: Add proper values
        return {
            appName,
            appVersion,
            deviceId,
            deviceName,
        };
    },
    supports(command: Command): boolean {
        return false;
    },
};

const nativeShell: INativeShell = {
    AppHost: appHost,
    disableFullscreen(): void {},
    downloadFile(downloadInfo: IDownloadInfo): void {},
    enableFullscreen(): void {},
    getPlugins(): string[] {
        return [];
    },
    hideMediaSession(): void {},
    openUrl(url: string, target?: string): void {},
    updateMediaSession(mediaInfo: IMediaInfo): void {},
};

window.NativeShell = nativeShell;
