define(['events', 'apphost'], function (events, apphost) {

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
    var closingWindowState;

    function getProcessClosePromise(pid) {

        // returns a promise that resolves or rejects when a process closes
        return new Promise(function (resolve, reject) {

            events.on(shell, 'closed', function (e, processId, error) {

                if (processId === pid) {

                    if (closingWindowState) {
                        apphost.setWindowState(closingWindowState);
                        closingWindowState = null;
                    }

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

    shell.openUrl = function (url) {
        return sendCommand('openurl?url=' + url);
    };

    shell.canExec = true;

    shell.close = function (processId) {

        var url = 'shellclose?id=' + processId;

        return sendCommand(url);
    };

    shell.exec = function (options) {

        var url = 'shellstart?' + paramsToString(options);

        return sendCommand(url).then(function (response) {

            if (apphost.supports('windowstate')) {

                closingWindowState = apphost.getWindowState();
                apphost.setWindowState('Minimized');
            }

            events.trigger(shell, 'exec', [response]);

            return {
                id: response,
                promise: getProcessClosePromise(response)
            };
        });
    };

    return shell;
});