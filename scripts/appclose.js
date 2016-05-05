require(['playbackManager'], function (playbackManager) {

    window.AppCloseHelper = {
        onClosing: function () {

            // Prevent backwards navigation from stopping video
            history.back = function () { };

            if (playbackManager.isPlaying()) {
                playbackManager.stop();
            }
        }
    };
});