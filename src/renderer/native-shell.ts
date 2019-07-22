import { Remote } from "comlink";
import { TheaterApi } from "../shell/api";
import { AppHost } from "./apphost";
import { FileSystem } from "./file-system";

export class NativeShell {
    private AppHost: AppHost;
    private FileSystem: FileSystem;

    constructor(private api: Remote<TheaterApi>) {
        this.AppHost = new AppHost(api);
        this.FileSystem = new FileSystem(api);
    }

    public async enableFullscreen() {
        return await this.api.setWindowState("Fullscreen");
    }

    public async disableFullscreen() {
        return await this.api.setWindowState("Normal");
    }

    public getPlugins() {
        requirejs.config({
            paths: self["appStartInfo"].paths
        });
        console.info("Loading theater plugins");
        return ["theater/plugins/mpvplayer"];
    }

    public async findServers(timeout: number) {
        return this.api.findServers(timeout);
    }

    public async openUrl(url: string) {
        await this.api.openUrl(url);
    }
}
