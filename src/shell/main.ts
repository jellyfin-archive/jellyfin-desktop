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
import { readdir, readFileSync, writeFileSync } from "fs";
import * as isLinux from "is-linux";
import * as isWindows from "is-windows";
import * as Long from "long";
import { endianness, hostname } from "os";
import { join, normalize } from "path";
import powerOff from "power-off";
import sleepMode from "sleep-mode";
import { promisify } from "util";

import { RendererApi } from "../renderer/api";
import {
    IAppStartInfo,
    IDevToolsBrowserWindow,
    IMpvState,
    WindowState
} from "../types";
import { TheaterApi } from "./api";
import * as cec from "./features/cec";
import * as playbackhandler from "./features/mpv";
import { findServers } from "./features/serverdiscovery";
import { wake } from "./features/wakeonlan";
import { assertStringOrNull } from "./utils";

const readdirAsync = promisify(readdir);

export async function main() {
    // Keep a global reference of the window object, if you don't, the window will
    // be closed automatically when the JavaScript object is garbage collected.
    let mainWindow: IDevToolsBrowserWindow;
    let playerWindow: IDevToolsBrowserWindow;

    const processes: { [pid: number]: ChildProcess } = {};

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
                allowRunningInsecureContent: true,
                experimentalFeatures: false,
                devTools: enableDevTools
            },

            icon: `${__dirname}/../../icons/512x512.png`
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
                    preload: join(__dirname, "../renderer/preload.js")
                }
            } as BrowserWindowConstructorOptions,
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

        windowStateOnLoad = previousWindowInfo.state;

        addPathIntercepts();
        registerWakeOnLan();

        if (appUrl) {
            mainWindow.loadURL(appUrl);
        } else {
            const localPath = join(
                `file://${__dirname}/../../assets/firstrun/Jellyfin.html`
            );
            mainWindow.loadURL(localPath);
        }

        const endpoint = rendererProcObjectEndpoint(
            ipcMain,
            mainWindow.webContents
        );
        const rendererApi = wrap<RendererApi>(endpoint);
        rendererApi.comtest().then(() => {
            console.info("Communication main -> renderer established");
        });

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

        initCec(rendererApi);

        initPlaybackHandler(commandLineOptions.mpvPath);
        if (isRpi()) {
            mainWindow.setFullScreen(true);
            mainWindow.setAlwaysOnTop(true);
        }

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
        mainWindow.on("minimize", () => {
            rendererApi.onWindowStateChanged("Minimized");
            currentWindowState = "Minimized";
        });
        mainWindow.on("maximize", () => {
            rendererApi.onWindowStateChanged("Maximized");
            currentWindowState = "Maximized";
        });
        mainWindow.on("enter-full-screen", async () => {
            await rendererApi.onWindowStateChanged("Fullscreen");
            currentWindowState = "Fullscreen";

            if (initialShowEventsComplete) {
                if (isLinux) {
                    playerWindow.setFullScreen(true);
                }
                mainWindow.setMovable(false);
            }
        });
        mainWindow.on("leave-full-screen", async () => {
            await rendererApi.onWindowStateChanged("Normal");
            currentWindowState = "Normal";

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
                currentWindowState = restoreState;
            } else {
                await rendererApi.onWindowStateChanged("Normal");
                currentWindowState = "Normal";
            }
        });
        mainWindow.on("unmaximize", () => {
            rendererApi.onWindowStateChanged("Normal");

            currentWindowState = "Normal";
        });
        mainWindow.on("resize", () => {
            if (!isLinux || currentWindowState === "Normal") {
                const bounds = mainWindow.getBounds();
                playerWindow.setBounds(bounds);
            }
        });

        mainWindow.once("ready-to-show", async () => {
            mainWindow.show();
        });

        const theaterApi = new TheaterApi({
            setWindowState,
            async execCommand(cmd: string): Promise<void> {
                switch (cmd) {
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
                        globalShortcut.register("mediastop", async () => {
                            await rendererApi.executeCommand("stop");
                        });

                        globalShortcut.register("mediaplaypause", async () => {
                            await rendererApi.executeCommand("playpause");
                        });

                        await rendererApi.setPlayerwindowId(
                            getWindowId(playerWindow)
                        );
                        break;
                }
            },
            mpvCommand(name: string, body?: any): IMpvState {
                return { volume: 100 };
            },
            startProcess(path: string, args: string[]): number | void {
                try {
                    const process = execFile(path, args, {}, async error => {
                        if (error) {
                            console.log(`Process closed with error: ${error}`);
                        }
                        processes[pid] = null;
                        await rendererApi.onChildProcessClosed(pid, !!error);
                    });

                    const pid = process.pid;
                    processes[pid] = process;
                    return pid;
                } catch (err) {
                    alert(`Error launching process: ${err}`);
                }
            },
            stopProcess(pid: number): void {
                const process = processes[pid];
                if (process) {
                    process.kill();
                }
            },
            findServers,
            async openUrl(url: string): Promise<void> {
                await shell.openExternal(url);
            }
        });
        expose(theaterApi, mainProcObjectEndpoint(ipcMain));
    });

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

    let currentWindowState: WindowState = "Normal";
    let restoreWindowState: WindowState;

    function setWindowState(state: WindowState) {
        restoreWindowState = null;
        const previousState = currentWindowState;

        if (state === "Maximized") {
            state = "Fullscreen";
        }

        if (state === "Minimized") {
            restoreWindowState = previousState;
            mainWindow.setAlwaysOnTop(false);
            mainWindow.minimize();
        } /*else if (state === "Maximized") {
            if (previousState === "Minimized") {
                mainWindow.restore();
            }

            mainWindow.maximize();
            mainWindow.setAlwaysOnTop(false);
        }*/ else if (
            state === "Fullscreen"
        ) {
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

    const customFileProtocol = "theater";

    function addPathIntercepts() {
        const theaterPath = normalize(join(__dirname, "../renderer"));

        protocol.registerFileProtocol(
            customFileProtocol,
            (request, callback) => {
                // Add 3 to account for ://
                let url = request.url.substr(customFileProtocol.length + 3);
                url = `${theaterPath}/${url}`;
                url = url.split("?")[0];

                console.info(`Loading appfile ${url}`);

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

    function closeProcess(id, callback) {
        const process = processes[id];
        if (process) {
            process.kill();
        }
        callback("");
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
                    wake(mac, options, callback);
                    break;
                default:
                    callback("");
                    break;
            }
        });
    }

    function alert(text: string) {
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

    async function loadStartInfo(): Promise<IAppStartInfo> {
        const pluginDirectory = normalize(`${__dirname}/../renderer/plugins`);
        const scriptsDirectory = normalize(`${__dirname}/../renderer/scripts`);

        const pluginFiles: string[] =
            (await readdirAsync(pluginDirectory)) || [];
        const scriptFiles: string[] =
            (await readdirAsync(scriptsDirectory)) || [];
        return {
            paths: {
                theater: `${customFileProtocol}://`
            },
            name: app.getName(),
            version: app.getVersion(),
            deviceName: hostname(),
            deviceId: hostname(),
            supportsTransparentWindow: supportsTransparentWindow(),
            plugins: pluginFiles
                .filter(f => f.match(/\.js$/))
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

    /* CEC Module */
    function initCec(rendererApi: RendererApi) {
        async function onCecCommand(cmd) {
            console.log(`Command received: ${cmd}`);
            await rendererApi.executeCommand(cmd);
        }

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
