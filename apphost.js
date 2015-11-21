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

        HttpClient.send({
            type: 'GET',
            url: 'electronapphost://' + name
        });
    }

    return {
        getWindowState: getWindowState,
        setWindowState: setWindowState,
        supports: function (command) {

            return [

                'minimize',
                'maximize',
                'fullscreenexit',
                'exit'
                //'sleep',
                //'restart',
                //'shutdown'

            ].indexOf(command.toLowerCase()) != -1;
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
            return appStartInfo.deviceId;
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
        }
    };
});