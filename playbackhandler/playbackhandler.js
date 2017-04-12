var processes = {};
var timeposition
var mainWindowRef
var mpv = require('node-mpv');
var mpvPlayer
var playerWindowId
var mpvPath

function play(url, callback) {
    createMpv();
	console.log('Play URL : ' + url);
    mpvPlayer.loadFile(url);
}

function stop(callback) {
    mpvPlayer.stop();
    delete mpvPlayer;
}

function pause() {
    mpvPlayer.pause();
}

function pause_toggle() {
    mpvPlayer.togglePause();
}

function get_position(callback) {
	callback(timeposition);
}

function set_position(data) {
	mpvPlayer.goToPosition(data / 1000000000)
}

function set_volume(data) {
    mpvPlayer.volume(data);
}

function processRequest(request, callback) {

	var url = require('url');
	var url_parts = url.parse(request.url, true);
	var action = url_parts.host;
	switch (action) {

		case 'play':
			var data = url_parts.query["data"];			
			play(data, callback);
			callback("Play Action");
			break;
        case 'stop':			
            stop(callback);
            callback("Stop Action");
            break;
        case 'get_position':
        	get_position(callback);
        	//console.log("Get position called, timeposition = " + String(timeposition));
        	break;
        case 'set_position':
        	var data = url_parts.query["data"];
        	set_position(data);
        	callback("Set Position Action");
        	//console.log("Set position called, request = " + String(data));
        	break;
        case 'pause_toggle':
            pause_toggle();
            break;             
        case 'pause':
            pause();
            break;
	    case 'volume':
	        var data = url_parts.query["data"];
	        set_volume(data);
	        break;
		default:
			console.log('playbackhandler:processRequest action unknown : ' + action);
			callback("");
			break;
	}
}

function initialize(playerWindow, mpvBinaryPath) {
    var Long = require("long");
    var os = require("os");
    var handle = playerWindow.getNativeWindowHandle();
        
    if (os.endianness() == "LE") {

        if (handle.length == 4) {
            handle.swap32();
        } else if (handle.length == 8) {
            handle.swap64();
        } else {
            console.log("Unknown Native Window Handle Format.");
        }
    }
    var longVal = Long.fromString(handle.toString('hex'), unsigned = true, radix = 16);
    playerWindowId = longVal.toString();
    mpvPath = mpvBinaryPath;
}

function createMpv() {
    var isWindows = require('is-windows');
    if (isWindows()) {
        mpvPlayer = new mpv({
            "binary": mpvPath,
            "ipc_command": "--input-ipc-server",
            "socket": "\\\\.\\pipe\\emby-pipe",
            "debug" : false
            },
            [
            "--wid=" + playerWindowId,
            "--no-osc"
            ]);
    } else {
        mpvPlayer = new mpv({
            "binary": mpvPath,
            "ipc_command": "--input-unix-socket",
            "socket": "/tmp/emby.sock",
            "debug": false
            },
            [
            "--wid=" + playerWindowId,
            "--no-osc"
            ]);
    }

	mpvPlayer.on('timeposition', function (data) {
	    timeposition = data * 1000000000;
	});

	mpvPlayer.on('started', function () {
	    mainWindowRef.focus();
	});
}

function registerMediaPlayerProtocol(protocol, mainWindow) {

	protocol.registerStringProtocol('mpvplayer', function (request, callback) {
		processRequest(request, callback);
		mainWindowRef=mainWindow;
	});
	
}

exports.initialize = initialize;
exports.registerMediaPlayerProtocol = registerMediaPlayerProtocol;
