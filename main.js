(function () {

    let currentWindowState;
    const electron = require('electron');
    const settings = require('electron-settings');
    const path = require('path');
    const {ipcMain} = require('electron');

    const app = electron.app;  // Module to control application life.
    const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.

    // Keep a global reference of the window object, if you don't, the window will
    // be closed automatically when the JavaScript object is garbage collected.
    let mainWindow = null;
    let playerWindow = null;
    let hasAppLoaded = false;

    const enableDevTools = false;
    const enableDevToolsOnStartup = false;
    let initialShowEventsComplete = false;
    let previousBounds;
    let cecProcess;

    const isLinux = require('is-linux')();

    // Quit when all windows are closed.
    app.on('window-all-closed', function () {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    // receive message from index.html 
    ipcMain.on('asynchronous-message', (event, arg) => {
        settings.set('server', {
            url: arg
        });
        app.relaunch();
        app.quit(0)
    });

    function onWindowMoved() {

        mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("move", {}));');
        const winPosition = mainWindow.getPosition();
        playerWindow.setPosition(winPosition[0], winPosition[1]);
    }

    function onWindowResize() {

        if (!useTrueFullScreen || currentWindowState === 'Normal') {
            const bounds = mainWindow.getBounds();
            playerWindow.setBounds(bounds);
        }
    }

    currentWindowState = "Normal";
    let restoreWindowState;

    function setWindowState(state) {

        let bounds;
        restoreWindowState = null;
        const previousState = currentWindowState;

        if (state === 'Maximized') {
            state = 'Fullscreen';
        }

        if (state === 'Minimized') {
            restoreWindowState = previousState;
            mainWindow.setAlwaysOnTop(false);
            mainWindow.minimize();
        } else if (state === 'Maximized') {

            if (previousState === "Minimized") {
                mainWindow.restore();
            }

            mainWindow.maximize();
            mainWindow.setAlwaysOnTop(false);

        } else if (state === 'Fullscreen') {

            if (previousState === "Minimized") {
                mainWindow.restore();
            }

            bounds = mainWindow.getBounds();
            previousBounds = bounds;

            mainWindow.setFullScreen(true);
            mainWindow.setAlwaysOnTop(true);

            // So far this is only needed for returning from external player playback
            mainWindow.focus();

        } else {

            let setSize = false;
            if (previousState === "Minimized") {
                mainWindow.restore();
            }

            else if (previousState === "Fullscreen") {
                setSize = true;
                mainWindow.setFullScreen(false);
            }

            else if (previousState === "Maximized") {
                mainWindow.unmaximize();
            }

            if (setSize) {
                bounds = previousBounds;
                if (bounds) {
                    mainWindow.setBounds(bounds);
                } else {
                    mainWindow.setSize(1280, 720);
                    mainWindow.center();
                }
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

        const restoreState = restoreWindowState;
        restoreWindowState = null;
        if (restoreState && restoreState !== 'Normal' && restoreState !== 'Minimized') {
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

            if (useTrueFullScreen) {
                playerWindow.setFullScreen(true);
            }
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

    const customFileProtocol = 'electronfile';

    function addPathIntercepts() {

        const protocol = electron.protocol;
        const path = require('path');

        protocol.registerFileProtocol(customFileProtocol, function (request, callback) {

            // Add 3 to account for ://
            let url = request.url.substr(customFileProtocol.length + 3);
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

        const sleepMode = require('sleep-mode');
        sleepMode(function (err, stderr, stdout) {
        });
    }

    function restartSystem() {
    }

    function shutdownSystem() {

        const powerOff = require('power-off');
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

    let isTransparencyRequired = false;
    let windowStateOnLoad;

    function registerAppHost() {

        const protocol = electron.protocol;
        const customProtocol = 'electronapphost';

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            const url = request.url.substr(customProtocol.length + 3);
            const parts = url.split('?');
            const command = parts[0];

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

                    const options = require('querystring').parse(parts[1]);
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

    const processes = {};

    function startProcess(options, callback) {

        let pid;
        const args = (options.arguments || '').split('|||');

        try {
            const process = require('child_process').execFile(options.path, args, {}, function (error, stdout, stderr) {

                if (error) {
                    console.log('Process closed with error: ' + error);
                }
                processes[pid] = null;
                const script = 'onChildProcessClosed(\"' + pid + '\", ' + (error ? 'true' : 'false') + ');';

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

        const process = processes[id];
        if (process) {
            process.kill();
        }
        callback("");
    }

    function registerFileSystem() {

        const protocol = electron.protocol;
        const customProtocol = 'electronfs';

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            const url = request.url.substr(customProtocol.length + 3).split('?')[0];
            const fs = require('fs');

            switch (url) {

                case 'fileexists':
                case 'directoryexists':

                    const path = request.url.split('=')[1];

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

        const protocol = electron.protocol;
        const customProtocol = 'electronserverdiscovery';
        const serverdiscovery = require('./serverdiscovery/serverdiscovery-native');

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            const url = request.url.substr(customProtocol.length + 3).split('?')[0];

            switch (url) {
                case 'findservers':
                    const timeoutMs = request.url.split('=')[1];
                    serverdiscovery.findServers(timeoutMs, callback);
                    break;
                default:
                    callback("");
                    break;
            }
        });
    }

    function registerWakeOnLan() {

        const protocol = electron.protocol;
        const customProtocol = 'electronwakeonlan';
        const wakeonlan = require('./wakeonlan/wakeonlan-native');

        protocol.registerStringProtocol(customProtocol, function (request, callback) {

            // Add 3 to account for ://
            const url = request.url.substr(customProtocol.length + 3).split('?')[0];

            switch (url) {
                case 'wakeserver':
                    const mac = request.url.split('=')[1].split('&')[0];
                    const options = {port: request.url.split('=')[2]};
                    wakeonlan.wake(mac, options, callback);
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
        return settings.get('server.url', null);
    }

    function getAppUrl() {
        let url = getAppBaseUrl();

        if (url) {
            url += '/web/index.html';
        }

        return url;
    }

    let startInfoJson;

    function loadStartInfo() {

        return new Promise(function (resolve, reject) {

            const os = require("os");

            const path = require('path');
            const fs = require('fs');

            const topDirectory = path.normalize(__dirname);
            const pluginDirectory = path.normalize(__dirname + '/plugins');
            const scriptsDirectory = path.normalize(__dirname + '/scripts');

            fs.readdir(pluginDirectory, function (err, pluginFiles) {

                fs.readdir(scriptsDirectory, function (err, scriptFiles) {

                    pluginFiles = pluginFiles || [];
                    scriptFiles = scriptFiles || [];

                    const startInfo = {
                        paths: {
                            apphost: customFileProtocol + '://apphost',
                            shell: customFileProtocol + '://shell',
                            wakeonlan: customFileProtocol + '://wakeonlan/wakeonlan',
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

                            return f.indexOf('.js') !== -1;

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

        const script = 'function startWhenReady(){if (self.Emby && self.Emby.App){self.appStartInfo=' + startInfoJson + ';Emby.App.start(appStartInfo);} else {setTimeout(startWhenReady, 50);}} startWhenReady();';
        sendJavascript(script);
        //sendJavascript('var appStartInfo=' + startInfoJson + ';');
    }

    function sendCommand(cmd) {

        const script = "require(['inputmanager'], function(inputmanager){inputmanager.trigger('" + cmd + "');});";
        sendJavascript(script);
    }

    function sendJavascript(script) {

        // Add some null checks to handle attempts to send JS when the process is closing or has closed
        const win = mainWindow;
        if (win) {
            const web = win.webContents;
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
        //    case APPCOMMAND_MEDIA_PLAY_PAUSE       : return "media-play-pause";
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

        if (cmd !== 'Unknown') {
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
            case 'media-play-pause':
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

        const isLinux = require('is-linux');

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

        const path = require('path');
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
            const data = mainWindow.getBounds();
            data.state = currentWindowState;
            const windowStatePath = getWindowStateDataPath();
            require("fs").writeFileSync(windowStatePath, JSON.stringify(data));
        }

        mainWindow.webContents.executeJavaScript('AppCloseHelper.onClosing();');

        // Unregister all shortcuts.
        electron.globalShortcut.unregisterAll();
        closeWindow(playerWindow);

        if (cecProcess) {
            cecProcess.kill();
        }

        app.quit();
    }

    function parseCommandLine() {

        const isWindows = require('is-windows');

        const result = {};
        const commandLineArguments = process.argv.slice(2);

        let index = 0;

        if (isWindows()) {
            result.userDataPath = commandLineArguments[index];
            index++;
        }

        result.cecExePath = commandLineArguments[index] || 'cec-client';
        index++;

        result.mpvPath = commandLineArguments[index];
        index++;

        return result;
    }

    const commandLineOptions = parseCommandLine();

    const userDataPath = commandLineOptions.userDataPath;
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
            const cecExePath = commandLineOptions.cecExePath;
            // create the cec event
            const EventEmitter = require("events").EventEmitter;
            const cecEmitter = new EventEmitter();
            const cecOpts = {
                cecExePath: cecExePath,
                cecEmitter: cecEmitter
            };
            cecProcess = cec.init(cecOpts);

            cecEmitter.on("receive-cmd", onCecCommand);

        } catch (err) {
            console.log('error initializing cec: ' + err);
        }
    }

    function getWindowId(win) {

        const Long = require("long");
        const os = require("os");
        const handle = win.getNativeWindowHandle();

        if (os.endianness() === "LE") {

            if (handle.length === 4) {
                handle.swap32();
            } else if (handle.length === 8) {
                handle.swap64();
            } else {
                console.log("Unknown Native Window Handle Format.");
            }
        }
        const longVal = Long.fromString(handle.toString('hex'), unsigned = true, radix = 16);

        return longVal.toString();
    }

    function initPlaybackHandler(mpvPath) {

        const playbackhandler = require('./playbackhandler/playbackhandler');
        playbackhandler.initialize(getWindowId(playerWindow), mpvPath);
        playbackhandler.registerMediaPlayerProtocol(electron.protocol, mainWindow);
    }

    setCommandLineSwitches();

    let fullscreenOnShow = false;
    let windowShowCount = 0;

    function onWindowShow() {

        windowShowCount++;
        if (windowShowCount === 2) {

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

        const isWindows = require('is-windows')();
        const windowStatePath = getWindowStateDataPath();
        const enableNodeIntegration = !getAppUrl();
        let previousWindowInfo;
        try {
            previousWindowInfo = JSON.parse(require("fs").readFileSync(windowStatePath, 'utf8'));
        }
        catch (e) {
            previousWindowInfo = {};
        }
        const windowOptions = {
            transparent: false, //supportsTransparency,
            frame: false,
            title: 'Jellyfin Theater',
            minWidth: 1280,
            minHeight: 720,
            //alwaysOnTop: true,
            skipTaskbar: !(isWindows || isLinux),

            //show: false,
            backgroundColor: '#00000000',
            center: true,
            show: false,
            resizable: isLinux,

            webPreferences: {
                webSecurity: false,
                webgl: false,
                nodeIntegration: enableNodeIntegration,
                plugins: false,
                webaudio: true,
                java: false,
                allowDisplayingInsecureContent: true,
                allowRunningInsecureContent: true,
                experimentalFeatures: false,
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

            const url = getAppUrl();
            windowStateOnLoad = previousWindowInfo.state;

            addPathIntercepts();

            registerAppHost();
            registerFileSystem();
            registerServerdiscovery();
            registerWakeOnLan();
 
            if (url) {
                mainWindow.loadURL(url);
            } else {
                const localPath = path.join(`file://${__dirname}/firstrun/Jellyfin.html`);
                mainWindow.loadURL(localPath);                        
            }
            
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
            if (previousWindowInfo.state === 'Fullscreen') {
                fullscreenOnShow = true;
            }

            playerWindow.show();
            mainWindow.show();

            initCec();

            initPlaybackHandler(commandLineOptions.mpvPath);

            const isRpi = require('detect-rpi');
            if (isRpi()) {
                mainWindow.setFullScreen(true);
                mainWindow.setAlwaysOnTop(true);
            }
        });
    });
})();
