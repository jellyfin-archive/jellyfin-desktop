define(['apphost', 'pluginManager', 'events', 'embyRouter'], function (appHost, pluginManager, events, embyRouter) {
    'use strict';

    return function () {

        var self = this;

        self.name = 'MPV Media Player';
        self.type = 'mediaplayer';
        self.id = 'mpvmediaplayer';

        var currentSrc;
        var playbackPosition = 0;
        var timeUpdateInterval;
        var currentVolume = 100;
        var playerState = {};

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
                Container: 'm4v,3gp,ts,mpegts,mov,xvid,vob,mkv,wmv,asf,ogm,ogv,m2v,avi,mpg,mpeg,mp4,webm,wtv,iso,m2ts,dvr-ms',
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
                VideoCodec: 'h264',
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

            if (currentSrc == url) {
                // we are already playing this file so just set position
                // need this in seconds
                //alert("Play called again, playerStartPorsitionTicks*100= " + String(options.playerStartPositionTicks * 100));
                sendData("set_position", (options.playerStartPositionTicks * 100));
            }
            else {
                currentSrc = url;

                var startTime = new Date(null);
                startTime.setSeconds((options.playerStartPositionTicks || 0) / 10000000);
                //alert("Play called, options.playerStartPositionTick/bigthing = " + String(startTime.setSeconds((options.playerStartPositionTicks || 0) / 1000000000)));
                var startTimeString = startTime.toISOString().substr(11, 8);
                //alert(startTimeString);

                var playRequest = {
                    url: url,
                    startTime: startTimeString
                };
                var playData = JSON.stringify(playRequest);

                playbackPosition = options.playerStartPositionTicks * 100;
                sendData("play", url, setCurrentPos);


                startTimeUpdateInterval(1000);
                embyRouter.showVideoOsd();
            }

            //playbackPosition = (options.playerStartPositionTicks || 0) / 10;
            events.trigger(self, 'timeupdate');
            return Promise.resolve();
        };

        self.currentTime = function (val) {
            if (val != null) {
                sendData("set_position", val / 10000);
                playbackPosition = val / 10000;
                return;
            }
            // needs to be in seconds
            return playbackPosition / 100;
        };

        self.duration = function (val) {
            
            // TODO: Return runtime in ms as detected by the player, or null
            return null;
        };

        self.stop = function (destroyPlayer) {

            // TODO: Make this more like the following code which is commented out
            // Don't trigger ended and reset data when stop is requested, do it once the stop actually happens
            //var cmd = destroyPlayer ? 'stopfade' : 'stop';
            //return sendCommand(cmd).then(function () {

            //    onEnded(reportEnded);

            //    if (destroyPlayer) {
            //        self.destroy();
            //    }
            //});

            currentSrc = "";

            sendData("stop");
            events.trigger(self, 'stopped');
            
            if (destroyPlayer) {
                self.destroy();
            }
        };

        self.destroy = function () {
            embyRouter.setTransparency('none');
        };

        self.pause = function () {
            sendData("pause_toggle");
        };

        self.unpause = function () {
            sendData("pause_toggle");
        };

        self.playPause = function () {
            sendData("pause_toggle");
        };

        self.paused = function () {

            // TODO	
            return false;
        };

        self.volume = function (val) {

            if (val != null) {
                sendData("volume", val);
                currentVolume = val;
                return;
            }

            return currentVolume;
        };

        self.setSubtitleStreamIndex = function (index) {
            // TODO
        };

        self.setAudioStreamIndex = function (index) {
            // TODO
        };

        self.canSetAudioStreamIndex = function () {
            return true;
        };

        self.setMute = function (mute) {
        };

        self.isMuted = function () {
            return false;
        };

        function startTimeUpdateInterval(interval) {
            stopTimeUpdateInterval();
            //alert("startTimeUpdateInterval: " + interval);
            timeUpdateInterval = setInterval(onTimeUpdate, interval);
        }

        function stopTimeUpdateInterval() {
            if (timeUpdateInterval) {
                clearInterval(timeUpdateInterval);
                timeUpdateInterval = null;
            }
        }

        function onTimeUpdate() {
            sendData("get_position", false, updatePlayerPosition);
        }

        function updatePlayerPosition(data) {
            playbackPosition = parseInt(data);
            events.trigger(self, 'timeupdate');
        }

        function setCurrentPos(data) {
            setTimeout(function() {
                sendData("set_position", playbackPosition);
            }, 100);
        }

        function sendData(action, sendData, callback) {

            sendData = encodeURIComponent(sendData);
            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'mpvplayer://' + action + '?data=' + sendData, true);
            xhr.onload = function () {
                if (this.response) {
                    var data = this.response;
                    if (callback) {
                        callback(data);
                    }
                }
            };
            xhr.send();
        }
    }
});
