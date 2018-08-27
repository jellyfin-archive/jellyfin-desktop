define(['globalize', 'apphost', 'playbackManager', 'pluginManager', 'events', 'embyRouter', 'appSettings', 'userSettings', 'loading', 'dom', 'require', 'connectionManager'], function (globalize, appHost, playbackManager, pluginManager, events, embyRouter, appSettings, userSettings, loading, dom, require, connectionManager) {
    'use strict';

    function getTextTrackUrl(subtitleStream, serverId) {
        return playbackManager.getSubtitleUrl(subtitleStream, serverId);
    }

    return function () {

        var self = this;

        self.name = 'MPV';
        self.type = 'mediaplayer';
        self.id = 'mpvmediaplayer';
        self.priority = -1;

        var currentSrc;
        var playerState = {
            volume: parseInt(appSettings.get('mpv-volume') || '100')
        };
        var ignoreEnded;
        var videoDialog;
        var currentAspectRatio = 'bestfit';

        document.addEventListener('video-osd-show', function () {
            //alert("OSD Shown");
            sendCommand("video_toggle");
        });

        document.addEventListener('video-osd-hide', function () {
            //alert("OSD Hidden");
            sendCommand("video_toggle");
        });

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
                lang: 'cs',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/cs.json')
            });

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
                lang: 'lt-LT',
                path: pluginManager.mapPath(self, 'mpvplayer/strings/lt-LT.json')
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

            profile.MaxStreamingBitrate = 200000000;
            profile.MaxStaticBitrate = 200000000;
            profile.MusicStreamingTranscodingBitrate = 192000;

            profile.DirectPlayProfiles = [];

            // leave container null for all
            profile.DirectPlayProfiles.push({
                Type: 'Video'
            });

            var apiClient = item && item.ServerId ? connectionManager.getApiClient(item.ServerId) : null;
            var supportsEmptyContainer = apiClient ? apiClient.isMinServerVersion('3.2.60.1') : false;

            if (supportsEmptyContainer) {
                // leave container null for all
                profile.DirectPlayProfiles.push({
                    Type: 'Audio'
                });
            }
            else {
                // for older servers that don't support leaving container blank
                profile.DirectPlayProfiles.push({
                    Container: 'aac,mp3,mpa,wav,wma,mp2,ogg,oga,webma,ape,opus,alac,flac,m4a',
                    Type: 'Audio'
                });
            }

            profile.TranscodingProfiles = [];

            profile.TranscodingProfiles.push({
                Container: 'ts',
                Type: 'Video',
                AudioCodec: 'ac3,mp3,aac',
                VideoCodec: 'h264,mpeg2video,hevc',
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: '6',
                MinSegments: '1',
                BreakOnNonKeyFrames: true,
                SegmentLength: '3'
            });

            profile.TranscodingProfiles.push({
                Container: 'ts',
                Type: 'Audio',
                AudioCodec: 'aac',
                Context: 'Streaming',
                Protocol: 'hls',
                BreakOnNonKeyFrames: true,
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
                Format: 'ssa',
                Method: 'External'
            });
            profile.SubtitleProfiles.push({
                Format: 'ass',
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
                Format: 'dvb_teletext',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'dvb_subtitle',
                Method: 'Embed'
            });
            profile.SubtitleProfiles.push({
                Format: 'dvbsub',
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

        self.getDirectPlayProtocols = function () {
            return ['File', 'Http', 'Rtp', 'Rtmp', 'Rtsp', 'Ftp'];
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

            var item = options.item;
            var mediaSource = JSON.parse(JSON.stringify(options.mediaSource));

            var url = options.url;

            ignoreEnded = false;
            currentSrc = url;
            currentAspectRatio = 'bestfit'

            //var isVideo = options.mimeType.toLowerCase('video').indexOf() == 0;
            var isVideo = options.item.MediaType == 'Video';

            for (var i = 0, length = mediaSource.MediaStreams.length; i < length; i++) {

                var track = mediaSource.MediaStreams[i];

                if (track.Type === 'Subtitle') {

                    if (track.DeliveryMethod === 'External') {
                        track.DeliveryUrl = getTextTrackUrl(track, item.ServerId);
                    }
                }
            }

            var enableFullscreen = options.fullscreen !== false;

            var subtitleAppearanceSettings = userSettings.getSubtitleAppearanceSettings();
            var fontSize;
            switch (subtitleAppearanceSettings.textSize || '') {

                case 'small':
                    fontSize = 45;
                    break;
                case 'larger':
                    fontSize = 75;
                    break;
                case 'extralarge':
                    fontSize = 85;
                    break;
                case 'large':
                    fontSize = 65;
                    break;
                default:
                    break;
            }
            var fontFamily;
            switch (subtitleAppearanceSettings.font || '') {

                case 'smallcaps':
                case 'typewriter':
                case 'console':
                    fontFamily = 'monospace';
                    break;
                case 'print':
                    fontFamily = 'Times New Roman';
                    break;
                case 'cursive':
                    fontFamily = 'cursive';
                    break;
                case 'casual':
                    fontFamily = 'Comic Sans MS';
                    break;
                default:
                    break;
            }

            var requestBody = {
                path: url,
                isVideo: isVideo,
                playMethod: options.playMethod,
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
                    videoStereoMode: appSettings.get('mpv-videostereomode'),
                    openglhq: appSettings.get('mpv-openglhq') === 'true',
                    exclusiveAudio: appSettings.get('mpv-exclusiveaudio') === 'true',
                    videoSync: appSettings.get('mpv-videosync') === 'true' ? 'display-resample' : null,
                    displaySync: appSettings.get('mpv-displaysync') === 'true',
                    displaySync_Override: appSettings.get('mpv-displaysync_override'),
                    interpolation: appSettings.get('mpv-interpolation') === 'true',
                    correctdownscaling: appSettings.get('mpv-correctdownscaling') === 'true',
                    sigmoidupscaling: appSettings.get('mpv-sigmoidupscaling') === 'true',
                    deband: appSettings.get('mpv-deband') === 'true',
                    fullscreen: enableFullscreen,
                    //genPts: mediaSource.RunTimeTicks ? false : true,
                    audioDelay: parseInt(appSettings.get('mpv-audiodelay') || '0'),
                    audioDelay2325: parseInt(appSettings.get('mpv-audiodelay2325') || 0),
                    largeCache: mediaSource.RunTimeTicks == null || options.item.Type === 'Recording' ? true : false,
                    subtitleFontSize: fontSize,
                    subtitleFontFamily: fontFamily,
                    volume: playerState.volume || 100
                }
            };

            playerState.volume = requestBody.playerOptions.volume;

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
                    destroyInternal(false);
                }
            });
        };

        function destroyInternal(destroyCommand) {

            if (destroyCommand) {
                sendCommand('stopdestroy');
            }

            embyRouter.setTransparency('none');

            var dlg = videoDialog;
            if (dlg) {

                videoDialog = null;

                dlg.parentNode.removeChild(dlg);
            }
        }

        self.destroy = function () {
            destroyInternal(true);
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

        self.volumeUp = function (val) {
            sendCommand('volumeUp').then(onVolumeChange);
        };

        self.volumeDown = function (val) {
            sendCommand('volumeDown').then(onVolumeChange);
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

        function mapRange(range) {
            var offset;
            //var currentPlayOptions = instance._currentPlayOptions;
            //if (currentPlayOptions) {
            //    offset = currentPlayOptions.transcodingOffsetTicks;
            //}

            offset = offset || 0;

            return {
                start: (range.start * 10000000) + offset,
                end: (range.end * 10000000) + offset
            };
        }

        var supportedFeatures;
        function getSupportedFeatures() {

            var list = [];

            list.push('SetAspectRatio');

            return list;
        }

        self.supports = function (feature) {

            if (!supportedFeatures) {
                supportedFeatures = getSupportedFeatures();
            }

            return supportedFeatures.indexOf(feature) !== -1;
        };

        self.setAspectRatio = function (val) {

            currentAspectRatio = val;
            sendCommand('aspectratio?val=' + val);
        };

        self.getAspectRatio = function () {

            return currentAspectRatio;
        };

        self.getSupportedAspectRatios = function () {

            return [
                { name: '4:3', id: '4_3' },
                { name: '16:9', id: '16_9' },
                { name: globalize.translate('sharedcomponents#Auto'), id: 'bestfit' },
                //{ name: globalize.translate('sharedcomponents#Fill'), id: 'fill' },
                { name: globalize.translate('sharedcomponents#Original'), id: 'original' }
            ];
        };

        self.getBufferedRanges = function () {

            var cacheState = playerState.demuxerCacheState;
            if (cacheState) {
                var ranges = cacheState['seekable-ranges'];

                if (ranges) {
                    return ranges.map(mapRange);
                }
            }
            return [];
        };

        self.seekable = function () {

            return true;
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

            appSettings.set('mpv-volume', self.volume());
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
