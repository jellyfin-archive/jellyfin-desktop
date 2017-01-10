define(['apphost', 'events'], function (appHost, events) {
    'use strict';

    function fullscreenManager() {

    }

    fullscreenManager.prototype.requestFullscreen = function (element) {
        appHost.setWindowState('Maximized');
        events.trigger(this, 'fullscreenchange');
    };

    fullscreenManager.prototype.exitFullscreen = function () {
        appHost.setWindowState('Normal');
        events.trigger(this, 'fullscreenchange');
    };

    fullscreenManager.prototype.isFullScreen = function () {
        var windowState = appHost.getWindowState();
        return windowState == 'Maximized' || windowState == 'Fullscreen';
    };

    return new fullscreenManager();
});