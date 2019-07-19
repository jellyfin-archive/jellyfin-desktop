import { WindowState } from "../types";

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

    public setStartInfo(startInfo) {
        function startWhenReady() {
            if (self.Emby && self.Emby.App) {
                self.appStartInfo = startInfo;
                self.Emby.App.start(startInfo);
            } else {
                setTimeout(startWhenReady, 50);
            }
        }
        startWhenReady();
    }
}
