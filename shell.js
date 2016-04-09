define(['events'], function (events) {

    function sendCommand(name) {

        return new Promise(function (resolve, reject) {

            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'electronapphost://' + name, true);

            xhr.onload = function () {
                if (this.response) {
                    resolve(this.response);
                } else {
                    reject();
                }
            };
            xhr.onerror = reject;
            xhr.send();
        });
    }

    var shell = {};

    function getProcessClosePromise(pid) {

        // returns a promise that resolves or rejects when a process closes
        return new Promise(function (resolve, reject) {

            events.on(shell, 'closed', function (e, processId, error) {

                if (processId == pid) {

                    if (error) {
                        reject();
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    window.onChildProcessClosed = function (processId, error) {
        events.trigger(shell, 'closed', [processId, error]);
    };

    function paramsToString(params) {

        var values = [];

        for (var key in params) {

            var value = params[key];

            if (value !== null && value !== undefined && value !== '') {
                values.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
            }
        }
        return values.join('&');
    }

    return {
        openUrl: function (url) {
            return sendCommand('openurl?url=' + url);
        },
        canExec: true,
        close: function (processId) {

            var url = 'shellclose?id=' + processId;

            return sendCommand(url);
        },
        exec: function (options) {

            var url = 'shellstart?' + paramsToString(options);

            return sendCommand(url).then(function (response) {

                return {
                    id: response,
                    promise: getProcessClosePromise(response)
                };
            });
        }
    };
});