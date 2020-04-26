/**
 * Emby Theater Electron - CEC Module.
 *
 * Adds support for HDMI-CEC. Uses the application cec-client.
 */

/**
 * Module dependencies.
 */
const fs = require("fs");
const child_process = require("child_process");
const parseCmd = require("./command-map");
const os = require("os");

var
    cecProcess,         // cec process
    cecEmitter,         // cec event emitter
    CEC_ADAPTER = {}    // logical address of cec adapter
;

var initialized = false;    // indicates if the CEC module is initialized

function init(args) {
    console.log("Initializing cec-client...\n");
    console.log(args);
    var cecExePath = args.cecExePath;
    if (!args.cecExePath) {
        console.log("ERROR: cec-client not installed, running without cec functionality.\n");
        return;
    }
    // register the emitter
    cecEmitter = args.cecEmitter;
    // testEventEmitter();

    // spawn the cec-client
    cecProcess = child_process.spawn(cecExePath,
        [
            "-t", "r",              // default device is recorder
            "-d", "15",
            "-o", "EmbyTheater"
        ]
    );
    // if cec-client is not installed, then we run the app normally
    cecProcess.on("error", function(err) {
        console.log("ERROR: cec-client not installed, running without cec functionality.\n");
        // console.log(err);
    });
    registerEvents(cecProcess);

    return cecProcess;
}


function testEventEmitter() {
    setInterval(function() {
        cecEmitter.emit("receive-cmd", "testEmitter");
    }, 50000);
}

function testTVOn(cecProcess) {
    cecProcess.stdin.write("on 0\n");
}

function testSetActive(cecProcess) {
    cecProcess.stdin.write("as\n");
}

function emitCmd(cmd) {
    cecEmitter.emit("receive-cmd", cmd);
}

/**
 * Register the CEC events and handle CEC logging.
 * @param {node.child_process} cecProcess - The CEC process.
 */
function registerEvents(cecProcess) {
    // create new log file
    var logPath = os.tmpdir();
    var logFile = logPath + "/cec-log.txt";
    try {
        var stats = fs.statSync(logPath);
        if (!stats.isDirectory()) { // if not a directory, then we need to create the appropriate directory
            console.log("created directory " + logPath);
            fs.mkdirSync(logPath);
        }
    }
    catch(err) {
        if (err.code === "ENOENT") {   // create the directory
            console.log("created directory " + logPath);
            fs.mkdirSync(logPath);
        }
    }
    var logStream = fs.createWriteStream(logFile);
    logStream.end();

    /**
     * CEC Events. Events are detected by parsing the cec-client pipelines.
     */

    // create pipelines for the cec-client process
    var remoteButton = {};    // 0 is not pressed, 1 is pressed
    cecProcess.stdout.on("data", function(data) {
        // console.log("cec-client:\n" + data);
        // check for initialization
        if (!initialized) {
            var dataAsString = data.toString().replace(/\s+/g, "");
            var indexOfAdapter = dataAsString.includes("CECclientregistered");
            if (indexOfAdapter) {
                console.log("\nCEC Client successfully registered.\n");
                var adapterRegExp = /logicaladdress\(es\)=(\w+)\((\d+)\)/g;
                var cecAdapterVals = adapterRegExp.exec(dataAsString);
                CEC_ADAPTER.device = cecAdapterVals[1];
                CEC_ADAPTER.lAddr = cecAdapterVals[2];
                console.log("CEC Adapter Device:\t" + JSON.stringify(CEC_ADAPTER, null, "  "));
                initialized = true;
                // run after-init functions here:
                testTVOn(cecProcess);
                testSetActive(cecProcess);
            }
            return; // don't execute any other functions until initialized
        }
        // check for remote commands
        if (data.toString().includes(">>")) {
            var cecCmd = data.toString().split(">>")[1].replace(/\s+/g, "").split(":");
            // console.log(cecCmd);
            if ((cecCmd[0][0] == 0 || cecCmd[0][0] == 5) && cecCmd[0][1] == CEC_ADAPTER.lAddr) {  // device => adapter
                if (cecCmd[1] == "44") {    // key pressed
                    console.log("remote control button pressed");
                    remoteButton.state = 1;
                    remoteButton.cmd = cecCmd[2];
                    parseCmd(remoteButton.cmd, cecEmitter);
                }
                else if (cecCmd[1] == "45") {    // key released
                    console.log("remote control button released");
                    remoteButton.state = 0;
                }
            }
        }
        logStream = fs.createWriteStream(logFile, {"flags": "a"});
        logStream.write(data);
        logStream.end();
    });

    cecProcess.stderr.on("data", function(data) {
        console.log("cec-client error:\n" + data);
        logStream = fs.createWriteStream(logFile, {"flags": "a"});
        logStream.write(data);
        logStream.end();
    });

    cecProcess.on("close", function(code) {
        console.log("cec-client exited with code " + code);
        logStream = fs.createWriteStream(logFile, {"flags": "a"});
        logStream.write("child process exited with code " + code);
        logStream.end();
    });
}

/* Necessary exports for our cec module */
exports.init = init;
