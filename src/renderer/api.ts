/* tslint:disable:no-string-literal */
import { IAppStartInfo, WindowState } from "../types";

export class RendererApi {
    public comtest() {
        console.info("Communication main -> renderer established");
    }

    public onMove() {
        window.dispatchEvent(new CustomEvent("onMove", {}));
    }

    public onWindowStateChanged(state: WindowState) {
        // tslint:disable-next-line:no-string-literal
        document["windowState"] = state;
        document.dispatchEvent(
            new CustomEvent("windowstatechanged", {
                detail: { windowState: state }
            })
        );
    }

    public setStartInfo(startInfo: IAppStartInfo) {
        self["appStartInfo"] = startInfo;
    }

    public async executeCommand(cmd: string) {
        const [inputmanager] = await requirejs(["inputmanager"]);
        inputmanager.trigger(cmd);
    }

    public async onClosing() {
        // Prevent backwards navigation from stopping video
        history.back = () => {};

        const [playbackManager] = await requirejs(["playbackManager"]);

        playbackManager.onAppClose();
    }

    public setPlayerwindowId(id: string) {
        self["PlayerWindowId"] = id;
    }

    public onChildProcessClosed(pid: number, error: boolean) {
        self["onChildProcessClosed"](pid.toString(), error);
    }
}
