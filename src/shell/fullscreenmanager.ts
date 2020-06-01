define(["apphost", "events"], function (appHost, events) {
    class FullscreenManager {
        public requestFullscreen(): void {
            appHost.setWindowState("Maximized");
            events.trigger(this, "fullscreenchange");
        }

        public exitFullscreen(): void {
            appHost.setWindowState("Normal");
            events.trigger(this, "fullscreenchange");
        }

        public isFullScreen(): boolean {
            const windowState = appHost.getWindowState();
            return windowState == "Maximized" || windowState == "Fullscreen";
        }
    }

    return new FullscreenManager();
});
