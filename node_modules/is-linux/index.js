'use strict';
module.exports = function (str, opts) {
	if(typeof process === 'undefined' || !process) {
		return false;
	}
	return process.platform === 'linux';
};
