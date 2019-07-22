/**
 * Jellyfin Theater Electron - CEC Module.
 *
 * Adds support for HDMI-CEC. Uses the application cec-client.
 */

/**
 * Module dependencies.
 */
import * as child_process from "child_process";
import { createWriteStream, mkdirSync, statSync } from "fs";
import { tmpdir } from "os";
import parseCmd from "./command-map";

let cecProcess; // cec process
let cecEmitter; // cec event emitter
const CEC_ADAPTER: any = {}; // logical address of cec adapter

let initialized = false; // indicates if the CEC module is initialized

export function init(args) {
    console.log("Initializing cec-client...\n");
    console.log(args);
    const cecExePath = args.cecExePath;
    if (!args.cecExePath) {
        console.log(
            "ERROR: cec-client not installed, running without cec functionality.\n"
        );
        return;
    }
    // register the emitter
    cecEmitter = args.cecEmitter;
    // testEventEmitter();

    // spawn the cec-client
    cecProcess = child_process.spawn(cecExePath, [
        "-t",
        "r", // default device is recorder
        "-d",
        "15",
        "-o",
        "EmbyTheater"
    ]);
    // if cec-client is not installed, then we run the app normally
    cecProcess.on("error", () => {
        console.log(
            "ERROR: cec-client not installed, running without cec functionality.\n"
        );
        // console.log(err);
    });
    registerEvents(cecProcess);

    return cecProcess;
}

function testEventEmitter() {
    setInterval(() => {
        cecEmitter.emit("receive-cmd", "testEmitter");
    }, 50000);
}

function testTVOn(cecProcess_) {
    cecProcess_.stdin.write("on 0\n");
}

function testSetActive(cecProcess_) {
    cecProcess_.stdin.write("as\n");
}

function emitCmd(cmd) {
    cecEmitter.emit("receive-cmd", cmd);
}

/**
 * Register the CEC events and handle CEC logging.
 * @param {child_process} cecProcess_ - The CEC process.
 */
function registerEvents(cecProcess_) {
    // create new log file
    const logPath = tmpdir();
    const logFile = logPath + "/cec-log.txt";
    try {
        const stats = statSync(logPath);
        if (!stats.isDirectory()) {
            // if not a directory, then we need to create the appropriate directory
            console.log("created directory " + logPath);
            mkdirSync(logPath);
        }
    } catch (err) {
        if (err.code === "ENOENT") {
            // create the directory
            console.log("created directory " + logPath);
            mkdirSync(logPath);
        }
    }
    let logStream = createWriteStream(logFile);
    logStream.end();

    /**
     * CEC Events. Events are detected by parsing the cec-client pipelines.
     */

    // create pipelines for the cec-client process
    const remoteButton: any = {}; // 0 is not pressed, 1 is pressed
    cecProcess_.stdout.on("data", data => {
        // console.log("cec-client:\n" + data);
        // check for initialization
        if (!initialized) {
            const dataAsString = data.toString().replace(/\s+/g, "");
            const indexOfAdapter = dataAsString.includes("CECclientregistered");
            if (indexOfAdapter) {
                console.log("\nCEC Client successfully registered.\n");
                const adapterRegExp = /logicaladdress\(es\)=(\w+)\((\d+)\)/g;
                const cecAdapterVals = adapterRegExp.exec(dataAsString);
                CEC_ADAPTER.device = cecAdapterVals[1];
                CEC_ADAPTER.lAddr = cecAdapterVals[2];
                console.log(
                    "CEC Adapter Device:\t" +
                        JSON.stringify(CEC_ADAPTER, null, "  ")
                );
                initialized = true;
                // run after-init functions here:
                testTVOn(cecProcess_);
                testSetActive(cecProcess_);
            }
            return; // don't execute any other functions until initialized
        }
        // check for remote commands
        if (data.toString().includes(">>")) {
            const cecCmd = data
                .toString()
                .split(">>")[1]
                .replace(/\s+/g, "")
                .split(":");
            // console.log(cecCmd);
            if (
                (cecCmd[0][0] === 0 || cecCmd[0][0] === 5) &&
                cecCmd[0][1] === CEC_ADAPTER.lAddr
            ) {
                // device => adapter
                if (cecCmd[1] === "44") {
                    // key pressed
                    console.log("remote control button pressed");
                    remoteButton.state = 1;
                    remoteButton.cmd = cecCmd[2];
                    parseCmd(remoteButton.cmd, cecEmitter);
                } else if (cecCmd[1] === "45") {
                    // key released
                    console.log("remote control button released");
                    remoteButton.state = 0;
                }
            }
        }
        logStream = createWriteStream(logFile, { flags: "a" });
        logStream.write(data);
        logStream.end();
    });

    cecProcess_.stderr.on("data", data => {
        console.log("cec-client error:\n" + data);
        logStream = createWriteStream(logFile, { flags: "a" });
        logStream.write(data);
        logStream.end();
    });

    cecProcess_.on("close", code => {
        console.log("cec-client exited with code " + code);
        logStream = createWriteStream(logFile, { flags: "a" });
        logStream.write("child process exited with code " + code);
        logStream.end();
    });
}
