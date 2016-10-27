define(['apphost'], function (appHost) {
    'use strict';

    function fullscreenManager() {

    }

    fullscreenManager.prototype.requestFullscreen = function (element) {
        appHost.setWindowState('Maximized');
    };

    fullscreenManager.prototype.exitFullscreen = function () {
        appHost.setWindowState('Normal');
    };

    fullscreenManager.prototype.isFullScreen = function () {
        var windowState = appHost.getWindowState();
        return windowState == 'Maximized' || windowState == 'Fullscreen';
    };

    return new fullscreenManager();
});