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

        if (getWindowState() == 'Normal') {
            setWindowState('Maximized');
        } else {
            setWindowState('Normal');
        }
    });

    function sendCommand(name) {

        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'electronapphost://' + name, true);

        xhr.send();
    }

    return {
        getWindowState: getWindowState,
        setWindowState: setWindowState,
        supports: function (command) {

            var features = [
                'windowstate',
                'exit',
                'runatstartup',
                'filedownload',
                'sharing'
                //'sleep',
                //'restart',
                //'shutdown'
            ];

            if (appStartInfo.supportsTransparentWindow) {
                features.push('windowtransparency');
            }

            return features.indexOf(command.toLowerCase()) != -1;
        },
        capabilities: getCapabilities,
        exit: function () {
            sendCommand('exit');
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
        appInfo: function () {

            return Promise.resolve({
                appName: appStartInfo.name,
                appVersion: appStartInfo.version,
                deviceName: appStartInfo.deviceName,
                deviceId: appStartInfo.deviceId
            });
        },
        appName: function () {
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