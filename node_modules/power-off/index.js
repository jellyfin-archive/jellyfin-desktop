'use strict';
var isLinux = require('is-linux'),
	isOsx = require('is-osx'),
	isWindows = require('is-windows'),
	cp = require('child_process');

module.exports = function (cb) {
	var cmd = '';

	if(isLinux() || isOsx()) {
		cmd = 'sudo shutdown -h now';
	} else if(isWindows()) {
		cmd = 'shutdown -s -t 0';
	} else {
		throw new Error('Unknown OS!');
	}

	cp.exec(cmd, function (err, stdout, stderr) {
		cb(err, stout, stderr);
	});
};
