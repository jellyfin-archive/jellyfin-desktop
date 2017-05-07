# Node-MPV

A wrapper to comfortably use **[mpv player](https://github.com/mpv-player/mpv)** with **node**.js. It provides functions for the most of the commands needed to control the player. It's easy to use and highly flexible.

The module keeps an instance of **mpv** running in the background (using mpv's `--idle`) and communicates over the Json IPC API.

It also provides direct access to the IPC socket. Thus this module is not only limited to the methods it provides, but can fully communicate with the **mpv** API.


**This module requires [mpv](https://github.com/mpv-player/mpv) to be installed on your system to work**

**For streaming playback such as YouTube and SoundCloud [youtube-dl](https://github.com/rg3/youtube-dl) is required**

### Important


In version **0.13.0** the behaviour of `mute()` has changed. Use `toggleMute()` instead.



# Install


```
npm install node-mpv
```

#### OS X

```
brew install mpv youtube-dl
```

#### Linux (Ubuntu/Debian)

```
sudo apt-get install mpv youtube-dl
```


**youtube-dl** is only required if you want to stream videos or music from *YouTube*, *SoundCloud* or other websites supported by **youtube-dl**. See [here](https://rg3.github.io/youtube-dl/supportedsites.html) for a list of supported websites.






# Usage

```Javascript
mpv = require('node-mpv');
mpvPlayer = new mpv();
```

You optionally pass a Json object with options to the constructor. Possible options, along with their default values are the following

```Javascript
{
    "audio_only": false,
    "binary": null,
    "debug": false,
    "ipcCommand": null,   
    "socket": "/tmp/node-mpv.sock",
    "time_update": 1,
    "verbose": false,
}
```

* `audio_only` will add the `--no-video` and `--no-audio-display` argument and start **mpv** in audio only mode
* `binary` will use the provied path to a mpv binary instead of using the one found in **$PATH**
* `debug` prints error messages
* `ipc_command` allows to set the ipc command to start the ipc socket. Possible options are **--input-unix-socket** and **--input-ipc-server**. This is usually not needed since  **Node-MPV** is able to determine the correct command by itself, for the most part
* `socket` specifies the socket **mpv** opens
* `time_update` the time interval in seconds, how often **mpv** should report the current time position, when playing a title
* `verbose` will print various information on the console

You can also provide an optional second argument, an Array containing **mpv** command line options. A list of available arguments can be found in the [documentation](https://mpv.io/manual/stable/#options)

```Javascript
mpvPlayer = new mpv({
  "verbose": true,
  "audio_only": true
},
[
  "--fullscreen",
  "--fps=60"
]);
```

Mpv is then easily controllable via simple function calls.

```Javascript
mpvPlayer.loadFile("/path/to/your/favorite/song.mp3");
mpvPlayer.volume(70);
```

Events are used to detect changes.

```Javascript
mpvPlayer.on('statuschange', function(status){
  console.log(status);
});

mpvPlayer.on('stopped', function() {
  console.log("Gimme more music");
});
```

# Methods

## Load Content

* **loadFile** (file, mode="replace")

  Will load the `file` and starts playing it. This behaviour can be changed using the `mode` option

  * `replace`*(default)* replace current title and play the file immediately
  * `append` appends the title to the playlist
  * `append-play` appends the title to the playlist. If the playlist was empty this title is played

  There is another `append` function in the **playlist** section, which can be used to append files and streams.

* **loadStream** (url)

  Exactly the same as **loadFile** but loads a stream specified by `url`, for example *YouTube* or *SoundCloud*.

  `mode` is the same as in **loadFile**.

  This function should be used to load *YouTube* and *SoundCloud* playlists, as **loadPlaylist** will not work with those.


## Controlling MPV

* **play** ()

  Starts playback when in *pause* state

* **stop** ()

  Stops the playback entirely

* **pause** ()

  Pauses playback

* **resume** ()

  Resumes from *pause* mode

* **togglePause** ()

  Toggles the *pause* mode

* **mute** ()

  *This methods behaviours has changed with version 0.13.0, use toggleMute() instead*

  Mutes the player

* **unmute** ()

  Unmute the player

* **toggleMute** ()

  Toggles between *muted* and *unmuted*

* **volume** (volumeLevel)

  Sets volume to `volumeLevel`. Allowed values are between **0-100**. All values above and below will just set the volume to **0** or **100** respectively

* **adjustVolume** (value)

  Adjusts the volume with the specified `value`. If this results in the volume going below **0** or above **100** it will be set to **0** or **100** respectively

* **seek** (seconds)

  Will jump back or forth in the song for the specified amount of `seconds`. Going beyond the duration of  the song results in stop of playback

* **goToPosition** (seconds)

  Jumps to the position specified by `seconds`. Going beyond the boundaries of the song results in stop of playback

* **loop** (times)

  Loops the current title `times`often. If set to *"inf"* the title is looped forever

## Playlists

  * **loadPlaylist** (playlist, mode="replace")

    Loads a playlist file. `mode` can be one of the two folllowing

    This function does not work with *YouTube* or *SoundCloud* playlists. Use **loadFile** or **loadStream** instead

      * `replace` *(default)* Replaces the old playist with the new one
      * `append`  Appends the new playlist to the active one

  * **append** (file, mode="append")

    Appends `file` (which can also be an url) to the playlist.

    * `append` *(default)* Append the title
    * `append-play` When the playlist was empty the title will be started

  * **next** (mode="weak")

     Skips the current song. `mode`can be one of the following two

       * `weak` *(default*) If the song is the last song in the playlist it is not skipped
       * `strong` The song is skipped and playback is stopped

  * **prev** (mode="weak")

     Skips the current song. `mode`can be one of the following two

       * `weak` *(default*) If the song is the first song in the playlist it is not stopped
       * `strong` The song is skipped and playback is stopped

  * **clearPlaylist** ()

     Clears the playlist

  * **playlistRemove** (index)

     Removes the song at `index` from the playlist. If `index` is set to "current" the current song is removed and playback stops

  * **playlistMove** (index1, index2)

     Moves the song at `index1` to the position at `index2`

  * **shuffle** ()

      Shuffles the play into a random order



## Audio

* **addAudioTrack** (file, flag, title, lang)

  Adds an audio file to the video that is loaded.
  * `file` The audio file to load
  * `flag` *(optional)* Can be one of "select" (default), "auto" or "cached"
  * `title` *(optional)* The name for the audio track in the UI  
  * `lang` *(optional)* the language of the audio track

  `flag` has the following effects

    * *select* - the added audio track is selected immediately
    * *auto* - the audio track is not selected
    * *cached* - select the audio track, but if a audio track file with the same name is already loaded, the new file is not added and the old one is selected instead

* **removeAudioTrack** ()

  Removes the audio track specified by `id`. Works only for external audio tracks

* **selectAudioTrack** (id)

  Selects the audio track associated with `id`

* **cycleAudioTracks** ()

  Cycles through the audio tracks

* **adjustAudioTiming** (seconds)

  Shifts the audio timing by `seconds`

* **speed** (scale)

  Controls the playback speed by `scale` which can take any value between **0.01** and **100**

  If the `--auto-pitch-correction` flag (on by default) is used, this will not pitch the audio and uses a scaletempo audio filter


## Video

* **fullscreen** ()

  Goes into fullscreen mode

* **leaveFullscreen** ()

  Leaves fullscreen mode

* **toggleFullscreen** ()

  Toggles between fullscreen and windowed mode

* **screenshot** (file, option)

  Takes a screenshot and saves it to `file`. `options` is one of the following
  * `subtitles` *(default)* Takes a screenshot including the subtitles
  * `video` Only the image, no texts
  * `window` The scaled mpv window

* **rotateVideo** (degrees)

  Rotates the video clockwise. `degree` can only be multiples of 90 and the rotation is absolute, not relative

* **zoomVideo** (factor)

  Zooms into the video. **0** does not zoom at all, **1** zooms double and so on

* **brightness** (value)

  Sets the brightness to `value`. Allowed values are between **-100** and **100**

* **contrast** (value)

  Sets the contrast to `value`. Allowed values are between **-100** and **100**

* **saturation** (value)

  Sets the saturation to `value`. Allowed values are between **-100** and **100**

* **gamma** (value)

  Sets the gamma to `value`. Allowed values are between **-100** and **100**

* **hue** (value)

  Sets the hue to `value`. Allowed values are between **-100** and **100**



## Subtitles

* **addSubtilte** (file, flag, title, lang)

  Adds a subtitle file to the video that is loaded.
  * `file` The subtitle file to load
  * `flag` *(optional)* Can be one of "select" (default), "auto" or "cached"
  * `title` *(optional)* The name for the subtitle file in the UI  
  * `lang` *(optional)* The language of the subtitle

  `flag` has the following effects

    * *select* - the added subtitle is selected immediately
    * *auto* - the subtitle is not selected
    * *cached* - select the subtitle, but if a subtitle file with the same name is already loaded, the new file is not added and the old one is selected instead

* **removeSubitlte** (id)

  Removes the subtitle file specified by `id`. Works only for external subtitle

* **selectSubitlte** (id)

  Selects the subtitle associated with `id`

* **cycleSubtitles** ()

  Cycles through all available subtitles

* **toggleSubtitleVisibility** ()

  Toggles between hidden and visible subtitle

* **showSubtitles** ()

  Shows the subtitle

* **hideSubtitles** ()

  Hides the subtitles

* **adjustSubtitleTiming** (seconds)

  Shifts the subtitle timing by `seconds`

* **subtitleSeek** (lines)

  Jumps as many lines of subtitles as defined by `lines`. Can be negative. This will also seek in the video.

* **subitlteScale** (scale)

  Adjust the scale of the subtitles



## Properties

These methods can be used to alter *properties* or send arbitary *commands* to the running **mpv player**. Information about what *commands* and *properties* are available can be found in the [list of commands](https://mpv.io/manual/stable/#list-of-input-commands) and [list of properties](https://mpv.io/manual/stable/#properties) sections of the **mpv** documentation.

The most common commands are already covered by this modules **API**. This part enables you to send any command you want over the IPC. With this you are not limited the methods defined by this module.

* **setProperty** (property, value)

  Sets the specified `property` to the specified `value`

* **setMultipleProperties** (properties)

  Calls **setProperty** for every property specified in the arguments Json object. For example

  ```Javascript
  setMultipleProperties({
      "volume": 70,
      "fullscreen": true
  });
  ```

* **getProperty** (property, [id])

  Gets information about the specified `property`.

   If an `id` is used, the answer comes via a *getrequest* event containing the `id` and the `property`.

  If no `id` was set this function returns a [promise](https://www.promisejs.org) delivering the `property`. It can be used as in the example below

   ```Javascript
    mpvPlayer.getProperty('duration').then(function(duration) {
	  console.log("Duration: ", duration);
	});
   ```


* **addProperty** (property, value)

  Increased the `property` by the specified `value`. Needless to say this can only be used on numerical properties. Negative values are possible

* **multiplyProperty** (property, value)

  Multiply the specified `property` by `value`

* **cycleProperty** (property)

  Cycles the values of an arbitrary property

* **command** (command, args)

  Sends the `command` to the **mpv** player with the arguments specified in `args`
  The Json command

  ```Javascript
  `{"command": ["loadfile", "audioSong.mp3"]}`
  ```

  becomes a function call

  ```Javascript
  `command("loadfile",["audioSong.mp3"]`
  ```

* **freeCommand** (command)

  This will send an arbitrary *command* to the **mpv player**. It must however follow the specification of the **Json IPC protocol**. Its syntax can be found in the [documentation](https://mpv.io/manual/stable/#json-ipc).

  A trailing "**\n**" will be added to the command.

## Observing

 * **observeProperty** (property, id)

   This will add the specified *property* to the *statusupdate* event which is emitted whenever one of the observed properties changes.

   The **Id**s **0**-**12** are already taken by the properties which are observed by default.

* **unobserveProperty(id)**

  This will remove the property associated with the specified *id* from the *statusupdate*.

  Unobserving default properties may break the module.

# Events

The **Node-MPV** module provides various *events* to notify about changes of the **mpv player's** state.

* **started**

  Whenever **mpv** starts playing a song or video

* **stopped**

  Whenever the playback has stopped

* **paused**

  Whenever **mpv** was paused

* **resumed**

  Whenever **mpv** was resumed

* **timeposition** \<seconds\>

  When a song or video is currently playing and the playback is not paused, this event will emit the current position in *seconds*.

  When creating the **mpv** instance you can set a parameter, how often this event should occur. Default is every second

* **getrequest** \<id, data\>

  Delivers the reply to a function call to the *getRequest* method

* **statuschange** \<status object\>

  Whenever the status of one of the observed properties changes, this event will be emitted providing the complete *status object*

  By default various properties are already observed and the *status object* looks like the following

  ```Javascript
  {
    "mute": false,
    "pause": false,
    "duration": null,
    "volume": 100,
    "filename": null,
    "path": null,
    "media-title": null,
    "playlist-pos": 0,
    "playlist-count": 0,
    "loop": "no"
  }
  ```

    If the player is running in *video mode* the following properties are present as well.

  ```Javascript
  {
    "fullscreen": false,
    "sub-visibility": false
  }
  ```

  * `filename`
    When playing a local file this contains the filename. When playing for example a *YouTube* stream, this will only contain the trailing url

  * `path`
    Provides the absolute path to the music file or the full url of  a stream

  * `media-title` If available in the file this will contain the *title*. When streaming from *YouTube* this will be set to the video's name

    This object can expanded through the *observeProperty* method making it possible to watch any state you desire, given it is provided by **mpv**


# Observing

  **node-mpv** allows you to observe any property the [mpv API](https://mpv.io/manual/stable/#property-list) offers you, by simply using the **observeProperty** function.  

`observeProperty(property, id);`

This will add the `property` to status update object emitted by the **statuschange** event. Everytime that property changes such an event will be triggered.

By calling `unobserveProperty(id)` the property associated with that `id` is removed from the **statuschange**

By default **node-mpv** is already observing some useful properties by default.

```Javascript
{
  "mute": Boolean,
  "pause": Boolean,
  "duration": Number,
  "volume": Number,
  "filename": String,
  "path": String,
  "media-title": String,
  "playlist-pos": Number,
  "playlist-count": Number,
  "loop": Number // this one can be set to "inf" for endless looping
}
```

If **node-mpv** is not run in `audio_only` mode the following two properties will be observed, too

```Javascript
{
  "fullscreen": Boolean,
  "sub-visibility": Boolean
}
```

  The IDs **0** - **12** are already used for the default properties. Unobserving them will most likely break the module.

  For more information on the **statuschange** part, check the event section.

 ### Bug with observing playlist-count

 As of **mpv** version **0.17.0**, the `playlist-count` property is not updated as one would expect. It is not updated on **playlistRemove** and **append**. I already filed an [issue](https://github.com/mpv-player/mpv/issues/3267) about that and the problem was already fixed. If you need this feature you will have to build and install **mpv** yourself. Instructions for that can be found on the projects [GitHub page](https://github.com/mpv-player).

# Example

```Javascript
var mpvAPI = require('./mpv.js');
var mpvPlayer = new mpvAPI();

// This will load and start the song
mpvPlayer.loadFile('/path/to/your/favorite/song.mp3');

// This will bind this function to the stopped event
mpvPlayer.on('stopped', function() {
  console.log("Your favorite song just finished, let's start it again!");
    mpvPlayer.loadFile('/path/to/your/favorite/song.mp3');
});

// Set the volume to 50%
mpvPlayer.volume(50);

// Stop to song emitting the stopped event
mpvPlayer.stop();
```

# Known Issues

## IPC Command

The command line argument to start the IPC socket has changed in mpv version **0.17.0** from `--input-unix-socket` to `--input-ipc-socket`. This module uses regular expressions to find the version number from the `mpv --version` output. If mpv is compiled from source, the version number is stated as **UNKNOWN** and this module will assume, that you use the latest version and use the new command.

**If you use self compiled version stating UNKNOWN as the version number below mpv version 0.17.0 you have to use the ipc_command option with '--input-unix-socket'.**

To check this enter the following in your command shell

```
mpv --version
```

## MPV Player 0.18.1

MPV Player version **0.18.1** has some issues that the player crashes sometimes, when sending commands through the *ipc socket*. If you're using version **0.18.0** try to use a newer (or older) version.

To check your version number enter the following in your command shell

```
mpv --version
```

# Changelog

See [changelog](CHANGELOG.md) for more information or API breaking changes
