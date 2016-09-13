#!/usr/bin/env node
'use strict';
var sleepMode = require('./');

sleepMode(function (err, stderr, stdout) {
	if (!err && !stderr) {
		console.log(stdout);
	}
});
