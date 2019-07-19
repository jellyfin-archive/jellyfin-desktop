import { BrowserWindow } from "electron";

export interface IDevToolsBrowserWindow extends BrowserWindow {
    openDevTools(): void;
}

export type WindowState = "Normal" | "Minimized" | "Maximized" | "Fullscreen";
