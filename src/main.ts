import { ChildProcess, execFile } from "child_process";
import { expose, wrap } from "comlink";
import {
    mainProcObjectEndpoint,
    rendererProcObjectEndpoint
} from "comlink-electron-adapter";
import * as merge from "deepmerge";
import * as isRpi from "detect-rpi";
import {
    app,
    BrowserWindow,
    BrowserWindowConstructorOptions,
    dialog,
    globalShortcut,
    ipcMain,
    protocol,
    Rectangle,
    shell
} from "electron";
import * as settings from "electron-settings";
import { EventEmitter } from "events";
import { access, readdir, readFileSync, writeFileSync } from "fs";
import * as isLinux from "is-linux";
import * as isWindows from "is-windows";
import * as Long from "long";
import { endianness, hostname } from "os";
import { join, normalize } from "path";
import powerOff from "power-off";
import { parse } from "querystring";
import sleepMode from "sleep-mode";
import { promisify } from "util";
import { TheaterApi } from "./api";
import { RendererApi } from "./api/renderer";

import * as cec from "./cec/cec";
import * as playbackhandler from "./playbackhandler/playbackhandler";
import * as serverdiscovery from "./serverdiscovery/serverdiscovery-native";
import { IDevToolsBrowserWindow, WindowState } from "./types";
import { assertStringOrNull } from "./utils";
import * as wakeonlan from "./wakeonlan/wakeonlan-native";

const readdirAsync = promisify(readdir);

