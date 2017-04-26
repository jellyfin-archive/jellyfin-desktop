define(['loading', 'scrollHelper', 'appSettings', 'emby-select', 'emby-checkbox'], function (loading, scrollHelper, appSettings) {

    return function (view, params) {

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

            appSettings.set('mpv-drc', view.querySelector('.selectDrc').value);
            appSettings.set('mpv-speakerlayout', view.querySelector('.selectSpeakerLayout').value);

            var spdifCheckboxes = view.querySelectorAll('.chkSpdif');
            var spdif = [];

            for (var i = 0, length = spdifCheckboxes.length; i < length; i++) {

                if (spdifCheckboxes[i].checked) {
                    spdif.push(spdifCheckboxes[i].getAttribute('data-value'));
                }
            }

            appSettings.set('mpv-audiospdif', spdif.join(','));
        }

        function renderSettings() {

            view.querySelector('.selectSpeakerLayout').value = appSettings.get('mpv-speakerlayout') || '';
            view.querySelector('.selectDrc').value = appSettings.get('mpv-drc') || '';

            var spdif = (appSettings.get('mpv-audiospdif') || '').split(',');
            var spdifCheckboxes = view.querySelectorAll('.chkSpdif');

            for (var i = 0, length = spdifCheckboxes.length; i < length; i++) {

                spdifCheckboxes[i].checked = spdif.indexOf(spdifCheckboxes[i].getAttribute('data-value')) !== -1;
            }
        }
    }

});