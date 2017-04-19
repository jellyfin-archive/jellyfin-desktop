var processes = {};
var timeposition = 0;
var mainWindowRef
var mpv = require('node-mpv');
var mpvPlayer
var playerWindowId
var mpvPath

function alert(text) {
    require('electron').dialog.showMessageBox(mainWindowRef, {
        message: text.toString(),
        buttons: ['ok']
    });
}

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

function set_position(data) {
    mpvPlayer.goToPosition(data / 1000000000);
}

function set_volume(data) {
    mpvPlayer.volume(data);
}

function getReturnJson() {

    return "{}";
}

function processRequest(request, callback) {

	var url = require('url');
	var url_parts = url.parse(request.url, true);
	var action = url_parts.host;

	switch (action) {

		case 'play':
			var data = url_parts.query["path"];			
			play(data, callback);
			callback(getReturnJson());
			break;
	    case 'stop':
	        stop(callback);
	        callback(getReturnJson());
	        break;
	    case 'stopfade':
            // TODO: If playing audio, stop with a fade out
            stop(callback);
            callback(getReturnJson());
            break;
        case 'set_position':
        	var data = url_parts.query["data"];
        	set_position(data);
        	callback(getReturnJson());
        	break;
	    case 'unpause':
	        pause_toggle();
	        callback(getReturnJson());
	        break;
	    case 'playpause':
            pause_toggle();
            callback(getReturnJson());
            break;
        case 'pause':
            pause();
            callback(getReturnJson());
            break;
	    case 'volume':
	        var data = url_parts.query["data"];
	        set_volume(data);
	        callback(getReturnJson());
	        break;
		default:
			// This could be a refresh, e.g. player polling for data
			callback(getReturnJson());
			break;
	}
}

function initialize(playerWindowIdString, mpvBinaryPath) {
    playerWindowId = playerWindowIdString;
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
	    timeposition = data * 100000;
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
