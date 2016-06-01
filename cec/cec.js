/* Emby Theater Electron - CEC Module */

function init(args) {
    console.log("Initializing cec-client...\n");

    // register the emitter
    var cecEmitter = args.cecEmitter;
    testEventEmitter(cecEmitter);

    // create new log file
    const fs = require('fs');
    var logPath = __dirname + '/cec-logs';
    var logFile = logPath + '/log';
    try {
        var stats = fs.statSync(logPath);
        if (!stats.isDirectory()) { // if not a directory, then we need to create the appropriate directory
            console.log('created directory ' + logPath);
            fs.mkdirSync(logPath);
        }
    }
    catch(err) {
        if (err.code === 'ENOENT') {   // create the directory
            console.log('created directory ' + logPath);
            fs.mkdirSync(logPath);
        }
    }
    var logStream = fs.createWriteStream(logFile);
    logStream.end();

    // spawn the cec-client

    const spawn = require('child_process').spawn;
    const cec = spawn('cec-client1', ['-d', '3']);
    // if cec-client is not installed, then we run the app normally
    cec.on('error', function(err) {
        console.log('ERROR: cec-client not installed, running without cec functionality.\n');
        console.log(err);
    });
    // create pipelines for the cec-client process
    cec.stdout.on('data', function(data) {
        console.log('cec-client:\n' + data);
        logStream = fs.createWriteStream(logFile, {'flags': 'a'});
        logStream.write(data);
        logStream.end();
    });
    cec.stderr.on('data', function(data) {
        console.log('cec-client error:\n' + data);
        logStream = fs.createWriteStream(logFile, {'flags': 'a'});
        logStream.write(data);
        logStream.end();
    });
    cec.on('close', function(code) {
        console.log('child process exited with code ' + code);
        logStream = fs.createWriteStream(logFile, {'flags': 'a'});
        logStream.write('child process exited with code ' + code);
        logStream.end();
    });
    // testTVOn(cec);
}

function testEventEmitter(emitter) {
    setInterval(function() {
        emitter.emit('receive-cmd', 'testEmitter');
    }, 5000);
}

function testTVOn(cec) {
    setInterval(function() {
        cec.stdin.write('on 0\n');
    }, 5000);
}

/* Necessary exports for our cec module */
exports.init = init;
exports.cec = init.cec;
