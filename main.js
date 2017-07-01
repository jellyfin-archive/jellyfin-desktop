(function () {

    var electron = require('electron');
    var app = electron.app;  // Module to control application life.
    var BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

    // Keep a global reference of the window object, if you don't, the window will
    // be closed automatically when the JavaScript object is garbage collected.
    var mainWindow = null;
    var playerWindow = null;
    var hasAppLoaded = false;

    var enableDevTools = false;
    var enableDevToolsOnStartup = false;
    var initialShowEventsComplete = false;

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
        var winPosition = mainWindow.getPosition();
        playerWindow.setPosition(winPosition[0], winPosition[1]);
    }

    function onWindowResize() {
        var winSize = mainWindow.getSize();
        playerWindow.setSize(winSize[0], winSize[1]);
    }

    var currentWindowState = 'Normal';
    var restoreWindowState;

    function setWindowState(state) {

        restoreWindowState = null;
        var previousState = currentWindowState;

        if (state == 'Maximized') {
            state = 'Fullscreen';
        }

        if (state == 'Minimized') {
            restoreWindowState = previousState;
            mainWindow.setAlwaysOnTop(false);
            mainWindow.minimize();
        } else if (state == 'Maximized') {

            if (previousState == "Minimized") {
                mainWindow.restore();
            }

            mainWindow.maximize();
            mainWindow.setAlwaysOnTop(false);

        } else if (state == 'Fullscreen') {

            if (previousState == "Minimized") {
                mainWindow.restore();
            }

            mainWindow.setFullScreen(true);
            mainWindow.setAlwaysOnTop(true);

        } else {

            var setSize = false;
            if (previousState == "Minimized") {
                mainWindow.restore();
            }

            else if (previousState == "Fullscreen") {
                setSize = true;
                mainWindow.setFullScreen(false);
            }

            else if (previousState == "Maximized") {
                mainWindow.unmaximize();
            }

            if (setSize) {
                mainWindow.setSize(1280, 720);
                mainWindow.center();
            }
            mainWindow.setAlwaysOnTop(false);
        }
    }

    function onWindowStateChanged(state) {

        currentWindowState = state;
        mainWindow.webContents.executeJavaScript('document.windowState="' + state + '";document.dispatchEvent(new CustomEvent("windowstatechanged", {detail:{windowState:"' + state + '"}}));');
    }

    function onMinimize() {
        playerWindow.minimize();
        onWindowStateChanged('Minimized');
    }

    function onRestore() {

        var restoreState = restoreWindowState;
        restoreWindowState = null;
        if (restoreState && restoreState != 'Normal' && restoreState != 'Minimized') {
            setWindowState(restoreState);
        } else {
            onWindowStateChanged('Normal');
        }

        playerWindow.restore();
    }

    function onMaximize() {
        onWindowStateChanged('Maximized');
    }

    function onEnterFullscreen() {
        onWindowStateChanged('Fullscreen');

        if (initialShowEventsComplete) {
            //playerWindow.setFullScreen(true);
            mainWindow.setMovable(false);
        }
    }

    function onLeaveFullscreen() {

        onWindowStateChanged('Normal');

        if (initialShowEventsComplete) {
            playerWindow.setFullScreen(false);
            mainWindow.setMovable(true);
        }
    }

    function onUnMaximize() {
        onWindowStateChanged('Normal');
    }

    var customFileProtocol = 'electronfile';

    function addPathIntercepts() {

        var protocol = electron.protocol;
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

        //protocol.interceptHttpProtocol('https', function (request, callback) {

        //    alert(request.url);
        //    callback({ 'url': request.url, 'referrer': request.referrer, session: null });
        //});
    }

    function sleepSystem() {

        var sleepMode = require('sleep-mode');
        sleepMode(function (err, stderr, stdout) {
        });
    }

    function restartSystem() {
    }

    function shutdownSystem() {

        var powerOff = require('power-off');
        powerOff(function (err, stderr, stdout) {
        });
    }

    function setMainWindowResizable(resizable) {

        try {
            mainWindow.setResizable(resizable);
        } catch (err) {
            console.log('Error in setResizable:' + err);
        }
    }

    var isTransparencyRequired = false;
    var windowStateOnLoad;
    function registerAppHost() {

        var protocol = electron.protocol;
        var customProtocol = 'electronapphost';

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            var url = request.url.substr(customProtocol.length + 3);
            var parts = url.split('?');
            var command = parts[0];

            switch (command) {

                case 'windowstate-Normal':

                    setMainWindowResizable(!isTransparencyRequired);
                    setWindowState('Normal');

                    break;
                case 'windowstate-Maximized':
                    setMainWindowResizable(false);
                    setWindowState('Maximized');
                    break;
                case 'windowstate-Fullscreen':
                    setMainWindowResizable(false);
                    setWindowState('Fullscreen');
                    break;
                case 'windowstate-Minimized':
                    setWindowState('Minimized');
                    break;
                case 'exit':
                    closeWindow(mainWindow);
                    break;
                case 'sleep':
                    sleepSystem();
                    break;
                case 'shutdown':
                    shutdownSystem();
                    break;
                case 'restart':
                    restartSystem();
                    break;
                case 'openurl':
                    electron.shell.openExternal(url.substring(url.indexOf('url=') + 4));
                    break;
                case 'shellstart':

                    var options = require('querystring').parse(parts[1]);
                    startProcess(options, callback);
                    return;
                case 'shellclose':

                    closeProcess(require('querystring').parse(parts[1]).id, callback);
                    return;
                case 'video-on':
                    isTransparencyRequired = true;
                    setMainWindowResizable(false);
                    break;
                case 'video-off':
                    isTransparencyRequired = false;
                    setMainWindowResizable(true);
                    break;
                case 'loaded':

                    if (windowStateOnLoad) {
                        setWindowState(windowStateOnLoad);
                    }
                    mainWindow.focus();
                    hasAppLoaded = true;
                    onLoaded();
                    break;
            }
            callback("");
        });
    }

    function onLoaded() {

        //var globalShortcut = electron.globalShortcut;

        //globalShortcut.register('mediastop', function () {
        //    sendCommand('stop');
        //});

        //globalShortcut.register('mediaplaypause', function () {
        //});

        sendJavascript('window.PlayerWindowId="' + getWindowId(playerWindow) + '";');
    }

    var processes = {};

    function startProcess(options, callback) {

        var pid;
        var args = (options.arguments || '').split('|||');

        try {
            var process = require('child_process').execFile(options.path, args, {}, function (error, stdout, stderr) {

                if (error) {
                    console.log('Process closed with error: ' + error);
                }
                processes[pid] = null;
                var script = 'onChildProcessClosed("' + pid + '", ' + (error ? 'true' : 'false') + ');';

                sendJavascript(script);
            });

            pid = process.pid.toString();
            processes[pid] = process;
            callback(pid);
        } catch (err) {
            alert('Error launching process: ' + err);
        }
    }

    function closeProcess(id, callback) {

        var process = processes[id];
        if (process) {
            process.kill();
        }
        callback("");
    }

    function registerFileSystem() {

        var protocol = electron.protocol;
        var customProtocol = 'electronfs';

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            var url = request.url.substr(customProtocol.length + 3).split('?')[0];
            var fs = require('fs');

            switch (url) {

                case 'fileexists':
                case 'directoryexists':

                    var path = request.url.split('=')[1];

                    fs.access(path, (err) => {
                        if (err) {
                            console.error('fs access result for path: ' + err);

                            callback('false');
                        } else {
                            callback('true');
                        }
                    });
                    break;
                default:
                    callback("");
                    break;
            }
        });
    }

    function registerServerdiscovery() {

        var protocol = electron.protocol;
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

    function alert(text) {
        electron.dialog.showMessageBox(mainWindow, {
            message: text.toString(),
            buttons: ['ok']
        });
    }

    function replaceAll(str, find, replace) {

        return str.split(find).join(replace);
    }

    function getAppBaseUrl() {

        var url = 'https://tv.emby.media';

        //url = 'http://localhost:8088';
        return url;
    }

    function getAppUrl() {

        var url = getAppBaseUrl() + '/index.html?autostart=false';
        //url += '?v=' + new Date().getTime();
        return url;
    }

    var startInfoJson;
    function loadStartInfo() {

        return new Promise(function (resolve, reject) {

            var os = require("os");

            var path = require('path');
            var fs = require('fs');

            var topDirectory = path.normalize(__dirname);
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
                            fullscreenmanager: 'file://' + replaceAll(path.normalize(topDirectory + '/fullscreenmanager.js'), '\\', '/'),
                            filesystem: customFileProtocol + '://filesystem'
                        },
                        name: app.getName(),
                        version: app.getVersion(),
                        deviceName: os.hostname(),
                        deviceId: os.hostname(),
                        supportsTransparentWindow: supportsTransparentWindow(),
                        plugins: pluginFiles.filter(function (f) {

                            return f.indexOf('.js') != -1;

                        }).map(function (f) {

                            return 'file://' + replaceAll(path.normalize(pluginDirectory + '/' + f), '\\', '/');
                        }),
                        scripts: scriptFiles.map(function (f) {

                            return 'file://' + replaceAll(path.normalize(scriptsDirectory + '/' + f), '\\', '/');
                        })
                    };

                    startInfoJson = JSON.stringify(startInfo);
                    resolve();
                });
            });
        });
    }

    function setStartInfo() {

        var script = 'function startWhenReady(){if (self.Emby && self.Emby.App){self.appStartInfo=' + startInfoJson + ';Emby.App.start(appStartInfo);} else {setTimeout(startWhenReady, 50);}} startWhenReady();';
        sendJavascript(script);
        //sendJavascript('var appStartInfo=' + startInfoJson + ';');
    }

    function sendCommand(cmd) {

        var script = "require(['inputmanager'], function(inputmanager){inputmanager.trigger('" + cmd + "');});";
        sendJavascript(script);
    }

    function sendJavascript(script) {

        // Add some null checks to handle attempts to send JS when the process is closing or has closed
        var win = mainWindow;
        if (win) {
            var web = win.webContents;
            if (web) {
                web.executeJavaScript(script);
            }
        }
    }

    function onAppCommand(e, cmd) {

        //switch (command_id) {
        //    case APPCOMMAND_BROWSER_BACKWARD       : return "browser-backward";
        //    case APPCOMMAND_BROWSER_FORWARD        : return "browser-forward";
        //    case APPCOMMAND_BROWSER_REFRESH        : return "browser-refresh";
        //    case APPCOMMAND_BROWSER_STOP           : return "browser-stop";
        //    case APPCOMMAND_BROWSER_SEARCH         : return "browser-search";
        //    case APPCOMMAND_BROWSER_FAVORITES      : return "browser-favorites";
        //    case APPCOMMAND_BROWSER_HOME           : return "browser-home";
        //    case APPCOMMAND_VOLUME_MUTE            : return "volume-mute";
        //    case APPCOMMAND_VOLUME_DOWN            : return "volume-down";
        //    case APPCOMMAND_VOLUME_UP              : return "volume-up";
        //    case APPCOMMAND_MEDIA_NEXTTRACK        : return "media-nexttrack";
        //    case APPCOMMAND_MEDIA_PREVIOUSTRACK    : return "media-previoustrack";
        //    case APPCOMMAND_MEDIA_STOP             : return "media-stop";
        //    case APPCOMMAND_MEDIA_PLAY_PAUSE       : return "media-play_pause";
        //    case APPCOMMAND_LAUNCH_MAIL            : return "launch-mail";
        //    case APPCOMMAND_LAUNCH_MEDIA_SELECT    : return "launch-media-select";
        //    case APPCOMMAND_LAUNCH_APP1            : return "launch-app1";
        //    case APPCOMMAND_LAUNCH_APP2            : return "launch-app2";
        //    case APPCOMMAND_BASS_DOWN              : return "bass-down";
        //    case APPCOMMAND_BASS_BOOST             : return "bass-boost";
        //    case APPCOMMAND_BASS_UP                : return "bass-up";
        //    case APPCOMMAND_TREBLE_DOWN            : return "treble-down";
        //    case APPCOMMAND_TREBLE_UP              : return "treble-up";
        //    case APPCOMMAND_MICROPHONE_VOLUME_MUTE : return "microphone-volume-mute";
        //    case APPCOMMAND_MICROPHONE_VOLUME_DOWN : return "microphone-volume-down";
        //    case APPCOMMAND_MICROPHONE_VOLUME_UP   : return "microphone-volume-up";
        //    case APPCOMMAND_HELP                   : return "help";
        //    case APPCOMMAND_FIND                   : return "find";
        //    case APPCOMMAND_NEW                    : return "new";
        //    case APPCOMMAND_OPEN                   : return "open";
        //    case APPCOMMAND_CLOSE                  : return "close";
        //    case APPCOMMAND_SAVE                   : return "save";
        //    case APPCOMMAND_PRINT                  : return "print";
        //    case APPCOMMAND_UNDO                   : return "undo";
        //    case APPCOMMAND_REDO                   : return "redo";
        //    case APPCOMMAND_COPY                   : return "copy";
        //    case APPCOMMAND_CUT                    : return "cut";
        //    case APPCOMMAND_PASTE                  : return "paste";
        //    case APPCOMMAND_REPLY_TO_MAIL          : return "reply-to-mail";
        //    case APPCOMMAND_FORWARD_MAIL           : return "forward-mail";
        //    case APPCOMMAND_SEND_MAIL              : return "send-mail";
        //    case APPCOMMAND_SPELL_CHECK            : return "spell-check";
        //    case APPCOMMAND_MIC_ON_OFF_TOGGLE      : return "mic-on-off-toggle";
        //    case APPCOMMAND_CORRECTION_LIST        : return "correction-list";
        //    case APPCOMMAND_MEDIA_PLAY             : return "media-play";
        //    case APPCOMMAND_MEDIA_PAUSE            : return "media-pause";
        //    case APPCOMMAND_MEDIA_RECORD           : return "media-record";
        //    case APPCOMMAND_MEDIA_FAST_FORWARD     : return "media-fast-forward";
        //    case APPCOMMAND_MEDIA_REWIND           : return "media-rewind";
        //    case APPCOMMAND_MEDIA_CHANNEL_UP       : return "media-channel-up";
        //    case APPCOMMAND_MEDIA_CHANNEL_DOWN     : return "media-channel-down";
        //    case APPCOMMAND_DELETE                 : return "delete";
        //    case APPCOMMAND_DICTATE_OR_COMMAND_CONTROL_TOGGLE:
        //        return "dictate-or-command-control-toggle";
        //    default:
        //        return "unknown";

        if (cmd != 'Unknown') {
            //alert(cmd);
        }

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
                sendCommand("search");
                break;
            case 'browser-favorites':
                sendCommand("favorites");
                break;
            case 'browser-home':
                sendCommand("home");
                break;
            case 'browser-refresh':
                sendCommand("refresh");
                break;
            case 'find':
                sendCommand("search");
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
            case 'media-channel-up':
                sendCommand("channelup");
                break;
            case 'media-channel-down':
                sendCommand("channeldown");
                break;
            case 'menu':
                sendCommand("menu");
                break;
            case 'info':
                sendCommand("info");
                break;
        }
    }

    function setCommandLineSwitches() {

        var isLinux = require('is-linux');

        if (isLinux()) {
            app.commandLine.appendSwitch('enable-transparent-visuals');
            app.disableHardwareAcceleration();
        }

        else if (process.platform === 'win32') {
            //app.disableHardwareAcceleration();

            app.commandLine.appendSwitch('high-dpi-support', 'true');
            app.commandLine.appendSwitch('force-device-scale-factor', '1');
        }
    }

    function supportsTransparentWindow() {

        return true;
    }

    function getWindowStateDataPath() {

        var path = require("path");
        return path.join(app.getPath('userData'), "windowstate.json");
    }

    function closeWindow(win) {

        try {
            win.close();
        } catch (err) {
            console.log('Error closing window. It may have already been closed. ' + err);
        }
    }

    function onWindowClose() {

        if (hasAppLoaded) {
            var data = mainWindow.getBounds();
            data.state = currentWindowState;
            var windowStatePath = getWindowStateDataPath();
            require("fs").writeFileSync(windowStatePath, JSON.stringify(data));
        }

        mainWindow.webContents.executeJavaScript('AppCloseHelper.onClosing();');

        // Unregister all shortcuts.
        electron.globalShortcut.unregisterAll();
        closeWindow(playerWindow);

        app.quit();
    }

    function parseCommandLine() {

        var isWindows = require('is-windows');

        var result = {};
        var commandLineArguments = process.argv.slice(2);

        var index = 0;

        if (isWindows()) {
            result.userDataPath = commandLineArguments[index];
            index++;
        }

        result.cecExePath = commandLineArguments[index];
        index++;

        result.mpvPath = commandLineArguments[index];
        index++;

        return result;
    }

    var commandLineOptions = parseCommandLine();

    var userDataPath = commandLineOptions.userDataPath;
    if (userDataPath) {
        app.setPath('userData', userDataPath);
    }

    function onCecCommand(cmd) {
        console.log("Command received: " + cmd);
        sendCommand(cmd);
    }

    /* CEC Module */
    function initCec() {

        try {
            const cec = require('./cec/cec');
            var cecExePath = commandLineOptions.cecExePath;
            // create the cec event
            const EventEmitter = require("events").EventEmitter;
            var cecEmitter = new EventEmitter();
            var cecOpts = {
                cecExePath: cecExePath,
                cecEmitter: cecEmitter
            };
            cec.init(cecOpts);

            cecEmitter.on("receive-cmd", onCecCommand);

        } catch (err) {
            console.log('error initializing cec: ' + err);
        }
    }

    function getWindowId(win) {

        var Long = require("long");
        var os = require("os");
        var handle = win.getNativeWindowHandle();

        if (os.endianness() == "LE") {

            if (handle.length == 4) {
                handle.swap32();
            } else if (handle.length == 8) {
                handle.swap64();
            } else {
                console.log("Unknown Native Window Handle Format.");
            }
        }
        var longVal = Long.fromString(handle.toString('hex'), unsigned = true, radix = 16);

        return longVal.toString();
    }

    function initPlaybackHandler(mpvPath) {

        var playbackhandler = require('./playbackhandler/playbackhandler');
        playbackhandler.initialize(getWindowId(playerWindow), mpvPath);
        playbackhandler.registerMediaPlayerProtocol(electron.protocol, mainWindow);
    }

    setCommandLineSwitches();

    var fullscreenOnShow = false;
    var windowShowCount = 0;
    function onWindowShow() {

        windowShowCount++;
        if (windowShowCount == 2) {

            mainWindow.setFullScreen(true);

            if (!fullscreenOnShow) {
                // hack alert. in electron 1.4 under windows, the app starts up black. changing window state seems to resolve it.
                mainWindow.setFullScreen(false);
            }

            fullscreenOnShow = false;

            mainWindow.center();
            mainWindow.focus();
            initialShowEventsComplete = true;
        }
    }

    app.on('quit', function () {
        closeWindow(mainWindow);
    });

    function onPlayerWindowRestore() {
        mainWindow.focus();
    }

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    app.on('ready', function () {

        var isWindows = require('is-windows');
        var windowStatePath = getWindowStateDataPath();

        var previousWindowInfo;
        try {
            previousWindowInfo = JSON.parse(require("fs").readFileSync(windowStatePath, 'utf8'));
        }
        catch (e) {
            previousWindowInfo = {};
        }

        var windowOptions = {
            transparent: false, //supportsTransparency,
            frame: false,
            resizable: false,
            title: 'Emby Theater',
            minWidth: 720,
            minHeight: 480,
            //alwaysOnTop: true,
            skipTaskbar: isWindows() ? false : true,

            //show: false,
            backgroundColor: '#00000000',
            center: true,
            show: false,

            webPreferences: {
                webSecurity: false,
                webgl: false,
                nodeIntegration: false,
                plugins: false,
                webaudio: true,
                java: false,
                allowDisplayingInsecureContent: true,
                allowRunningInsecureContent: true,
                experimentalFeatures: false,
                blinkFeatures: 'CSSOMSmoothScroll',
                devTools: enableDevTools
            },

            icon: __dirname + '/icon.ico'
        };

        windowOptions.width = previousWindowInfo.width || 1280;
        windowOptions.height = previousWindowInfo.height || 720;
        if (previousWindowInfo.x != null && previousWindowInfo.y != null) {
            windowOptions.x = previousWindowInfo.x;
            windowOptions.y = previousWindowInfo.y;
        }

        playerWindow = new BrowserWindow(windowOptions);

        windowOptions.backgroundColor = '#00000000';
        windowOptions.parent = playerWindow;
        windowOptions.transparent = true;
        windowOptions.resizable = true;
        windowOptions.skipTaskbar = false;
        // Create the browser window.

        loadStartInfo().then(function () {

            mainWindow = new BrowserWindow(windowOptions);

            if (enableDevToolsOnStartup) {
                mainWindow.openDevTools();
            }

            mainWindow.webContents.on('dom-ready', setStartInfo);

            var url = getAppUrl();

            windowStateOnLoad = previousWindowInfo.state;

            addPathIntercepts();

            registerAppHost();
            registerFileSystem();
            registerServerdiscovery();

            // and load the index.html of the app.
            mainWindow.loadURL(url);

            mainWindow.setMenu(null);
            mainWindow.on('move', onWindowMoved);
            mainWindow.on('app-command', onAppCommand);
            mainWindow.on("close", onWindowClose);
            mainWindow.on("minimize", onMinimize);
            mainWindow.on("maximize", onMaximize);
            mainWindow.on("enter-full-screen", onEnterFullscreen);
            mainWindow.on("leave-full-screen", onLeaveFullscreen);
            mainWindow.on("restore", onRestore);
            mainWindow.on("unmaximize", onUnMaximize);
            mainWindow.on("resize", onWindowResize);

            playerWindow.on("restore", onPlayerWindowRestore);
            playerWindow.on("enter-full-screen", onPlayerWindowRestore);
            playerWindow.on("maximize", onPlayerWindowRestore);
            playerWindow.on("focus", onPlayerWindowRestore);

            playerWindow.on("show", onWindowShow);
            mainWindow.on("show", onWindowShow);

            // Only the main window should be set to full screen.
            // This is done after the window is shown because the
            // player window otherwise is shown behind the task bar.
            if (previousWindowInfo.state == 'Fullscreen') {
                fullscreenOnShow = true;
            }

            playerWindow.show();
            mainWindow.show();

            initCec();

            initPlaybackHandler(commandLineOptions.mpvPath);
        });
    });
})();
