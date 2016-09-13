# sleep-mode

> Puts your device on sleep mode.


## Install

```
$ npm install --save sleep-mode
```


## Usage

```js
var sleepMode = require('sleep-mode');

sleepMode(function (err, stderr, stdout) {
	if (!err && !stderr) {
		console.log(stdout);
	}
});
```

## CLI

```
$ npm install --global sleep-mode
```

```
$ sleep-mode 
```


## License

MIT © [Hemanth.HM](http://h3manth.com)
