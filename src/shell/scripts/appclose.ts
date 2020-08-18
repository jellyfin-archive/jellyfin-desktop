require(["playbackManager"], function (playbackManager) {
    window["AppCloseHelper"] = {
        onClosing: function (): void {
            // Prevent backwards navigation from stopping video
            history.back = (): void => {
                return;
            };

            playbackManager.onAppClose();
        },
    };
});
