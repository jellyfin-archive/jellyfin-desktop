define([], function () {

    function getCapabilities() {

        var caps = {
            PlayableMediaTypes: ['Audio', 'Video'],

            SupportsPersistentIdentifier: true
        };

        return caps;
    }

    function getWindowState() {
        return document.windowState || 'Normal';
    }

    function setWindowState(state) {

        // Normal
        // Minimized
        // Maximized

        sendCommand('windowstate-' + state);
    }

    document.addEventListener('dblclick', function () {

        if (getWindowState() == 'Maximized') {
            setWindowState('Normal');
        } else {
            setWindowState('Maximized');
        }
    });

    function sendCommand(name) {

        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'electronapphost://' + name, true);

        xhr.send();
    }

    function showExit() {
        require(['paperdialoghelper'], function (paperdialoghelper) {

            var dlg = paperdialoghelper.createDialog({
                removeOnClose: true
            });

            var html = '';
            html += '<div>';

            html += 'Shutting down...';

            html += '</div>';

            dlg.innerHTML = html;
            document.body.appendChild(dlg);

            return paperdialoghelper.open(dlg);
        });
    }

    return {
        getWindowState: getWindowState,
        setWindowState: setWindowState,
        supports: function (command) {

            return [

                'windowstate',
                'exit'
                //'sleep',
                //'restart',
                //'shutdown'

            ].indexOf(command.toLowerCase()) != -1;
        },
        appInfo: function () {

            return new Promise(function (resolve, reject) {

                resolve({
                    deviceId: appStartInfo.deviceId,
                    deviceName: appStartInfo.deviceName,
                    appName: appStartInfo.name,
                    appVersion: appStartInfo.version
                });
            });

        },
        capabilities: getCapabilities,
        exit: function () {

            if (Emby.PlaybackManager.isPlaying()) {
                // Prevent backwards navigation from stopping video
                history.back = function() {};
                showExit();
                Emby.PlaybackManager.stop();
                setTimeout(function () {
                    sendCommand('exit');
                }, 1500);
            } else {
                sendCommand('exit');
            }

        },
        sleep: function () {
            sendCommand('sleep');
        },
        restart: function () {
            sendCommand('restart');
        },
        shutdown: function () {
            sendCommand('shutdown');
        },
        appName: function() {
            return appStartInfo.name;
        },
        appVersion: function () {
            return appStartInfo.version;
        },
        deviceName: function () {
            return appStartInfo.deviceName;
        },
        deviceId: function () {
            return Promise.resolve(appStartInfo.deviceId);
        }
    };
});