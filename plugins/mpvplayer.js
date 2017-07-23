define(['apphost', 'pluginManager', 'events', 'embyRouter', 'appSettings', 'loading', 'dom', 'require', 'connectionManager'], function (appHost, pluginManager, events, embyRouter, appSettings, loading, dom, require, connectionManager) {
    'use strict';

    return function () {

        var self = this;

        self.name = 'MPV';
        self.type = 'mediaplayer';
        self.id = 'mpvmediaplayer';
        self.priority = -1;

        var currentSrc;
        var playerState = {};
        var ignoreEnded;
        var videoDialog;

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

            files.push({
                lang: 'zh-CN',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/zh-CN.json')
            });

            return files;
        };

        self.canPlayMediaType = function (mediaType) {

            if ((mediaType || '').toLowerCase() == 'video') {

                return appHost.supports('windowtransparency');
            }
            return (mediaType || '').toLowerCase() == 'audio';
        };

        self.getDeviceProfile = function (item) {

            var profile = {};

            profile.MaxStreamingBitrate = 100000000;
            profile.MaxStaticBitrate = 100000000;
            profile.MusicStreamingTranscodingBitrate = 192000;

            profile.DirectPlayProfiles = [];

            var apiClient = item && item.ServerId ? connectionManager.getApiClient(item.ServerId) : null;
            var supportsEmptyContainer = apiClient ? apiClient.isMinServerVersion('3.2.26.0') : false;

            if (supportsEmptyContainer) {
                // leave container null for all
                profile.DirectPlayProfiles.push({
                    Type: 'Video'
                });
            }

            // for older servers that don't support leaving container blank
            profile.DirectPlayProfiles.push({
                Container: 'm4v,mpegts,ts,3gp,mov,xvid,vob,mkv,wmv,asf,ogm,ogv,m2v,avi,mpg,mpeg,mp4,webm,wtv,iso,m2ts,dvr-ms',
                Type: 'Video'
            });

            if (supportsEmptyContainer) {
                // leave container null for all
                profile.DirectPlayProfiles.push({
                    Type: 'Audio'
                });
            }

            // for older servers that don't support leaving container blank
            profile.DirectPlayProfiles.push({
                Container: 'aac,mp3,mpa,wav,wma,mp2,ogg,oga,webma,ape,opus,alac,flac,m4a',
                Type: 'Audio'
            });

            profile.TranscodingProfiles = [];

            profile.TranscodingProfiles.push({
                Container: 'mkv',
                Type: 'Video',
                AudioCodec: 'ac3,mp3,aac',
                VideoCodec: 'h264,mpeg2video',
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: '6',
                MinSegments: '1',
                BreakOnNonKeyFrames: false,
                SegmentLength: '3'
            });

            profile.TranscodingProfiles.push({

                Container: 'ts',
                Type: 'Audio',
                AudioCodec: 'aac',
                Context: 'Streaming',
                Protocol: 'hls',
                SegmentLength: '3'
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

        function onNavigatedToOsd() {

            if (videoDialog) {
                videoDialog.classList.remove('mpv-videoPlayerContainer-withBackdrop');
                videoDialog.classList.remove('mpv-videoPlayerContainer-onTop');
            }
        }

        function createMediaElement(options) {

            if (options.mediaType !== 'Video') {
                return Promise.resolve();
            }

            return new Promise(function (resolve, reject) {

                var dlg = document.querySelector('.mpv-videoPlayerContainer');

                if (!dlg) {

                    require(['css!./mpvplayer'], function () {

                        loading.show();

                        var dlg = document.createElement('div');

                        dlg.classList.add('mpv-videoPlayerContainer');

                        if (options.backdropUrl) {

                            dlg.classList.add('mpv-videoPlayerContainer-withBackdrop');
                            dlg.style.backgroundImage = "url('" + options.backdropUrl + "')";
                        }

                        if (options.fullscreen) {
                            dlg.classList.add('mpv-videoPlayerContainer-onTop');
                        }

                        document.body.insertBefore(dlg, document.body.firstChild);
                        videoDialog = dlg;

                        if (options.fullscreen) {
                            zoomIn(dlg).then(resolve);
                        } else {
                            resolve();
                        }

                    });

                } else {

                    if (options.backdropUrl) {

                        dlg.classList.add('mpv-videoPlayerContainer-withBackdrop');
                        dlg.style.backgroundImage = "url('" + options.backdropUrl + "')";
                    }

                    resolve();
                }
            });
        }

        self.play = function (options) {

            return createMediaElement(options).then(function () {
                return playInternal(options);
            });
        };

        function playInternal(options) {

            var mediaSource = JSON.parse(JSON.stringify(options.mediaSource));

            var url = options.url;

            ignoreEnded = false;
            currentSrc = url;

            //var isVideo = options.mimeType.toLowerCase('video').indexOf() == 0;
            var isVideo = options.item.MediaType == 'Video';

            var enableFullscreen = options.fullscreen !== false;

            // Update the text url in the media source with the full url from the options object
            mediaSource.MediaStreams.forEach(function (ms) {
                var textTrack = options.textTracks.filter(function (t) {
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
                mediaSource: mediaSource,
                startPositionTicks: options.playerStartPositionTicks || 0,
                fullscreen: enableFullscreen,
                mediaType: options.mediaType,
                playerOptions: {
                    dynamicRangeCompression: parseInt(appSettings.get('mpv-drc') || '0') / 100,
                    audioChannels: appSettings.get('mpv-speakerlayout'),
                    audioSpdif: appSettings.get('mpv-audiospdif'),
                    videoOutputLevels: appSettings.get('mpv-outputlevels'),
                    deinterlace: appSettings.get('mpv-deinterlace'),
                    hwdec: appSettings.get('mpv-hwdec'),
                    upmixAudioFor: appSettings.get('mpv-upmixaudiofor'),
                    scale: appSettings.get('mpv-scale'),
                    cscale: appSettings.get('mpv-cscale'),
                    dscale: appSettings.get('mpv-dscale'),
                    tscale: appSettings.get('mpv-tscale'),
                    ditherdepth: appSettings.get('mpv-ditherdepth'),
                    openglhq: appSettings.get('mpv-openglhq') === 'true',
                    exclusiveAudio: appSettings.get('mpv-exclusiveaudio') === 'true',
                    videoSync: appSettings.get('mpv-displaysync') === 'yes' ? 'display-resample' : null,
                    interpolation: appSettings.get('mpv-interpolation') === 'true',
                    correctdownscaling: appSettings.get('mpv-correctdownscaling') === 'true',
                    sigmoidupscaling: appSettings.get('mpv-sigmoidupscaling') === 'true',
                    deband: appSettings.get('mpv-deband') === 'true',
                    //genPts: mediaSource.RunTimeTicks ? false : true,
                    audioDelay: parseInt(appSettings.get('mpv-audiodelay') || '0'),
                    audioDelay2325: parseInt(appSettings.get('mpv-audiodelay2325') || 0),
                    largeCache: mediaSource.RunTimeTicks == null || options.item.Type === 'Recording' ? true : false
                }
            };

            return sendCommand('play', requestBody).then(function () {

                if (isVideo) {
                    if (enableFullscreen) {

                        embyRouter.showVideoOsd().then(onNavigatedToOsd);

                    } else {
                        embyRouter.setTransparency('backdrop');

                        if (videoDialog) {
                            videoDialog.classList.remove('mpv-videoPlayerContainer-withBackdrop');
                            videoDialog.classList.remove('mpv-videoPlayerContainer-onTop');
                        }
                    }
                }

                startTimeUpdateInterval();

                return Promise.resolve();

            }, function (err) {
                stopTimeUpdateInterval();
                throw err;
            });
        }

        // Save this for when playback stops, because querying the time at that point might return 0
        self.currentTime = function (val) {

            if (val != null) {
                sendCommand('positionticks?val=' + (val * 10000)).then(function (state) {

                    events.trigger(self, 'seek');
                    onTimeUpdate(state);
                });
                return;
            }

            return (playerState.positionTicks || 0) / 10000;
        };

        function seekRelative(offsetMs) {
            sendCommand('seekrelative?val=' + (offsetMs * 10000)).then(function (state) {

                events.trigger(self, 'seek');
                onTimeUpdate(state);
            });
        }

        self.rewind = function (offsetMs) {
            return seekRelative(0 - offsetMs);
        };

        self.fastForward = function (offsetMs) {
            return seekRelative(offsetMs);
        };

        self.enableMediaProbe = function () {

            // We expect to direct play everything with mpv
            return false;
        };

        self.duration = function (val) {

            if (playerState.durationTicks == null) {
                return null;
            }

            return playerState.durationTicks / 10000;
        };

        self.stop = function (destroyPlayer) {

            var cmd = destroyPlayer ? 'stopdestroy' : 'stop';

            return sendCommand(cmd).then(function () {

                onEnded();

                if (destroyPlayer) {
                    self.destroy();
                }
            });
        };

        self.destroy = function () {

            embyRouter.setTransparency('none');

            var dlg = videoDialog;
            if (dlg) {

                videoDialog = null;

                dlg.parentNode.removeChild(dlg);
            }
        };

        self.playPause = function () {

            sendCommand('playpause').then(function (state) {

                if (state.isPaused) {
                    onPause();
                } else {
                    onUnpause();
                }
            });
        };

        self.pause = function () {
            sendCommand('pause').then(onPause);
        };

        self.unpause = function () {
            sendCommand('unpause').then(onUnpause);
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

        self.getStats = function () {

            return sendCommand('stats');
        };

        var timeUpdateInterval;
        function startTimeUpdateInterval() {
            stopTimeUpdateInterval();
            timeUpdateInterval = setInterval(onTimeUpdate, 250);
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

        function onUnpause() {

            events.trigger(self, 'unpause');
        }

        function onPause() {
            events.trigger(self, 'pause');
        }

        function onError() {

            stopTimeUpdateInterval();
            events.trigger(self, 'error');
        }

        function zoomIn(elem) {

            return new Promise(function (resolve, reject) {

                var duration = 240;
                elem.style.animation = 'mpvvideoplayer-zoomin ' + duration + 'ms ease-in normal';
                dom.addEventListener(elem, dom.whichAnimationEvent(), resolve, {
                    once: true
                });
            });
        }

        function sendCommand(name, body) {

            return new Promise(function (resolve, reject) {

                var xhr = new XMLHttpRequest();

                xhr.open('POST', 'http://127.0.0.1:8023/' + name, true);

                xhr.onload = function () {
                    if (this.responseText && this.status >= 200 && this.status <= 400) {

                        if (name === 'stats') {

                            resolve(JSON.parse(this.responseText));
                            return;
                        }

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
                                onUnpause();
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
