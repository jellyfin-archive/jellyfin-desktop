'use strict';

var video = {
	// goes into fullscreen
	fullscreen: function() {
		this.socket.setProperty("fullscreen", true);
	},
	// leaves fullscreen
	leaveFullscreen: function() {
		this.socket.setProperty("fullscreen", false);
	},
	// toggles fullscreen
	toggleFullscreen: function() {
		this.socket.cycleProperty("fullscreen");
	},
	// takes a screenshot
	// option 
	// subtitles  with subtitles 
	//  video  without subtitles
	// window   the scaled mpv window
	screenshot: function(file, option){
		var args = [file];
		if(option){args = _.concat(args, option)};
		this.command("screenshot-to-file", args);
	},
	// video rotate
	// degrees 90 / 180 / 270 / 360
	// absolute rotation
	rotateVideo: function(degrees) {
		this.socket.setProperty("video-rotate", degrees);
	},
	// zooms into the image
	// 0 is no zoom at all
	// 1 is twice the size
	zoomVideo: function(factor) {
		this.socket.setProperty("video-zoom", factor);
	},


	// adjust the brightness
	// value -100  - 100
	brightness: function(value) {
		this.socket.setProperty("brightness", value);
	},
	// adjust the contrast
	// value -100 - 100
	contrast: function(value) {
		this.socket.setProperty("contrast", value);
	},
	// adjust the saturation
	// value -100 - 100
	saturation: function(value) {
		this.socket.setProperty("saturation", value);
	},
	// adjust the gamma value
	// value  -100 - 100
	gamma: function(value) {
		this.socket.setProperty("gamma", value);
	},
	// adjust the hue
	// value -100 - 100
	hue: function(value) {
		this.socket.setProperty("hue", value);
	}
}

module.exports = video;
