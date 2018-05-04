define([], function () {
    'use strict';

    function send(info) {

        return Promise.reject();
    }

    function isSupported() {
        return true;
    }

    return {
        send: send,
        isSupported: isSupported
    };

});