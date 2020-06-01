import {
    app,
    dialog,
    ipcMain,
    protocol,
    shell,
    globalShortcut,
    BrowserWindowConstructorOptions,
    BrowserWindow,
} from "electron";
import * as settings from "electron-settings";
import * as path from "path";
import { join, normalize } from "path";
import { WindowState } from "../common/types";
import * as sleepMode from "sleep-mode";
import * as powerOff from "power-off";
import { parse, ParsedUrlQuery } from "querystring";
import { access, readdir as readdirCb } from "fs";
import { promisify } from "util";
import { endianness, hostname } from "os";
import * as Long from "long";
import * as isRpi from "detect-rpi";

import { CEC } from "./cec";
import { PlaybackHandler } from "./playbackhandler";
import { findServers } from "./serverdiscovery";
import { wake } from "./wakeonlan";

const readdir = promisify(readdirCb);

app.allowRendererProcessReuse = true; // Disable warning by opting into Electron v9 default

const platform = process.platform;
const isLinux = platform === "linux";
const isWindows = platform === "win32";

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;
let playerWindow = null;
let hasAppLoaded = false;

const enableDevTools = true;
const enableDevToolsOnStartup = false;
let initialShowEventsComplete = false;
let previousBounds;
let cec;

const useTrueFullScreen = isLinux;
const shellDir = normalize(`${__dirname}/../shell`);
const iconsDir = normalize(`${__dirname}/../../icons`);
const resDir = normalize(`${__dirname}/../../res`);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (platform !== "darwin") {
        app.quit();
    }
});

// receive message from index.html
ipcMain.on("asynchronous-message", (event, arg) => {
    settings.set("server", {
        url: arg,
    });
    app.relaunch();
    app.quit();
});

function onWindowMoved(): void {
    mainWindow.webContents.executeJavaScript('window.dispatchEvent(new CustomEvent("move", {}));');
    const winPosition = mainWindow.getPosition();
    playerWindow.setPosition(winPosition[0], winPosition[1]);
}

let currentWindowState: WindowState = "Normal";

function onWindowResize(): void {
    if (!useTrueFullScreen || currentWindowState === "Normal") {
        const bounds = mainWindow.getBounds();
        playerWindow.setBounds(bounds);
    }
}

let restoreWindowState: WindowState | null;

