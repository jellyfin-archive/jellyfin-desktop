'use strict';
var audio = {
	// add audio track
	// file path to the audio file
	// flag select / auto /cached
	// title subtitle title in the UI
	// lang subitlte language
	addAudioTrack: function(file, flag, title, lang) {
		var args = [file];
		// add the flag if specified
		if(flag){ args = _.concat(args, flag)};
		// add the title if specified
		if(title){ args = _.concat(args, title)};
		// add the language if specified
		if(lang){ args = _.concat(args, lang)};
		// finally add the argument
		this.socket.command("audio-add", args);
	},
	// delete the audio track specified by the id
	removeAudioTrack: function(id) {
		this.socket.command("audio-remove", [id]);
	},
	// selects the audio track
	selectAudioTrack: function(id) {
		this.socket.setProperty("audio", id);
	},
	// cycles through the audio track
	cycleAudioTracks: function() {
		this.socket.cycleProperty("audio");
	},
	// adjusts the timing of the audio track
	adjustAudioTiming: function(seconds){
		this.socket.setProperty("audio-delay", seconds);
	},
	// adjust the playback speed
	// factor  0.01 - 100
	speed: function(factor) {
		this.socket.setProperty("speed", factor);
	},

}

module.exports = audio;
