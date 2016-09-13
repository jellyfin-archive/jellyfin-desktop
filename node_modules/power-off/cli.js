#!/usr/bin/env node
'use strict';
var meow = require('meow');
var powerOff = require('./');

var cli = meow({
	help: [
		'Usage',
		'  $ power-off',
		''
	]
});

powerOff( function (err, stderr, stdout) {
	if(!err && !stderr) {
		console.log(stdout);
	}
});
