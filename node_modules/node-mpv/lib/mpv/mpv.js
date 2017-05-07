'use strict';
// Child Process to module to start mpv player
var spawn = require('child_process').spawn;
var exec  = require('child_process').execSync;
// EventEmitter
var eventEmitter = require('events').EventEmitter;


// Lodash for some nice stuff
var _ = require('lodash');

// Promise the promisify getProperty
var Promise = require('promise')

// the modules with all the member functions
var commandModule = require('./_commands');
var controlModule  = require('./_controls');
var playlistModule  = require('./_playlist');
var audioModule    = require('./_audio');
var videoModule    = require('./_video');
var subtitleModule = require('./_subtitle');
// the IPC socket to communicate with mpv
var ipcInterface = require('../ipcInterface');


function mpv(options, mpv_args){

	// intialize the event emitter
	eventEmitter.call(this);
	// initiliaze flag for checking exit status
	this.exiting = false;

	// set the ipc command according to the mpv version
	var ipcCommand = "";

	// if the ipc Command was set by the user, use that
	if(options.ipc_command){
		if(!(options.ipc_command == "--input-ipc-server" || options.ipc_command == "--input-unix-socket")){
			console.log('Warning: ipcCommand was neither "--input-unix-socket" nor "--input-ipc-server"');
		}
		ipcCommand = options.ipc_command;
	}
	// determine the ipc command according to the version number
	else{

		// the name of the ipc command was changed in mpv version 0.17.0 to "--input-ipc-server"
		// that's why we have to check which mpv version is running
		// asks for the mpv version
		var output = exec((options.binary ? options.binary + " --version" : "mpv --version"), {encoding: 'utf8'});

		// Version Number found
		if(output.match(/UNKNOWN/) == null){
			// get the version part of the output
			var start = (output.match(/\d\.*\.*/)).index;
			var end   = (output.match(/\(C\)/)).index;

			// get the version number
			var versionNumber = parseInt(output.substr(start, end).split('.')[1]);

			// with some built packages distributed in some Linux distrubtions
			// the version number is actually a git hash
			// in that case fall back to the old command
			if(isNaN(versionNumber)){
				ipcCommand = "--input-unix-socket";
			}
			// an actually number was found for the version
			else{
				// Verison 0.17.0 and higher
				if(versionNumber >= 17){
					ipcCommand = "--input-ipc-server";
				}
				// Version 0.16.0 and below
				else{
					ipcCommand = "--input-unix-socket";
				}
			}

		}
		// when compiling mpv from source the displayed version number is "UNKNOWN"
		// I assume that version that is compiled from source is the latest version
		// and use the new command
		else{
			ipcCommand = "--input-ipc-server";
		}

	}


	// getProperty storage dictionary
	this.gottenProperties = {}

	// the options to start the socket with
	this.options = {
		"debug": false,
		"verbose": false,
		"socket": "/tmp/node-mpv.sock",
		"audio_only": false,
		"time_update": 1,
		"binary": null
	}

	// merge the default options with the one specified by the user
	this.options = _.defaults(options || {}, this.options);

	// observed properties
	// serves as a status object
	// can be enhanced by using the observeProperty function
	this.observed = {
		"mute": false,
		"pause": false,
		"duration": null,
		"volume": 100,
		"filename": null,
		"path": null,
		"media-title": null,
		"playlist-pos": null,
		"playlist-count": null,
		"loop": "no"
	};
	var observedVideo = {
		"fullscreen": false,
		"sub-visibility": false,
	}
	// saves the IDs of observedProperties with their propertyname
	// key: id  value: property
	this.observedIDs = {};

	// timeposition of the current song
	var currentTimePos = null;

	// default Arguments
	//  --ipcCommand (--ipc-input-server / --input-unix-socket) IPC socket to communicate with mpv
	//  --idle always run in the background
	//  -quite  no console prompts. Buffer will overflow otherwise
	var defaultArgs = [ipcCommand + "=" + this.options.socket, '--idle', '--quiet'];

	//  audio_only option aditional arguments
	// --no-video  no video will be displayed
	// --audio-display  prevents album covers embedded in audio files from being displayed
	if( this.options.audio_only){
		defaultArgs = _.concat(defaultArgs, ['--no-video', '--no-audio-display']);
	}
	// add the observed properties only needed for the video version
	else{
		 _.merge(this.observed, observedVideo);
	}

	// add the user specified arguments
	if(mpv_args){
		defaultArgs = _.union(defaultArgs, mpv_args);
	}


	// start mpv instance
	// user the user provied binary
	if(options.binary){
		this.mpvPlayer = spawn(options.binary, defaultArgs);
	}
	// use the binary found (or not) in $PATH
	else{
		this.mpvPlayer = spawn('mpv', defaultArgs);
	}

	// set up socket
	this.socket = new ipcInterface(this.options);


	// sets the Interval to emit the current time position
	this.socket.command("observe_property", [0, "time-pos"]);
	setInterval(function() {
		// only emit the time position if there is a file playing and it's not paused
		if(this.observed.filename && !this.observed.pause && currentTimePos != null){
			this.emit("timeposition", currentTimePos);
		}
	}.bind(this), this.options.time_update * 1000);



	// private member method
	// will observe all properties defined in the observed JSON dictionary
	var observeProperties = function() {
		var id = 1;
		// for every property stored in observed
		Object.keys(this.observed).forEach(function (property) {
			// safety check
			if(this.observed.hasOwnProperty(property)){
				this.observeProperty(property, id);
				this.observedIDs[id] = property;
				id += 1;
			}
		}.bind(this));
	}.bind(this);
	// observe all properties defined by default
	observeProperties();


	// ### Events ###

	// if mpv crashes restart it again
	this.mpvPlayer.on('close', function respawn() {
                // if exiting then no need to respawn
		if (this.exiting) {
			return;
		}

		if(this.options.debug){
			console.log("MPV Player seems to have died. Restarting...");
		}

		// restart the mpv instance
		if(options.binary){
			this.mpvPlayer = spawn(options.binary, defaultArgs);
		}
		else{
			this.mpvPlayer = spawn('mpv', defaultArgs);
		}

		this.mpvPlayer.on('close', respawn.bind(this));

		// TODO: reset ALL default parameters
		currentTimePos = null;
		// a small timeout is required to wait for mpv to have restarted
		// on weak machines this could take a while, thus 1000ms
		setTimeout(function() {
			// reobserve all observed properties
			// this will include those added by the user
			observeProperties();
			// observe timeposition
			this.socket.command("observe_property", [0, "time-pos"]);
		}.bind(this), 1000);
	}.bind(this));

	// if spawn fails to start mpv player
	this.mpvPlayer.on('error', function(error) {
		if(this.options.debug){
			console.log(error);
		}
	}.bind(this));

	// handles the data received from the IPC socket
	this.socket.on('message', function(data) {
		// console.log("Message: " + JSON.stringify(data));
		// handle events
		if(data.hasOwnProperty("event")){

			// if verbose was specified output the event
			// property-changes are output in the statuschange emit
			if(this.options.verbose ){
				if(data.hasOwnProperty("event")){
					if(!(data.event === "property-change")){
						console.log("Message received: " + JSON.stringify(data));
					}
				}
				else{
					console.log("Message received: " + JSON.stringify(data));
				}
			}


			switch(data.event) {
				case "idle":
					if(this.options.verbose){console.log("Event: stopped")};
					// emit stopped event
					this.emit("stopped");
					break;
				case "playback-restart":
					if(this.options.verbose){console.log("Event: start")};
					// emit play event
					this.emit("started");
					break;
				case "pause":
					if(this.options.verbose){console.log("Event: pause")};
					// emit paused event
					this.emit("paused");
					break;
				case "unpause":
					if(this.options.verbose){console.log("Event: unpause")};
					// emit unpaused event
					this.emit("resumed");
					break;
				// observed properties
				case "property-change":
					// time position events are handled seperately
					if(data.name === "time-pos"){
						// set the current time position
						currentTimePos = data.data;
						break;
					}
					else{
						// updates the observed value or adds it, if it was previously unobserved
						this.observed[data.name] = data.data;
						// emit a status change event
						this.emit('statuschange', this.observed);
						// output if verbose
						if(this.options.verbose){
							console.log("Event: statuschange");
							console.log("Property change: " + data.name + " - " + data.data);
						}
						break;
					}
				default:

			}

		}
		// this API assumes that only get_property requests will have a request_id
		else if(data.hasOwnProperty("request_id")){

			// output if verbose
			if(this.options.verbose){
				console.log("Get Request: " + data.request_id + " - " + data.data);
			}

			// This part is strongly coupled to the getProperty method in _commands.js

			// Promise Way
			// gottenProperties[data.request_id] was already set to the resolve function
			if(this.gottenProperties[data.request_id]){
				// store the retrieved property inside the gottenProperties dictionary
				// this will resolve the promise in getProperty (_command.js)
				this.gottenProperties[data.request_id](data.data);
				// delete the entry from the gottenProperties dictionary
				delete this.gottenProperties[data.request_id];
			}
			// Non Promise Way
			else{
				// emit a getRequest event
				this.emit("getrequest", data.request_id, data.data);
			}

		}


	}.bind(this));


}

mpv.prototype = _.extend({
	constructor: mpv,

	// loads a file into mpv
	// mode
	// replace          replace current video
	// append          append to playlist
	// append-play  append to playlist and play, if the playlist was empty
	loadFile: function(file, mode) {
		mode = mode || "replace";
		this.socket.command("loadfile", [file, mode]);
	},
	// loads a stream into mpv
	// mode
	// replace          replace current video
	// append          append to playlist
	// append-play  append to playlist and play, if the playlist was empty
	loadStream: function(url, mode) {
		mode = mode || "replace";
		this.socket.command("loadfile", [url, mode]);
	}

// add all the other modules using lodash
}, controlModule, commandModule, playlistModule, audioModule, videoModule, subtitleModule, eventEmitter.prototype); // inherit from EventEmitter


// export the mpv class as the module
module.exports = mpv;
