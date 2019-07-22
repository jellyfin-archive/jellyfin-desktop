import { BrowserWindow } from "electron";

export interface IDevToolsBrowserWindow extends BrowserWindow {
    openDevTools(): void;
}

export type WindowState = "Normal" | "Minimized" | "Maximized" | "Fullscreen";

export interface IMpvState {
    playstate?: "idle";
    volume: number;
    isMuted?: boolean;
    isPaused?: boolean;
    demuxerCacheState?: any;
    positionTicks?: number;
    durationTicks?: number;
}

export interface IAppStartInfo {
    paths: { [module: string]: string };
    name: string;
    version: string;
    deviceName: string;
    deviceId: string;
    supportsTransparentWindow: boolean;
    plugins: string[];
    scripts: string[];
}

export interface IFoundServer {
    Id: string;
    Address: string;
    Name: string;
}