export async function main() {
    // Keep a global reference of the window object, if you don't, the window will
    // be closed automatically when the JavaScript object is garbage collected.
    let mainWindow: IDevToolsBrowserWindow;
    let playerWindow: IDevToolsBrowserWindow;

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    app.on("ready", async () => {
        const windowStatePath = getWindowStateDataPath();
        const appUrl = getAppUrl();
        const enableNodeIntegration = !appUrl;
        let previousWindowInfo;
        try {
            previousWindowInfo = JSON.parse(
                readFileSync(windowStatePath, "utf8")
            );
        } catch (e) {
            previousWindowInfo = {};
        }
        const windowOptions: BrowserWindowConstructorOptions = {
            transparent: false, // supportsTransparency,
            frame: true,
            title: "Jellyfin Theater",
            minWidth: 1280,
            minHeight: 720,
            // alwaysOnTop: true,
            skipTaskbar: !(isWindows || isLinux),

            // show: false,
            backgroundColor: "#00000000",
            center: true,
            show: false,
            resizable: isLinux,

            webPreferences: {
                webSecurity: false,
                webgl: false,
                nodeIntegration: enableNodeIntegration,
                plugins: false,
                allowRunningInsecureContent: !appUrl.startsWith("https"),
                experimentalFeatures: false,
                devTools: enableDevTools
            },

            icon: `${__dirname}/../icons/512x512.png`
        };

        windowOptions.width = previousWindowInfo.width || 1280;
        windowOptions.height = previousWindowInfo.height || 720;
        if (previousWindowInfo.x != null && previousWindowInfo.y != null) {
            windowOptions.x = previousWindowInfo.x;
            windowOptions.y = previousWindowInfo.y;
        }

        playerWindow = new BrowserWindow(
            windowOptions
        ) as IDevToolsBrowserWindow;

        windowOptions.backgroundColor = "#00000000";
        windowOptions.parent = playerWindow;
        windowOptions.transparent = true;
        windowOptions.resizable = true;
        windowOptions.skipTaskbar = false;

        const mainWindowOptions = merge<BrowserWindowConstructorOptions>(
            {
                webPreferences: {
                    preload: join(__dirname, "renderer/index.js")
                }
            },
            windowOptions
        );

        const startInfo = await loadStartInfo();

        // Create the browser window.
        mainWindow = new BrowserWindow(
            mainWindowOptions
        ) as IDevToolsBrowserWindow;

        if (enableDevToolsOnStartup) {
            mainWindow.openDevTools();
        }

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
            const localPath = join(
                `file://${__dirname}/../assets/firstrun/Jellyfin.html`
            );
            mainWindow.loadURL(localPath);
        }

        mainWindow.setMenu(null);

        playerWindow.on("restore", onPlayerWindowRestore);
        playerWindow.on("enter-full-screen", onPlayerWindowRestore);
        playerWindow.on("maximize", onPlayerWindowRestore);
        playerWindow.on("focus", onPlayerWindowRestore);

        playerWindow.on("show", onWindowShow);
        mainWindow.on("show", onWindowShow);

        // Only the main window should be set to full screen.
        // This is done after the window is shown because the
        // player window otherwise is shown behind the task bar.
        if (previousWindowInfo.state === "Fullscreen") {
            fullscreenOnShow = true;
        }

        initCec();

        initPlaybackHandler(commandLineOptions.mpvPath);
        if (isRpi()) {
            mainWindow.setFullScreen(true);
            mainWindow.setAlwaysOnTop(true);
        }

        const endpoint = rendererProcObjectEndpoint(
            ipcMain,
            mainWindow.webContents
        );
        const rendererApi = wrap<RendererApi>(endpoint);
        rendererApi.comtest().then(() => {
            console.info("Communication main -> renderer established");
        });

        mainWindow.webContents.on("dom-ready", () =>
            rendererApi.setStartInfo(startInfo)
        );

        mainWindow.on("move", () => rendererApi.onMove());
        mainWindow.on("app-command", async (e, cmd) => {
            switch (cmd) {
                case "browser-backward":
                    if (mainWindow.webContents.canGoBack()) {
                        mainWindow.webContents.goBack();
                    }
                    break;
                case "browser-forward":
                    if (mainWindow.webContents.canGoForward()) {
                        mainWindow.webContents.goForward();
                    }
                    break;
                case "browser-stop":
                    await rendererApi.executeCommand("stop");
                    break;
                case "browser-search":
                    await rendererApi.executeCommand("search");
                    break;
                case "browser-favorites":
                    await rendererApi.executeCommand("favorites");
                    break;
                case "browser-home":
                    await rendererApi.executeCommand("home");
                    break;
                case "browser-refresh":
                    await rendererApi.executeCommand("refresh");
                    break;
                case "find":
                    await rendererApi.executeCommand("search");
                    break;
                case "volume-mute":
                    await rendererApi.executeCommand("togglemute");
                    break;
                case "volume-down":
                    await rendererApi.executeCommand("volumedown");
                    break;
                case "volume-up":
                    await rendererApi.executeCommand("volumeup");
                    break;
                case "media-nexttrack":
                    await rendererApi.executeCommand("next");
                    break;
                case "media-previoustrack":
                    await rendererApi.executeCommand("previous");
                    break;
                case "media-stop":
                    await rendererApi.executeCommand("stop");
                    break;
                case "media-play":
                    await rendererApi.executeCommand("play");
                    break;
                case "media-pause":
                    await rendererApi.executeCommand("pause");
                    break;
                case "media-record":
                    await rendererApi.executeCommand("record");
                    break;
                case "media-fast-forward":
                    await rendererApi.executeCommand("fastforward");
                    break;
                case "media-rewind":
                    await rendererApi.executeCommand("rewind");
                    break;
                case "media-play-pause":
                    await rendererApi.executeCommand("playpause");
                    break;
                case "media-channel-up":
                    await rendererApi.executeCommand("channelup");
                    break;
                case "media-channel-down":
                    await rendererApi.executeCommand("channeldown");
                    break;
                case "menu":
                    await rendererApi.executeCommand("menu");
                    break;
                case "info":
                    await rendererApi.executeCommand("info");
                    break;
            }
        });
        mainWindow.on("close", async () => {
            if (hasAppLoaded) {
                const data: any = mainWindow.getBounds();
                data.state = currentWindowState;
                writeFileSync(windowStatePath, JSON.stringify(data));
            }

            await rendererApi.onClosing();

            // Unregister all shortcuts.
            globalShortcut.unregisterAll();
            closeWindow(playerWindow);

            if (cecProcess) {
                cecProcess.kill();
            }

            app.quit();
        });
        mainWindow.on("minimize", () =>
            rendererApi.onWindowStateChanged("Minimized")
        );
        mainWindow.on("maximize", () =>
            rendererApi.onWindowStateChanged("Maximized")
        );
        mainWindow.on("enter-full-screen", async () => {
            await rendererApi.onWindowStateChanged("Fullscreen");

            if (initialShowEventsComplete) {
                if (isLinux) {
                    playerWindow.setFullScreen(true);
                }
                mainWindow.setMovable(false);
            }
        });
        mainWindow.on("leave-full-screen", async () => {
            await rendererApi.onWindowStateChanged("Normal");

            if (initialShowEventsComplete) {
                playerWindow.setFullScreen(false);
                mainWindow.setMovable(true);
            }
        });
        mainWindow.on("restore", async () => {
            const restoreState = restoreWindowState;
            restoreWindowState = null;
            if (
                restoreState &&
                restoreState !== "Normal" &&
                restoreState !== "Minimized"
            ) {
                setWindowState(restoreState);
            } else {
                await rendererApi.onWindowStateChanged("Normal");
            }
        });
        mainWindow.on("unmaximize", () =>
            rendererApi.onWindowStateChanged("Normal")
        );
        mainWindow.on("resize", () => {
            if (!isLinux || currentWindowState === "Normal") {
                const bounds = mainWindow.getBounds();
                playerWindow.setBounds(bounds);
            }
        });

        mainWindow.once("ready-to-show", async () => {
            mainWindow.show();
        });

        const theaterApi = new TheaterApi();
        expose(theaterApi, mainProcObjectEndpoint(ipcMain));
    });

    let currentWindowState: WindowState;
    let hasAppLoaded = false;

    const enableDevTools = true;
    const enableDevToolsOnStartup = true;
    let initialShowEventsComplete = false;
    let previousBounds: Rectangle;
    let cecProcess: ChildProcess;

    // Quit when all windows are closed.
    app.on("window-all-closed", () => {
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== "darwin") {
            app.quit();
        }
    });

    // receive message from index.html
    ipcMain.on("asynchronous-message", (event, arg) => {
        settings.set("server", {
            url: arg
        });
        app.relaunch();
        app.quit();
    });

    currentWindowState = "Normal";
    let restoreWindowState: WindowState;

    function setWindowState(state: WindowState) {
        restoreWindowState = null;
        const previousState = currentWindowState;

        /*if (state === "Maximized") {
            state = "Fullscreen";
        }*/

        if (state === "Minimized") {
            restoreWindowState = previousState;
            mainWindow.setAlwaysOnTop(false);
            mainWindow.minimize();
        } else if (state === "Maximized") {
            if (previousState === "Minimized") {
                mainWindow.restore();
            }

            mainWindow.maximize();
            mainWindow.setAlwaysOnTop(false);
        } else if (state === "Fullscreen") {
            if (previousState === "Minimized") {
                mainWindow.restore();
            }

            previousBounds = mainWindow.getBounds();

            mainWindow.setFullScreen(true);
            mainWindow.setAlwaysOnTop(true);

            // So far this is only needed for returning from external player playback
            mainWindow.focus();
        } else {
            let setSize = false;
            if (previousState === "Minimized") {
                mainWindow.restore();
            } else if (previousState === "Fullscreen") {
                setSize = true;
                mainWindow.setFullScreen(false);
            } else if (previousState === "Maximized") {
                mainWindow.unmaximize();
            }

            if (setSize) {
                const bounds = previousBounds;
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

    const customFileProtocol = "electronfile";

    function addPathIntercepts() {
        protocol.registerFileProtocol(
            customFileProtocol,
            (request, callback) => {
                // Add 3 to account for ://
                let url = request.url.substr(customFileProtocol.length + 3);
                url = `${__dirname}/${url}`;
                url = url.split("?")[0];

                callback(normalize(url));
            }
        );

        // protocol.interceptHttpProtocol('https', function (request, callback) {

        //    alert(request.url);
        //    callback({ 'url': request.url, 'referrer': request.referrer, session: null });
        // });
    }

    function sleepSystem() {
        sleepMode(() => {});
    }

    function restartSystem() {}

    function shutdownSystem() {
        powerOff(() => {});
    }

    function setMainWindowResizable(resizable) {
        try {
            mainWindow.setResizable(resizable);
        } catch (err) {
            console.log(`Error in setResizable:${err}`);
        }
    }

    let isTransparencyRequired = false;
    let windowStateOnLoad;

    function registerAppHost() {
        const customProtocol = "electronapphost";

        protocol.registerStringProtocol(customProtocol, (request, callback) => {
            // Add 3 to account for ://
            const url = request.url.substr(customProtocol.length + 3);
            const parts = url.split("?");
            const command = parts[0];

            switch (command) {
                case "windowstate-Normal":
                    setMainWindowResizable(!isTransparencyRequired);
                    setWindowState("Normal");

                    break;
                case "windowstate-Maximized":
                    setMainWindowResizable(false);
                    setWindowState("Maximized");
                    break;
                case "windowstate-Fullscreen":
                    setMainWindowResizable(false);
                    setWindowState("Fullscreen");
                    break;
                case "windowstate-Minimized":
                    setWindowState("Minimized");
                    break;
                case "exit":
                    closeWindow(mainWindow);
                    break;
                case "sleep":
                    sleepSystem();
                    break;
                case "shutdown":
                    shutdownSystem();
                    break;
                case "restart":
                    restartSystem();
                    break;
                case "openurl":
                    shell.openExternal(url.substring(url.indexOf("url=") + 4));
                    break;
                case "shellstart":
                    const options = parse(parts[1]);
                    startProcess(options, callback);
                    return;
                case "shellclose":
                    closeProcess(parse(parts[1]).id, callback);
                    return;
                case "video-on":
                    isTransparencyRequired = true;
                    setMainWindowResizable(false);
                    break;
                case "video-off":
                    isTransparencyRequired = false;
                    setMainWindowResizable(true);
                    break;
                case "loaded":
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
        // var globalShortcut = electron.globalShortcut;

        // globalShortcut.register('mediastop', function () {
        //    sendCommand('stop');
        // });

        // globalShortcut.register('mediaplaypause', function () {
        // });

        sendJavascript(`window.PlayerWindowId="${getWindowId(playerWindow)}";`);
    }

    const processes = {};

    function startProcess(options, callback) {
        let pid;
        const args = (options.arguments || "").split("|||");

        try {
            const process = execFile(options.path, args, {}, error => {
                if (error) {
                    console.log(`Process closed with error: ${error}`);
                }
                processes[pid] = null;
                const script = `onChildProcessClosed("${pid}", ${
                    error ? "true" : "false"
                });`;

                sendJavascript(script);
            });

            pid = process.pid.toString();
            processes[pid] = process;
            callback(pid);
        } catch (err) {
            alert(`Error launching process: ${err}`);
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
        const customProtocol = "electronfs";

        protocol.registerStringProtocol(customProtocol, (request, callback) => {
            // Add 3 to account for ://
            const url = request.url
                .substr(customProtocol.length + 3)
                .split("?")[0];

            switch (url) {
                case "fileexists":
                case "directoryexists":
                    const path = request.url.split("=")[1];

                    access(path, err => {
                        if (err) {
                            console.error(`fs access result for path: ${err}`);

                            callback("false");
                        } else {
                            callback("true");
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
        const customProtocol = "electronserverdiscovery";
        protocol.registerStringProtocol(customProtocol, (request, callback) => {
            // Add 3 to account for ://
            const url = request.url
                .substr(customProtocol.length + 3)
                .split("?")[0];

            // noinspection JSRedundantSwitchStatement
            switch (url) {
                case "findservers":
                    const timeoutMs = request.url.split("=")[1];
                    serverdiscovery.findServers(timeoutMs, callback);
                    break;
                default:
                    callback("");
                    break;
            }
        });
    }

    function registerWakeOnLan() {
        const customProtocol = "electronwakeonlan";
        protocol.registerStringProtocol(customProtocol, (request, callback) => {
            // Add 3 to account for ://
            const url = request.url
                .substr(customProtocol.length + 3)
                .split("?")[0];

            // noinspection JSRedundantSwitchStatement
            switch (url) {
                case "wakeserver":
                    const mac = request.url.split("=")[1].split("&")[0];
                    const options = { port: request.url.split("=")[2] };
                    wakeonlan.wake(mac, options, callback);
                    break;
                default:
                    callback("");
                    break;
            }
        });
    }

    function alert(text) {
        dialog.showMessageBox(mainWindow, {
            message: text.toString(),
            buttons: ["ok"]
        });
    }

    function replaceAll(str, find, replace) {
        return str.split(find).join(replace);
    }

    function getAppBaseUrl(): string {
        const url = settings.get("server.url", null);
        return assertStringOrNull(url);
    }

    function getAppUrl(): string {
        let url = getAppBaseUrl();

        if (url) {
            url += "/web/index.html";
        }

        return url;
    }

    async function loadStartInfo() {
        const topDirectory = normalize(__dirname);
        const pluginDirectory = normalize(`${__dirname}/plugins`);
        const scriptsDirectory = normalize(`${__dirname}/scripts`);

        const pluginFiles = (await readdirAsync(pluginDirectory)) || [];
        const scriptFiles = (await readdirAsync(scriptsDirectory)) || [];
        const startInfo = {
            paths: {
                apphost: `${customFileProtocol}://apphost`,
                shell: `${customFileProtocol}://shell`,
                wakeonlan: `${customFileProtocol}://wakeonlan/wakeonlan`,
                serverdiscovery: `${customFileProtocol}://serverdiscovery/serverdiscovery`,
                fullscreenmanager: `file://${replaceAll(
                    normalize(topDirectory + "/fullscreenmanager.js"),
                    "\\",
                    "/"
                )}`,
                filesystem: `${customFileProtocol}://filesystem`
            },
            name: app.getName(),
            version: app.getVersion(),
            deviceName: hostname(),
            deviceId: hostname(),
            supportsTransparentWindow: supportsTransparentWindow(),
            plugins: pluginFiles
                .filter(f => f.indexOf(".js") !== -1)
                .map(
                    f =>
                        `file://${replaceAll(
                            normalize(`${pluginDirectory}/${f}`),
                            "\\",
                            "/"
                        )}`
                ),
            scripts: scriptFiles.map(
                f =>
                    `file://${replaceAll(
                        normalize(`${scriptsDirectory}/${f}`),
                        "\\",
                        "/"
                    )}`
            )
        };
    }

    function setStartInfo() {
        // const script = `function startWhenReady(){if (self.Emby && self.Emby.App){self.appStartInfo=${startInfoJson};Emby.App.start(appStartInfo);} else {setTimeout(startWhenReady, 50);}} startWhenReady();`;
        // sendJavascript(script);
        // sendJavascript('var appStartInfo=' + startInfoJson + ';');
    }

    function sendCommand(cmd) {
        const script = `require(['inputmanager'], function(inputmanager){inputmanager.trigger('${cmd}');});`;
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
        // switch (command_id) {
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

        if (cmd !== "Unknown") {
            // alert(cmd);
        }

        switch (cmd) {
            case "browser-backward":
                if (mainWindow.webContents.canGoBack()) {
                    mainWindow.webContents.goBack();
                }
                break;
            case "browser-forward":
                if (mainWindow.webContents.canGoForward()) {
                    mainWindow.webContents.goForward();
                }
                break;
            case "browser-stop":
                sendCommand("stop");
                break;
            case "browser-search":
                sendCommand("search");
                break;
            case "browser-favorites":
                sendCommand("favorites");
                break;
            case "browser-home":
                sendCommand("home");
                break;
            case "browser-refresh":
                sendCommand("refresh");
                break;
            case "find":
                sendCommand("search");
                break;
            case "volume-mute":
                sendCommand("togglemute");
                break;
            case "volume-down":
                sendCommand("volumedown");
                break;
            case "volume-up":
                sendCommand("volumeup");
                break;
            case "media-nexttrack":
                sendCommand("next");
                break;
            case "media-previoustrack":
                sendCommand("previous");
                break;
            case "media-stop":
                sendCommand("stop");
                break;
            case "media-play":
                sendCommand("play");
                break;
            case "media-pause":
                sendCommand("pause");
                break;
            case "media-record":
                sendCommand("record");
                break;
            case "media-fast-forward":
                sendCommand("fastforward");
                break;
            case "media-rewind":
                sendCommand("rewind");
                break;
            case "media-play-pause":
                sendCommand("playpause");
                break;
            case "media-channel-up":
                sendCommand("channelup");
                break;
            case "media-channel-down":
                sendCommand("channeldown");
                break;
            case "menu":
                sendCommand("menu");
                break;
            case "info":
                sendCommand("info");
                break;
        }
    }

    function setCommandLineSwitches() {
        if (isLinux()) {
            app.commandLine.appendSwitch("enable-transparent-visuals");
            app.disableHardwareAcceleration();
        } else if (process.platform === "win32") {
            // app.disableHardwareAcceleration();

            app.commandLine.appendSwitch("high-dpi-support", "true");
            app.commandLine.appendSwitch("force-device-scale-factor", "1");
        }
    }

    function supportsTransparentWindow() {
        return true;
    }

    function getWindowStateDataPath() {
        return join(app.getPath("userData"), "windowstate.json");
    }

    function closeWindow(win) {
        try {
            win.close();
        } catch (err) {
            console.log(
                `Error closing window. It may have already been closed. ${err}`
            );
        }
    }

    function onWindowClose() {
        if (hasAppLoaded) {
            const data: any = mainWindow.getBounds();
            data.state = currentWindowState;
            const windowStatePath = getWindowStateDataPath();
            writeFileSync(windowStatePath, JSON.stringify(data));
        }

        mainWindow.webContents.executeJavaScript("AppCloseHelper.onClosing();");

        // Unregister all shortcuts.
        globalShortcut.unregisterAll();
        closeWindow(playerWindow);

        if (cecProcess) {
            cecProcess.kill();
        }

        app.quit();
    }

    function parseCommandLine() {
        const commandLineArguments = process.argv.slice(2);

        const win = isWindows();

        const result: {
            cecExePath: string;
            mpvPath: string;
            userDataPath?: string;
        } = {
            cecExePath: commandLineArguments[win ? 1 : 0] || "cec-client",
            mpvPath: commandLineArguments[win ? 2 : 1]
        };

        if (win) {
            result.userDataPath = commandLineArguments[0];
        }

        return result;
    }

    const commandLineOptions = parseCommandLine();

    const userDataPath = commandLineOptions.userDataPath;
    if (userDataPath) {
        app.setPath("userData", userDataPath);
    }

    function onCecCommand(cmd) {
        console.log(`Command received: ${cmd}`);
        sendCommand(cmd);
    }

    /* CEC Module */
    function initCec() {
        try {
            // create the cec event
            const cecExePath = commandLineOptions.cecExePath;
            const cecEmitter = new EventEmitter();
            const cecOpts = {
                cecExePath,
                cecEmitter
            };
            cecProcess = cec.init(cecOpts);

            cecEmitter.on("receive-cmd", onCecCommand);
        } catch (err) {
            console.log(`error initializing cec: ${err}`);
        }
    }

    function getWindowId(win) {
        const handle = win.getNativeWindowHandle();

        if (endianness() === "LE") {
            if (handle.length === 4) {
                handle.swap32();
            } else if (handle.length === 8) {
                handle.swap64();
            } else {
                console.log("Unknown Native Window Handle Format.");
            }
        }
        const longVal = Long.fromString(handle.toString("hex"), true, 16);

        return longVal.toString();
    }

    function initPlaybackHandler(mpvPath) {
        playbackhandler.initialize(getWindowId(playerWindow), mpvPath);
        playbackhandler.registerMediaPlayerProtocol(protocol, mainWindow);
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

    app.on("quit", () => {
        closeWindow(mainWindow);
        closeWindow(playerWindow);
    });

    function onPlayerWindowRestore() {
        mainWindow.focus();
    }
}
