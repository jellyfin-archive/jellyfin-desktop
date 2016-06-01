

function init(args) {
    console.log("Initializing cec-client...\n");
    // register the emitter
    var cecEmitter = args.cecEmitter;
    testEventEmitter(cecEmitter);

    const spawn = require('child_process').spawn;
    const cec = spawn('cec-client', ['-d', '0']);

    const fs = require('fs');
    cec.stdout.on('data', function(data) {
        console.log('cec-client:\n' + data);
        fs.appendFile('./cec/logs/log.txt', data);
    });

    cec.stderr.on('data', function(data) {
        console.log('cec-client error:\n' + data);
        fs.appendFile('./cec/logs/log.txt', data);
    });

    cec.on('close', function(code) {
        console.log('child process exited with code ' + code);
        fs.appendFile('./cec/logs/log.txt', 'child process exited with code ' + code);
    });

    testTVOn(cec);
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
exports.init = init;
exports.cec = init.cec;