define(['loading', 'scrollHelper', 'appSettings', 'emby-select', 'emby-checkbox'], function (loading, scrollHelper, appSettings) {

    return function (view, params) {

        var self = this;

        view.addEventListener('viewbeforeshow', function (e) {

            var isRestored = e.detail.isRestored;

            Emby.Page.setTitle('Audio Settings');

            loading.hide();

            if (!isRestored) {
                scrollHelper.centerFocus.on(view.querySelector('.smoothScrollY'), false);
                renderSettings();
            }
        });

        view.addEventListener('viewbeforehide', saveSettings);

        function saveSettings() {

            var selectAudioBitstreamingMode = view.querySelector('.selectAudioBitstreamingMode');
            config.AudioConfig.AudioBitstreaming = selectAudioBitstreamingMode.value;

            var selectAudioRenderer = view.querySelector('.selectAudioRenderer');
            config.AudioConfig.Renderer = selectAudioRenderer.value;

            var selectSpeakerLayout = view.querySelector('.selectSpeakerLayout');
            config.AudioConfig.SpeakerLayout = selectSpeakerLayout.value;

            var selectDrc = view.querySelector('.selectDrc');
            config.AudioConfig.EnableDRC = selectDrc.value != '';
            config.AudioConfig.DRCLevel = selectDrc.value || '100';

            config.AudioConfig.ExpandMono = view.querySelector('.selectExpandMono').value == 'true';
            config.AudioConfig.Expand61 = view.querySelector('.selectExpandSixToSeven').value == 'true';
        }

        function renderSettings() {
            var selectAudioBitstreamingMode = view.querySelector('.selectAudioBitstreamingMode');
            selectAudioBitstreamingMode.value = config.AudioConfig.AudioBitstreaming;

            var selectAudioRenderer = view.querySelector('.selectAudioRenderer');
            selectAudioRenderer.value = config.AudioConfig.Renderer;

            view.querySelector('.selectSpeakerLayout').value = config.AudioConfig.SpeakerLayout;

            view.querySelector('.selectDrc').value = config.AudioConfig.EnableDRC ? config.AudioConfig.DRCLevel : '';

            view.querySelector('.selectExpandMono').value = config.AudioConfig.ExpandMono;
            view.querySelector('.selectExpandSixToSeven').value = config.AudioConfig.Expand61;
        }
    }

});