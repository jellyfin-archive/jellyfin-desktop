((require as unknown) as typeof define)(["playbackManager"], function (playbackManager) {
    window["AppCloseHelper"] = {
        onClosing: function (): void {
            // Prevent backwards navigation from stopping video
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            history.back = (): void => {};

            playbackManager.onAppClose();
        },
    };
});
