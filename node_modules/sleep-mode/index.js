'use strict';

var isLinux = require('is-linux'),
	isOsx = require('is-osx'),
	isWindows = require('is-windows'),
	cp = require('child_process');

module.exports = function (cb) {
	var cmd = '';

	if (isOsx()) {
		cmd = 'pmset sleepnow';
	} else if (isLinux()) {
		// should work on all OSs using systemd.
		cmd = 'sudo pm-suspend';
	} else if (isWindows()) {
		cmd = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
	} else {
		throw new Error('Unknown OS!');
	}

	cp.exec(cmd, function (err, stderr, stdout) {
		cb(err, stderr, stdout);
	});
};

