(function () {

    var app = require('app');  // Module to control application life.
    var BrowserWindow = require('browser-window');  // Module to create native browser window.

    // Keep a global reference of the window object, if you don't, the window will
    // be closed automatically when the JavaScript object is garbage collected.
    var mainWindow = null;

    // Quit when all windows are closed.
    app.on('window-all-closed', function () {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform != 'darwin') {
            app.quit();
        }
    });

    var windowEventsEnabled = false;
    function enableWindowEvents() {
        windowEventsEnabled = true;
        mainWindow.on('maximize', onWindowStateChanged);
        mainWindow.on('unmaximize', onWindowStateChanged);
        mainWindow.on('minimize', onWindowStateChanged);
        mainWindow.on('restore', onWindowStateChanged);
        mainWindow.on('move', onWindowMoved);
    }

    function disableWindowEvents() {
        windowEventsEnabled = false;
    }

    function onWindowStateChanged() {

        if (!windowEventsEnabled) {
            return;
        }
        if (mainWindow.isFullScreen()) {
            sendWindowState('Maximized');
        }
        else if (mainWindow.isMaximized()) {
            mainWindow.setFullScreen(true);
            sendWindowState('Maximized');
        }
        else if (mainWindow.isMinimized()) {
            mainWindow.setFullScreen(false);
            sendWindowState('Minimized');
        }
        else {
            mainWindow.setFullScreen(false);
            sendWindowState('Normal');
        }
    }

    function onWindowMoved() {

        if (!windowEventsEnabled) {
            return;
        }

        mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("move", {}));');
    }

    function sendWindowState(state) {
        mainWindow.webContents.executeJavaScript('document.windowState="' + state + '";document.dispatchEvent(new CustomEvent("windowstatechanged", {detail:{windowState:"' + state + '"}}));');
    }

    var customFileProtocol = 'electronfile';

    function addPathIntercepts() {

        var protocol = require('protocol');
        var path = require('path');

        protocol.registerFileProtocol(customFileProtocol, function (request, callback) {

            // Add 3 to account for ://
            var url = request.url.substr(customFileProtocol.length + 3);
            url = __dirname + '/' + url;
            url = url.split('?')[0];

            callback({
                path: path.normalize(url)
            });
        });
    }

    function registerAppHost() {

        var protocol = require('protocol');
        var customProtocol = 'electronapphost';

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            var url = request.url.substr(customProtocol.length + 3);

            switch (url) {

                case 'windowstate-Normal':

                    disableWindowEvents();
                    if (mainWindow.isFullScreen()) {
                        mainWindow.setFullScreen(false);
                    }
                    if (mainWindow.isMaximized()) {
                        mainWindow.unmaximize();
                    }
                    else if (mainWindow.isMinimized()) {
                        mainWindow.restore();
                    }

                    sendWindowState('Normal');
                    enableWindowEvents();

                    break;
                case 'windowstate-Maximized':
                    disableWindowEvents();
                    mainWindow.maximize();
                    mainWindow.setFullScreen(true);
                    sendWindowState('Maximized');
                    enableWindowEvents();
                    break;
                case 'windowstate-Minimized':
                    disableWindowEvents();
                    mainWindow.minimize();
                    sendWindowState('Minimized');
                    enableWindowEvents();
                    break;
                case 'exit':
                    app.quit();
                    break;
            }
            callback("");
        });
    }

    function alert(text) {
        require('dialog').showMessageBox(mainWindow, {
            message: text.toString(),
            buttons: ['ok']
        });
    }

    function setStartInfo() {

        var os = require("os");

        var path = require('path');
        var fs = require('fs');

        var pluginDirectory = path.normalize(__dirname + '/plugins');
        var scriptsDirectory = path.normalize(__dirname + '/scripts');

        fs.readdir(pluginDirectory, function (err, pluginFiles) {

            fs.readdir(scriptsDirectory, function (err, scriptFiles) {

                pluginFiles = pluginFiles || [];
                scriptFiles = scriptFiles || [];

                var startInfo = {
                    paths: {
                        apphost: customFileProtocol + '://apphost'
                    },
                    name: app.getName(),
                    version: app.getVersion(),
                    deviceName: os.hostname(),
                    deviceId: os.hostname(),
                    plugins: pluginFiles.map(function (f) {

                        return 'file://' + path.normalize(pluginDirectory + '/' + f);
                    }),
                    scripts: scriptFiles.map(function (f) {

                        return 'file://' + path.normalize(scriptsDirectory + '/' + f);
                    })
                };

                mainWindow.webContents.executeJavaScript('var appStartInfo=' + JSON.stringify(startInfo) + ';');
            });
        });
    }

    function sendCommand(cmd) {

        var script = "require(['inputreceiver'], function(inputreceiver){inputreceiver.handle('" + cmd + "');});";
        mainWindow.webContents.executeJavaScript(script);
    }

    function onAppCommand(e, cmd) {

        switch (cmd) {

            case 'browser-backward':
                if (mainWindow.webContents.canGoBack()) {
                    mainWindow.webContents.goBack();
                }
                break;
            case 'browser-forward':
                if (mainWindow.webContents.canGoForward()) {
                    mainWindow.webContents.goForward();
                }
                break;
            case 'browser-stop':
                sendCommand("stop");
                break;
            case 'browser-search':
            case 'find':
                sendCommand("search");
                break;
            case 'browser-favorites':
                sendCommand("favorites");
                break;
            case 'browser-home':
                sendCommand("home");
                break;
            case 'volume-mute':
                sendCommand("togglemute");
                break;
            case 'volume-down':
                sendCommand("volumedown");
                break;
            case 'volume-up':
                sendCommand("volumeup");
                break;
            case 'media-nexttrack':
                sendCommand("next");
                break;
            case 'media-previoustrack':
                sendCommand("previous");
                break;
            case 'media-stop':
                sendCommand("stop");
                break;
            case 'media-play':
                sendCommand("play");
                break;
            case 'media-pause':
                sendCommand("pause");
                break;
            case 'media-record':
                sendCommand("record");
                break;
            case 'media-fast-forward':
                sendCommand("fastforward");
                break;
            case 'media-rewind':
                sendCommand("rewind");
                break;
            case 'media-play-pause':
                sendCommand("playpause");
                break;
            case 'channel-up':
                sendCommand("channelup");
                break;
            case 'channel-down':
                sendCommand("channeldown");
                break;
                //case AppCommand.APPCOMMAND_OPENRECORDED:
                //    sendCommand("recordedtv");
                //    break;
                //case AppCommand.APPCOMMAND_LIVETV:
                //    sendCommand("livetv");
                //    break;
            case 'menu':
                sendCommand("menu");
                break;
                //case AppCommand.APPCOMMAND_GUIDEMENU:
                //case AppCommand.APPCOMMAND_EPG:
                //case AppCommand.APPCOMMAND_CHANNELS:
                //    sendCommand("guide");
                //    break;
                //case 'asp-toggle':
                //    sendCommand("changezoom");
                //    break;
                //case 'cc':
                //    sendCommand("changesubtitletrack");
                //    break;
            case 'info':
                sendCommand("info");
                break;
        }
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    app.on('ready', function () {

        // Create the browser window.
        mainWindow = new BrowserWindow({

            width: 1280,
            height: 720,
            transparent: true,
            frame: true,
            resizable: true,
            center: true,
            title: 'Emby Theater',
            'skip-taskbar': false,

            'web-preferences': {
                'web-security': false,
                "webgl": true,
                'node-integration': false,
                'plugins': false,
                'directWrite': true,
                'webaudio': true,
                'java': false
            }

        });

        mainWindow.webContents.on('dom-ready', setStartInfo);

        // and load the index.html of the app.
        mainWindow.loadUrl('http://mediabrowser.github.io/Emby.Web/index.html');

        // Emitted when the window is closed.
        mainWindow.on('closed', function () {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.
            mainWindow = null;
        });

        mainWindow.setMenu(null);
        enableWindowEvents();

        mainWindow.on('app-command', onAppCommand);

        addPathIntercepts();
        registerAppHost();
    });

})();