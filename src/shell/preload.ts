import { Command, IAppHost, IAppInfo, IDownloadInfo, IMediaInfo, Layout } from "@cromefire_/nativeshell-api-definition";

const appHost: IAppHost = {
    appName(): string {
        return "";
    },
    appVersion(): string {
        return "";
    },
    deviceID(): string {
        return "";
    },
    deviceName(): string {
        return "";
    },
    exit(): void {},
    getDefaultLayout(): Layout {
        return Layout.DESKTOP;
    },
    async getDeviceProfile(profileBuilder: unknown): Promise<unknown> {
        return Promise.resolve({});
    },
    getSyncProfile(profileBuilder: unknown, appSettings: unknown): Promise<unknown> {
        return Promise.resolve(undefined);
    },
    init(): IAppInfo {
        // TODO: Add proper values
        return {
            appName: "Jellyfin Desktop",
            appVersion: "1.0.0-alpha0",
            deviceId: "not so random",
            deviceName: "Desktop test",
        };
    },
    supports(command: Command): boolean {
        return false;
    },
};

window.NativeShell = {
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
