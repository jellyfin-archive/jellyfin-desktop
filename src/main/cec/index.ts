/**
 * @packageDocumentation
 * Adds support for HDMI-CEC. Uses the application cec-client.
 */

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { parseCmd } from "./command-map";
import { EventEmitter } from "events";
import { join } from "path";
import { tmpdir } from "os";
import { createWriteStream, mkdirSync, statSync } from "fs";

interface CecAdapter {
    device?: string;
    lAddr?: string;
}

export class CEC {
    private initialized = false; // indicates if the CEC module is initialized
    private readonly emitter: EventEmitter;
    private readonly CEC_ADAPTER: CecAdapter = {};
    private readonly process: ChildProcessWithoutNullStreams;

    constructor(cecExePath: string) {
        console.log("Initializing cec-client...\n");
        // register the emitter
        this.emitter = new EventEmitter();

        // spawn the cec-client
        this.process = spawn(cecExePath, [
            "-t",
            "r", // default device is recorder
            "-d",
            "15",
            "-o",
            "JellyfinDesktop",
        ]);
        // if cec-client is not installed, then we run the app normally
        this.emitter.on("error", () => {
            console.info("ERROR: cec-client not installed, running without cec functionality.");
            // console.log(err);
        });

        this.registerEvents();
    }

    public onReceive(callback: (cmd: string) => void): void {
        this.emitter.on("receive-cmd", callback);
    }

    public kill(): void {
        this.process.kill();
    }

    private testTVOn(cecProcess): void {
        cecProcess.stdin.write("on 0\n");
    }

    private testSetActive(cecProcess): void {
        cecProcess.stdin.write("as\n");
    }

    /**
     * Register the CEC events and handle CEC logging.
     */
    private registerEvents(): void {
        // create new log file
        const logPath = tmpdir();
        const logFile = join(logPath, "/cec-log.txt");
        try {
            const stats = statSync(logPath);
            // if not a directory, then we need to create the appropriate directory
            if (!stats.isDirectory()) {
                console.log(`created directory ${logPath}`);
                mkdirSync(logPath);
            }
        } catch (err) {
            // create the directory
            if (err.code === "ENOENT") {
                console.log(`created directory ${logPath}`);
                mkdirSync(logPath);
            }
        }
        let logStream = createWriteStream(logFile);
        logStream.end();

        /**
         * CEC Events. Events are detected by parsing the cec-client pipelines.
         */
        const remoteButton: {
            state?: 0 | 1;
            cmd?: string;
        } = {}; // 0 is not pressed, 1 is pressed
        this.process.stdout.on("data", (data) => {
            // console.log("cec-client:\n" + data);
            // check for initialization
            if (!this.initialized) {
                const dataAsString = data.toString().replace(/\s+/g, "");
                const indexOfAdapter = dataAsString.includes("CECclientregistered");
                if (indexOfAdapter) {
                    console.info("\nCEC Client successfully registered.\n");
                    const adapterRegExp = /logicaladdress\(es\)=(\w+)\((\d+)\)/g;
                    const cecAdapterVals = adapterRegExp.exec(dataAsString);
                    this.CEC_ADAPTER.device = cecAdapterVals[1];
                    this.CEC_ADAPTER.lAddr = cecAdapterVals[2];
                    console.info(`CEC Adapter Device:\t${JSON.stringify(this.CEC_ADAPTER)}`);
                    this.initialized = true;
                    // run after-init functions here:
                    this.testTVOn(this.process);
                    this.testSetActive(this.process);
                }
                return; // don't execute any other functions until initialized
            }
            // check for remote commands
            if (data.toString().includes(">>")) {
                const cecCmd = data.toString().split(">>")[1].replace(/\s+/g, "").split(":");
                // console.log(cecCmd);
                if ((cecCmd[0][0] == 0 || cecCmd[0][0] == 5) && cecCmd[0][1] == this.CEC_ADAPTER.lAddr) {
                    // device => adapter
                    if (cecCmd[1] == "44") {
                        // key pressed
                        console.debug("remote control button pressed");
                        remoteButton.state = 1;
                        remoteButton.cmd = cecCmd[2];
                        this.emitter.emit("receive-cmd", parseCmd(remoteButton.cmd));
                    } else if (cecCmd[1] == "45") {
                        // key released
                        console.debug("remote control button released");
                        remoteButton.state = 0;
                    }
                }
            }
            logStream = createWriteStream(logFile, { flags: "a" });
            logStream.write(data);
            logStream.end();
        });

        this.process.stderr.on("data", function (data) {
            console.warn(`cec-client error:\n${data}`);
            logStream = createWriteStream(logFile, { flags: "a" });
            logStream.write(data);
            logStream.end();
        });

        this.process.on("close", function (code) {
            console.info(`cec-client exited with code ${code}`);
            logStream = createWriteStream(logFile, { flags: "a" });
            logStream.write(`child process exited with code ${code}`);
            logStream.end();
        });
    }
}
