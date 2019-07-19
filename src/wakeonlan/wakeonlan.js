define([], function () {
    'use strict';

    function send(info) {

        return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', 'electronwakeonlan://wakeserver?macaddress=' + info.MacAddress + '&port=' + info.Port, true);
                xhr.onload = function () {
                    if (this.response) {
                        resolve();
                    } else{ 
                        reject();
                    }
                };
                xhr.onerror = reject;
                xhr.send();
            });
    }

    function isSupported() {
        return true;
    }

    return {
        send: send,
        isSupported: isSupported
    };

});