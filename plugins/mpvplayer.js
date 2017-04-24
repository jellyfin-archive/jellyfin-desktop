define(['apphost', 'pluginManager', 'events', 'embyRouter'], function (appHost, pluginManager, events, embyRouter) {
    'use strict';

    return function () {

        var self = this;

        self.name = 'MPV Media Player';
        self.type = 'mediaplayer';
        self.id = 'mpvmediaplayer';
        self.priority = -1;

        var currentSrc;
        var playerState = {};
        var ignoreEnded;

        self.getRoutes = function () {

            var routes = [];

            routes.push({
                path: 'mpvplayer/audio.html',
                transition: 'slide',
                controller: pluginManager.mapPath(self, 'mpvplayer/audio.js'),
                type: 'settings',
                title: 'Audio',
                category: 'Playback',
                thumbImage: ''
            });

            if (appHost.supports('windowtransparency')) {
                routes.push({
                    path: 'mpvplayer/video.html',
                    transition: 'slide',
                    controller: pluginManager.mapPath(self, 'mpvplayer/video.js'),
                    type: 'settings',
                    title: 'Video',
                    category: 'Playback',
                    thumbImage: ''
                });
            }

            return routes;
        };

        self.getTranslations = function () {

            var files = [];

            files.push({
                lang: 'en-us',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/en-US.json')
            });

            files.push({
                lang: 'en-GB',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/en-GB.json')
            });

            files.push({
                lang: 'fr',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/fr.json')
            });

            files.push({
                lang: 'hr',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/hr.json')
            });

            files.push({
                lang: 'it',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/it.json')
            });

            files.push({
                lang: 'pl',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/pl.json')
            });

            files.push({
                lang: 'pt-PT',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/pt-PT.json')
            });

            files.push({
                lang: 'ru',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/ru.json')
            });

            files.push({
                lang: 'sv',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/sv.json')
            });

            return files;
        };

        self.canPlayMediaType = function (mediaType) {

            if ((mediaType || '').toLowerCase() == 'video') {

                return appHost.supports('windowtransparency');
            }
            return (mediaType || '').toLowerCase() == 'audio';
        };

        self.canPlayItem = function (item) {
            return true;
        };

        self.getDeviceProfile = function () {


            var profile = {};

            profile.MaxStreamingBitrate = 100000000;
            profile.MaxStaticBitrate = 100000000;
            profile.MusicStreamingTranscodingBitrate = 192000;

            profile.DirectPlayProfiles = [];

            profile.DirectPlayProfiles.push({
                Container: 'm4v,mpegts,ts,3gp,mov,xvid,vob,mkv,wmv,asf,ogm,ogv,m2v,avi,mpg,mpeg,mp4,webm,wtv,iso,m2ts,dvr-ms',
                Type: 'Video'
            });

            profile.DirectPlayProfiles.push({
                Container: 'aac,mp3,mpa,wav,wma,mp2,ogg,oga,webma,ape,opus,flac',
                Type: 'Audio'
            });

            profile.TranscodingProfiles = [];

            profile.TranscodingProfiles.push({
                Container: 'ts',
                Type: 'Video',
                AudioCodec: 'ac3,mp3,aac',
                VideoCodec: 'h264,mpeg2video',
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: '6',
                MinSegments: '2',
                BreakOnNonKeyFrames: false
            });

            profile.TranscodingProfiles.push({
                Container: 'mp3',
                Type: 'Audio',
                AudioCodec: 'mp3',
                Context: 'Streaming',
                Protocol: 'http'
            });

            profile.ContainerProfiles = [];

            profile.CodecProfiles = [];

            // Subtitle profiles
            // External vtt or burn in
            profile.SubtitleProfiles = [];
            profile.SubtitleProfiles.push({
                Format: 'srt',
                Method: 'External'
            });
            profile.SubtitleProfiles.push({
                Format: 'ass',
                Method: 'External'
            });
            profile.SubtitleProfiles.push({
                Format: 'ssa',
                Method: 'External'
            });
            profile.SubtitleProfiles.push({
                Format: 'srt',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'subrip',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'ass',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'ssa',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'pgs',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'pgssub',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'dvdsub',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'dvbsub',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'vtt',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'sub',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'idx',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'smi',
                Method: 'Embed'
            });

            profile.ResponseProfiles = [];

            return Promise.resolve(profile);
        };

        self.currentSrc = function () {
            return currentSrc;
        };

        self.play = function (options) {

            var mediaSource = JSON.parse(JSON.stringify(options.mediaSource));

            var url = options.url;

            ignoreEnded = false;
            currentSrc = url;

            //var isVideo = options.mimeType.toLowerCase('video').indexOf() == 0;
            var isVideo = options.item.MediaType == 'Video';

            var enableFullscreen = options.fullscreen !== false;

            // Update the text url in the media source with the full url from the options object
            mediaSource.MediaStreams.forEach(function (ms) {
                var textTrack = options.tracks.filter(function (t) {
                    return t.index == ms.Index;

                })[0];

                if (textTrack) {
                    ms.DeliveryUrl = textTrack.url;
                }
            });

            var requestBody = {
                path: url,
                isVideo: isVideo,
                //item: options.item,
                mediaSource: JSON.stringify(mediaSource),
                startPositionTicks: options.playerStartPositionTicks || 0,
                fullscreen: enableFullscreen
            };

            return sendCommand('play', requestBody).then(function () {

                if (isVideo) {
                    if (enableFullscreen) {

                        embyRouter.showVideoOsd();

                    } else {
                        embyRouter.setTransparency('backdrop');
                    }
                }

                startTimeUpdateInterval();

                return Promise.resolve();

            }, function (err) {
                stopTimeUpdateInterval();
                throw err;
            });
        };

        // Save this for when playback stops, because querying the time at that point might return 0
        self.currentTime = function (val) {

            if (val != null) {
                sendCommand('positionticks?val=' + (val * 10000)).then(onTimeUpdate);
                return;
            }

            return (playerState.positionTicks || 0) / 10000;
        };

        self.duration = function (val) {

            if (playerState.durationTicks == null) {
                return null;
            }

            return playerState.durationTicks / 10000;
        };

        self.stop = function (destroyPlayer) {

            var cmd = destroyPlayer ? 'stopfade' : 'stop';
            return sendCommand(cmd).then(function () {

                onEnded();

                if (destroyPlayer) {
                    self.destroy();
                }
            });
        };

        self.destroy = function () {
            embyRouter.setTransparency('none');
        };

        self.playPause = function () {
            sendCommand('playpause');
        };

        self.pause = function () {
            sendCommand('pause').then(onPause);
        };

        self.unpause = function () {
            sendCommand('unpause').then(onPlaying);
        };

        self.paused = function () {

            return playerState.isPaused || false;
        };

        self.volume = function (val) {
            if (val != null) {
                sendCommand('volume?val=' + val).then(onVolumeChange);
                return;
            }

            return playerState.volume || 0;
        };

        self.setSubtitleStreamIndex = function (index) {
            sendCommand('setSubtitleStreamIndex?index=' + index);
        };

        self.setAudioStreamIndex = function (index) {
            sendCommand('setAudioStreamIndex?index=' + index);
        };

        self.canSetAudioStreamIndex = function () {
            return true;
        };

        self.setMute = function (mute) {

            var cmd = mute ? 'mute' : 'unmute';

            sendCommand(cmd).then(onVolumeChange);
        };

        self.isMuted = function () {
            return playerState.isMuted || false;
        };

        var timeUpdateInterval;
        function startTimeUpdateInterval() {
            stopTimeUpdateInterval();
            timeUpdateInterval = setInterval(onTimeUpdate, 200);
        }

        function stopTimeUpdateInterval() {
            if (timeUpdateInterval) {
                clearInterval(timeUpdateInterval);
                timeUpdateInterval = null;
            }
        }

        function onEnded() {
            stopTimeUpdateInterval();

            if (!ignoreEnded) {
                ignoreEnded = true;
                events.trigger(self, 'stopped');
            }
        }

        function onTimeUpdate() {

            updatePlayerState();
            events.trigger(self, 'timeupdate');
        }

        function onVolumeChange() {
            events.trigger(self, 'volumechange');
        }

        function onPlaying() {

            events.trigger(self, 'playing');
        }

        function onPause() {
            events.trigger(self, 'pause');
        }

        function onError() {

            stopTimeUpdateInterval();
            events.trigger(self, 'error');
        }

        function paramsToString(params) {

            var values = [];

            for (var key in params) {

                var value = params[key];

                if (value !== null && value !== undefined && value !== '') {
                    //values.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
                    values.push(encodeURIComponent(key) + "=" + value);
                }
            }
            return values.join('&');
        }

        function sendCommand(name, body) {

            return new Promise(function (resolve, reject) {

                var xhr = new XMLHttpRequest();

                //if (body) {
                //    name += '?' + paramsToString(body);
                //}

                xhr.open('POST', 'http://127.0.0.1:8023/' + name, true);

                xhr.onload = function () {
                    if (this.responseText && this.status >= 200 && this.status <= 400) {

                        var state = JSON.parse(this.responseText);
                        var previousPlayerState = playerState;

                        if (state.playstate == 'idle' && previousPlayerState.playstate != 'idle' && previousPlayerState.playstate) {
                            onEnded();
                            resolve(playerState);
                            return;
                        }

                        playerState = state;

                        if (previousPlayerState.isMuted !== state.isMuted ||
                            previousPlayerState.volume !== state.volume) {
                            onVolumeChange();
                        }

                        if (previousPlayerState.isPaused !== state.isPaused) {
                            if (state.isPaused) {
                                onPause();
                            } else if (previousPlayerState.isPaused) {
                                onPlaying();
                            }
                        }

                        resolve(state);
                    } else {
                        reject();
                    }
                };

                xhr.onerror = reject;

                if (body) {
                    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
                    xhr.send(JSON.stringify(body));
                } else {
                    xhr.send();
                }
            });
        }

        function updatePlayerState() {

            return sendCommand('refresh');
        }
    }
});
