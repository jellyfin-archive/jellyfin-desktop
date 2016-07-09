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

function init(args) {
    console.log("Initializing cec-client...\n");
    console.log(args);
    var cecExePath = args.cecExePath;
    // register the emitter
    var cecEmitter = args.cecEmitter;
    testEventEmitter(cecEmitter);

    // create new log file
    var logPath = __dirname + "/logs";
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

    // spawn the cec-client
    const cec = child_process.spawn(cecExePath, ["-d", "15"]);
    // if cec-client is not installed, then we run the app normally
    cec.on("error", function(err) {
        console.log("ERROR: cec-client not installed, running without cec functionality.\n");
        console.log(err);
    });
    // create pipelines for the cec-client process
    cec.stdout.on("data", function(data) {
        console.log("cec-client:\n" + data);
        logStream = fs.createWriteStream(logFile, {"flags": "a"});
        logStream.write(data);
        logStream.end();
    });
    cec.stderr.on("data", function(data) {
        console.log("cec-client error:\n" + data);
        logStream = fs.createWriteStream(logFile, {"flags": "a"});
        logStream.write(data);
        logStream.end();
    });
    cec.on("close", function(code) {
        console.log("child process exited with code " + code);
        logStream = fs.createWriteStream(logFile, {"flags": "a"});
        logStream.write("child process exited with code " + code);
        logStream.end();
    });
    testTVOn(cec);
}

function testEventEmitter(emitter) {
    setInterval(function() {
        emitter.emit("receive-cmd", "testEmitter");
    }, 50000);
}

function testTVOn(cec) {
    cec.stdin.write("on 0\n");
}

/* Necessary exports for our cec module */
exports.init = init;
