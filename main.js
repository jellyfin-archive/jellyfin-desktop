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

    function onWindowMoved() {

        mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("move", {}));');
    }

    var currentWindowState = 'Normal';

    function setWindowState(state) {

        currentWindowState = state;
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

    var isTransparencyRequired = false;
    var maximizeOnStart = false;

    function registerAppHost() {

        var protocol = require('protocol');
        var customProtocol = 'electronapphost';

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            var url = request.url.substr(customProtocol.length + 3);
            var command = url.split('?')[0];

            switch (command) {

                case 'windowstate-Normal':

                    mainWindow.setResizable(!isTransparencyRequired);
                    setWindowState('Normal');

                    break;
                case 'windowstate-Maximized':
                    mainWindow.setResizable(false);
                    setWindowState('Maximized');
                    break;
                case 'windowstate-Fullscreen':
                    mainWindow.setResizable(false);
                    setWindowState('Fullscreen');
                    break;
                case 'windowstate-Minimized':
                    setWindowState('Minimized');
                    break;
                case 'exit':
                    app.quit();
                    break;
                case 'openurl':
                    require('shell').openExternal(url.substring(url.indexOf('url=') + 4));
                    break;
                case 'video-on':
                    isTransparencyRequired = true;
                    mainWindow.setResizable(false);
                    break;
                case 'video-off':
                    isTransparencyRequired = false;
                    mainWindow.setResizable(true);
                    break;
                case 'loaded':

                    if (maximizeOnStart) {

                        mainWindow.setResizable(false);
                        setWindowState('Maximized');
                    }
                    break;
            }
            callback("");
        });
    }

    function registerFileSystem() {

        var protocol = require('protocol');
        var customProtocol = 'electronfs';

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            var url = request.url.substr(customProtocol.length + 3).split('?')[0];
            var fs = require('fs');

            switch (url) {

                case 'fileexists':
                case 'directoryexists':

                    var path = request.url.split('=')[1];

                    fs.exists(path, function (exists) {
                        callback(exists.toString());
                    });
                    break;
                default:
                    callback("");
                    break;
            }
        });
    }

    function registerServerdiscovery() {
        var protocol = require('protocol');
        var customProtocol = 'electronserverdiscovery';
        var serverdiscovery = require('./serverdiscovery/serverdiscovery-native');

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            var url = request.url.substr(customProtocol.length + 3).split('?')[0];

            switch (url) {

                case 'findservers':
                    var timeoutMs = request.url.split('=')[1];
                    serverdiscovery.findServers(timeoutMs, callback);
                    break;
                default:
                    callback("");
                    break;
            }
        });
    }

    function addVideoHandler() {

        var js = 'document.addEventListener("appready", function(){ Events.on(Emby.PlaybackManager, "playbackstart", function(){ if (Emby.PlaybackManager.isPlayingVideo()){ var xhr = new XMLHttpRequest();xhr.open("POST", "electronapphost://video-on", true);xhr.send(); } }); });';
        mainWindow.webContents.executeJavaScript(js);

        js = 'document.addEventListener("appready", function(){ Events.on(Emby.PlaybackManager, "playbackstop", function(){ var xhr = new XMLHttpRequest();xhr.open("POST", "electronapphost://video-off", true);xhr.send(); });';
        mainWindow.webContents.executeJavaScript(js);
    }

    function alert(text) {
        require('dialog').showMessageBox(mainWindow, {
            message: text.toString(),
            buttons: ['ok']
        });
    }

    function replaceAll(str, find, replace) {

        return str.split(find).join(replace);
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
                        apphost: customFileProtocol + '://apphost',
                        shell: customFileProtocol + '://shell',
                        serverdiscovery: customFileProtocol + '://serverdiscovery/serverdiscovery',
                        filesystem: customFileProtocol + '://filesystem'
                    },
                    name: app.getName(),
                    version: app.getVersion(),
                    deviceName: os.hostname(),
                    deviceId: os.hostname(),
                    plugins: pluginFiles.filter(function (f) {

                        return f.indexOf('.js') != -1;

                    }).map(function (f) {

                        return 'file://' + replaceAll(path.normalize(pluginDirectory + '/' + f), '\\', '/');
                    }),
                    scripts: scriptFiles.map(function (f) {

                        return 'file://' + replaceAll(path.normalize(scriptsDirectory + '/' + f), '\\', '/');
                    })
                };

                mainWindow.webContents.executeJavaScript('var appStartInfo=' + JSON.stringify(startInfo) + ';');
            });
        });
    }

    function sendCommand(cmd) {

        var script = "require(['inputmanager'], function(inputmanager){inputmanager.handle('" + cmd + "');});";
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
            case 'media-play_pause':
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

    app.commandLine.appendSwitch('enable-transparent-visuals');

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    app.on('ready', function () {

        var path = require("path");
        var windowStatePath = path.join(app.getDataPath(), "windowstate.json");

        var previousWindowBounds;
        try {
            previousWindowBounds = JSON.parse(require("fs").readFileSync(windowStatePath, 'utf8'));
        }
        catch (e) {
            previousWindowBounds = {};
        }

        var windowOptions = {
            transparent: true,
            frame: false,
            resizable: true,
            title: 'Emby Theater',
            minWidth: 720,
            minHeight: 480,
            //alwaysOnTop: true,

            webPreferences: {
                webSecurity: false,
                "webgl": true,
                nodeIntegration: false,
                'plugins': false,
                'directWrite': true,
                'webaudio': true,
                java: false,
                allowDisplayingInsecureContent: true,
                allowRunningInsecureContent: true,
                experimentalFeatures: true
            }

        };

        windowOptions.center = true;

        maximizeOnStart = previousWindowBounds.state == 'Maximized';

        if (maximizeOnStart) {

            windowOptions.width = previousWindowBounds.width || 1280;
            windowOptions.height = previousWindowBounds.height || 720;
            windowOptions.width = 1280;
            windowOptions.height = 720;
            //windowOptions.alwaysOnTop = true;
            //windowOptions.x = 0;
            //windowOptions.y = 0;

        } else {
            windowOptions.width = previousWindowBounds.width || 1280;
            windowOptions.height = previousWindowBounds.height || 720;
        }

        // Create the browser window.
        mainWindow = new BrowserWindow(windowOptions);
        mainWindow.webContents.on('dom-ready', setStartInfo);

        var url = 'http://mediabrowser.github.io/Emby.Web/index.html';
        //url = 'http://localhost:8088/index.html';

        url += '?v=' + new Date().getTime();

        // and load the index.html of the app.
        mainWindow.loadUrl(url);

        // Emitted when the window is closed.
        mainWindow.on('closed', function () {
            // Dereference the window object, usually you would store windows
            // in an array if your app supports multi windows, this is the time
            // when you should delete the corresponding element.
            mainWindow = null;
        });

        mainWindow.setMenu(null);
        mainWindow.on('move', onWindowMoved);

        mainWindow.on('app-command', onAppCommand);

        mainWindow.on("close", function () {

            var data = mainWindow.getBounds();
            data.state = currentWindowState;
            require("fs").writeFileSync(windowStatePath, JSON.stringify(data));
        });

        //mainWindow.openDevTools();

        addPathIntercepts();
        registerAppHost();
        registerFileSystem();
        registerServerdiscovery();
        addVideoHandler();
    });
})();