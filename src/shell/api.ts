import { promises } from "fs";
import { IFoundServer, IMpvState, WindowState } from "../types";

interface IHooks {
    setWindowState(state: WindowState): void;
    execCommand(cmd: string): void;
    mpvCommand(name: string, body?: any): IMpvState;
    startProcess(path: string, args: string[]): number | void;
    stopProcess(pid: number): void;
    findServers(timeout: number): Promise<IFoundServer[]>;
    openUrl(url: string): Promise<void>;
}

export class TheaterApi {
    constructor(private hooks: IHooks) {}

    public conntest(): void {
        console.info("Communication main <- renderer established");
    }

    public setWindowState(state: WindowState): void {
        return this.hooks.setWindowState(state);
    }

    public execCommand(cmd: string): void {
        return this.hooks.execCommand(cmd);
    }

    public mpvCommand(name: string, body?: any): IMpvState {
        return this.hooks.mpvCommand(name, body);
    }

    public startProcess(path: string, args: string[]): number | void {
        return this.hooks.startProcess(path, args);
    }

    public stopProcess(pid: number): void {
        return this.hooks.stopProcess(pid);
    }

    public async exists(path: string): Promise<void> {
        await promises.access(path);
    }

    public async findServers(timeout: number) {
        return await this.hooks.findServers(timeout);
    }

    public async openUrl(url: string) {
        return this.hooks.openUrl(url);
    }
}