function setWindowState(state: WindowState): void {
    let bounds;
    restoreWindowState = null;
    const previousState = currentWindowState;

    if (state === "Minimized") {
        restoreWindowState = previousState;
        mainWindow.setAlwaysOnTop(false);
        mainWindow.minimize();
    } else if (state === "Maximized") {
        if (previousState == "Minimized") {
            mainWindow.restore();
        }

        mainWindow.maximize();
        mainWindow.setAlwaysOnTop(false);
    } else if (state == "Fullscreen") {
        if (previousState == "Minimized") {
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
        if (previousState == "Minimized") {
            mainWindow.restore();
        } else if (previousState == "Fullscreen") {
            setSize = true;
            mainWindow.setFullScreen(false);
        } else if (previousState == "Maximized") {
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

function onWindowStateChanged(state: WindowState): void {
    currentWindowState = state;
    // language=JavaScript
    mainWindow.webContents.executeJavaScript(
        `
        document.windowState="${state}";
        document.dispatchEvent(
            new CustomEvent(
                "windowstatechanged",
                {
                    detail: {
                        windowState:"${state}"
                    }
                }
            )
        );
        `
    );
}

function onMinimize(): void {
    playerWindow.minimize();
    onWindowStateChanged("Minimized");
}

function onRestore(): void {
    const restoreState = restoreWindowState;
    restoreWindowState = null;
    if (restoreState && restoreState != "Normal" && restoreState != "Minimized") {
        setWindowState(restoreState);
    } else {
        onWindowStateChanged("Normal");
    }

    playerWindow.restore();
}

function onMaximize(): void {
    onWindowStateChanged("Maximized");
}

function onEnterFullscreen(): void {
    onWindowStateChanged("Fullscreen");

    if (initialShowEventsComplete) {
        if (useTrueFullScreen) {
            playerWindow.setFullScreen(true);
        }
        mainWindow.movable = false;
    }
}

function onLeaveFullscreen(): void {
    onWindowStateChanged("Normal");

    if (initialShowEventsComplete) {
        playerWindow.setFullScreen(false);
        mainWindow.movable = true;
    }
}

function onUnMaximize(): void {
    onWindowStateChanged("Normal");
}

const customFileProtocol = "electronfile";

function addPathIntercepts(): void {
    protocol.registerFileProtocol(customFileProtocol, function (request, callback) {
        // Add 3 to account for ://
        let url = request.url.substr(customFileProtocol.length + 3);
        url = `${shellDir}/${url}`;
        url = url.split("?")[0];

        callback({
            path: normalize(url),
        });
    });

    //protocol.interceptHttpProtocol('https', function (request, callback) {

    //    alert(request.url);
    //    callback({ 'url': request.url, 'referrer': request.referrer, session: null });
    //});
}

function sleepSystem(): void {
    sleepMode(function () {});
}

function restartSystem(): void {}

function shutdownSystem(): void {
    powerOff(function () {});
}

function setMainWindowResizable(resizable): void {
    try {
        mainWindow.setResizable(resizable);
    } catch (err) {
        console.log(`Error in setResizable:${err}`);
    }
}

let isTransparencyRequired = false;
let windowStateOnLoad;
function registerAppHost(): void {
    const customProtocol = "electronapphost";

    protocol.registerStringProtocol(customProtocol, function (request, callback) {
        // Add 3 to account for ://
        const url = request.url.substr(customProtocol.length + 3);
        const parts = url.split("?");
        const command = parts[0];

        let options: ParsedUrlQuery;

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
                options = parse(parts[1]);
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

function onLoaded(): void {
    //var globalShortcut = electron.globalShortcut;

    //globalShortcut.register('mediastop', function () {
    //    sendCommand('stop');
    //});

    //globalShortcut.register('mediaplaypause', function () {
    //});

    // language=JavaScript
    sendJavascript(`window.PlayerWindowId="${getWindowId(playerWindow)}";`);
}

const processes = {};

function startProcess(options, callback): void {
    let pid;
    const args = (options.arguments || "").split("|||");

    try {
        const process = require("child_process").execFile(options.path, args, {}, function (error) {
            if (error) {
                console.log(`Process closed with error: ${error}`);
            }
            processes[pid] = null;
            // language=JavaScript
            const script = `onChildProcessClosed("${pid}", ${error ? "true" : "false"});`;

            sendJavascript(script);
        });

        pid = process.pid.toString();
        processes[pid] = process;
        callback(pid);
    } catch (err) {
        alert(`Error launching process: ${err}`);
    }
}

function closeProcess(id, callback): void {
    const process = processes[id];
    if (process) {
        process.kill();
    }
    callback("");
}

function registerFileSystem(): void {
    const customProtocol = "electronfs";

    protocol.registerStringProtocol(customProtocol, function (request, callback) {
        // Add 3 to account for ://
        const url = request.url.substr(customProtocol.length + 3).split("?")[0];
        let path: string;

        switch (url) {
            case "fileexists":
            case "directoryexists":
                path = request.url.split("=")[1];

                access(join(__dirname, "..", "shell", path), (err) => {
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

function registerServerdiscovery(): void {
    const customProtocol = "electronserverdiscovery";

    protocol.registerStringProtocol(customProtocol, function (request, callback) {
        // Add 3 to account for ://
        const url = request.url.substr(customProtocol.length + 3).split("?")[0];
        let timeoutMs: number;

        switch (url) {
            case "findservers":
                timeoutMs = parseInt(request.url.split("=")[1]);
                findServers(timeoutMs).then(callback).catch(console.error);
                break;
            default:
                callback("");
                break;
        }
    });
}

function registerWakeOnLan(): void {
    const customProtocol = "electronwakeonlan";

    protocol.registerStringProtocol(customProtocol, function (request, callback) {
        // Add 3 to account for ://
        const url = request.url.substr(customProtocol.length + 3).split("?")[0];
        let mac: string;
        let port: number;

        switch (url) {
            case "wakeserver":
                mac = request.url.split("=")[1].split("&")[0];
                port = parseInt(request.url.split("=")[2]);

                wake(mac, port)
                    .then((res) => callback(String(res)))
                    .catch((error) => callback(error));
                break;
            default:
                callback("");
                break;
        }
    });
}

function alert(text): void {
    dialog.showMessageBox(mainWindow, {
        message: text.toString(),
        buttons: ["ok"],
    });
}

function replaceAll(str: string, find: string, replace: string): string {
    return str.split(find).join(replace);
}

function getAppBaseUrl(): any | null {
    return settings.get("server.url", null);
}

function getAppUrl(): string {
    let url = getAppBaseUrl();

    if (url) {
        url += "/web/index.html";
    }

    return url;
}

let startInfoJson;
async function loadStartInfo(): Promise<void> {
    const topDirectory = normalize(`${__dirname}/../shell`);
    const pluginDirectory = normalize(`${topDirectory}/plugins`);
    const scriptsDirectory = normalize(`${topDirectory}/scripts`);

    const pluginFiles = await readdir(pluginDirectory);
    const scriptFiles = await readdir(scriptsDirectory);
    const startInfo = {
        paths: {
            apphost: `${customFileProtocol}://apphost`,
            shell: `${customFileProtocol}://shell`,
            wakeonlan: `${customFileProtocol}://wakeonlan/wakeonlan`,
            serverdiscovery: `${customFileProtocol}://serverdiscovery/serverdiscovery`,
            fullscreenmanager: `${customFileProtocol}://fullscreenmanager`,
            filesystem: `${customFileProtocol}://filesystem`,
        },
        name: app.name,
        version: app.getVersion(),
        deviceName: hostname(),
        deviceId: hostname(),
        supportsTransparentWindow: supportsTransparentWindow(),
        plugins: pluginFiles
            .filter((f) => f.endsWith(".js"))
            .map((f) => `file://${replaceAll(path.normalize(`${pluginDirectory}/${f}`), "\\", "/")}`),
        scripts: scriptFiles.map((f) => `file://${replaceAll(path.normalize(`${scriptsDirectory}/${f}`), "\\", "/")}`),
    };

    startInfoJson = JSON.stringify(startInfo);
}

function setStartInfo(): void {
    // language=JavaScript
    const script = `
        function startWhenReady(){
            if (self.Emby && self.Emby.App){
                self.appStartInfo=${startInfoJson};
                Emby.App.start(appStartInfo);
            } else {
                setTimeout(startWhenReady, 50);
            }
        }
        startWhenReady();
    `;
    sendJavascript(script);
    //sendJavascript('var appStartInfo=' + startInfoJson + ';');
}

function sendCommand(cmd: string): void {
    // language=JavaScript
    const script = `
        require(["inputmanager"], (inputmanager) => {
            inputmanager.trigger("${cmd}");
        });
    `;
    sendJavascript(script);
}

function sendJavascript(script): void {
    // Add some null checks to handle attempts to send JS when the process is closing or has closed
    const win = mainWindow;
    if (win) {
        const web = win.webContents;
        if (web) {
            web.executeJavaScript(script);
        }
    }
}

function onAppCommand(_, cmd: string): void {
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
    //
    // if (cmd != "Unknown") {
    //     //alert(cmd);
    // }

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

function setCommandLineSwitches(): void {
    if (isLinux) {
        app.commandLine.appendSwitch("enable-transparent-visuals");
        app.disableHardwareAcceleration();
    } else if (process.platform === "win32") {
        //app.disableHardwareAcceleration();

        app.commandLine.appendSwitch("high-dpi-support", "true");
        app.commandLine.appendSwitch("force-device-scale-factor", "1");
    }
}

function supportsTransparentWindow(): boolean {
    return true;
}

function getWindowStateDataPath(): string {
    return join(app.getPath("userData"), "windowstate.json");
}

function closeWindow(win): void {
    try {
        win.close();
    } catch (err) {
        console.log(`Error closing window. It may have already been closed. ${err}`);
    }
}

function onWindowClose(): void {
    if (hasAppLoaded) {
        const data = mainWindow.getBounds();
        data.state = currentWindowState;
        const windowStatePath = getWindowStateDataPath();
        require("fs").writeFileSync(windowStatePath, JSON.stringify(data));
    }

    // language=JavaScript
    mainWindow.webContents.executeJavaScript("AppCloseHelper.onClosing();");

    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
    closeWindow(playerWindow);

    if (cec) {
        cec.kill();
    }

    app.quit();
}

function parseCommandLine(): Record<string, string> {
    const result: Record<string, string> = {};
    const commandLineArguments = process.argv.slice(2);

    let index = 0;

    if (isWindows) {
        result.userDataPath = commandLineArguments[index];
        index++;
    }

    result.cecExePath = commandLineArguments[index] || "cec-client";
    index++;

    result.mpvPath = commandLineArguments[index];
    index++;

    return result;
}

const commandLineOptions = parseCommandLine();

const userDataPath = commandLineOptions.userDataPath;
if (userDataPath) {
    app.setPath("userData", userDataPath);
}

function onCecCommand(cmd: string): void {
    console.log(`Command received: ${cmd}`);
    sendCommand(cmd);
}

/* CEC Module */
function initCec(): void {
    const cecExePath = commandLineOptions.cecExePath;
    if (!cecExePath) {
        console.info("ERROR: cec-client not installed, running without cec functionality.");
        return;
    }

    try {
        cec = new CEC(cecExePath);

        cec.onReceive(onCecCommand);
    } catch (err) {
        console.info(`error initializing cec: ${err}`);
    }
}

function getWindowId(win): string {
    const handle = win.getNativeWindowHandle();

    if (endianness() == "LE") {
        if (handle.length == 4) {
            handle.swap32();
        } else if (handle.length == 8) {
            handle.swap64();
        } else {
            console.warn("Unknown Native Window Handle Format.");
        }
    }
    const longVal = Long.fromString(handle.toString("hex"), true, 16);

    return longVal.toString();
}

function initPlaybackHandler(mpvPath): void {
    const pbHandler = new PlaybackHandler(getWindowId(playerWindow), mpvPath, mainWindow);
    pbHandler.registerMediaPlayerProtocol(protocol);
}

setCommandLineSwitches();

let windowShowCount = 0;

function onWindowShow(): void {
    windowShowCount++;
    if (windowShowCount == 2) {
        mainWindow.center();
        mainWindow.focus();
        initialShowEventsComplete = true;
    }
}

app.on("quit", function () {
    closeWindow(mainWindow);
});

function onPlayerWindowRestore(): void {
    mainWindow.focus();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on("ready", function () {
    const windowStatePath = getWindowStateDataPath();
    const enableNodeIntegration = !getAppUrl();
    let previousWindowInfo;
    try {
        previousWindowInfo = JSON.parse(require("fs").readFileSync(windowStatePath, "utf8"));
    } catch (e) {
        previousWindowInfo = {};
    }
    const windowOptions: BrowserWindowConstructorOptions = {
        transparent: false, //supportsTransparency,
        frame: true,
        title: "Jellyfin Desktop",
        minWidth: 1280,
        minHeight: 720,
        //alwaysOnTop: true,
        backgroundColor: "#00000000",
        center: true,
        show: false,
        resizable: true,

        webPreferences: {
            webSecurity: false,
            webgl: false,
            nodeIntegration: enableNodeIntegration,
            plugins: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: false,
            devTools: enableDevTools,
        },

        icon: `${iconsDir}/icon.ico`,
    };

    windowOptions.width = previousWindowInfo.width || 1280;
    windowOptions.height = previousWindowInfo.height || 720;
    if (previousWindowInfo.x != null && previousWindowInfo.y != null) {
        windowOptions.x = previousWindowInfo.x;
        windowOptions.y = previousWindowInfo.y;
    }

    playerWindow = new BrowserWindow(windowOptions);

    windowOptions.backgroundColor = "#00000000";
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

        mainWindow.webContents.on("dom-ready", setStartInfo);

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
            const localPath = path.join(`file://${__dirname}/../../res/firstrun/Jellyfin.html`);
            mainWindow.loadURL(localPath);
        }

        mainWindow.setMenu(null);
        mainWindow.on("move", onWindowMoved);
        mainWindow.on("app-command", onAppCommand);
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

        playerWindow.show();
        mainWindow.show();

        initCec();

        initPlaybackHandler(commandLineOptions.mpvPath);
        if (isRpi()) {
            mainWindow.setFullScreen(true);
            mainWindow.setAlwaysOnTop(true);
        }
    });
});
