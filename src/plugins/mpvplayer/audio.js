define(['loading', 'appSettings', 'emby-select', 'emby-checkbox', 'emby-scroller'], function (loading, appSettings) {

    function getMultiCheckboxValues(view, className) {

        var checkboxes = view.querySelectorAll('.' + className);
        var values = [];

        for (var i = 0, length = checkboxes.length; i < length; i++) {

            if (checkboxes[i].checked) {
                values.push(checkboxes[i].getAttribute('data-value'));
            }
        }

        return values;
    }

    function setMultiCheckboxValues(view, className, values) {

        values = values.split(',');
        var checkboxes = view.querySelectorAll('.' + className);

        for (var i = 0, length = checkboxes.length; i < length; i++) {

            checkboxes[i].checked = values.indexOf(checkboxes[i].getAttribute('data-value')) !== -1;
        }
    }

    function onSubmit(e) {
        e.preventDefault();
        return false;
    }

    return function (view, params) {

        view.querySelector('form').addEventListener('submit', onSubmit);

        view.addEventListener('viewbeforeshow', function (e) {

            var isRestored = e.detail.isRestored;

            Emby.Page.setTitle('Audio Settings');

            loading.hide();

            if (!isRestored) {
                renderSettings();
            }
        });

        view.addEventListener('viewbeforehide', saveSettings);

        function saveSettings() {

            appSettings.set('mpv-drc', view.querySelector('.selectDrc').value);
            appSettings.set('mpv-speakerlayout', view.querySelector('.selectSpeakerLayout').value);
            appSettings.set('mpv-exclusiveAudio', view.querySelector('.chkExclusiveMode').checked);

            appSettings.set('mpv-audiospdif', getMultiCheckboxValues(view, 'chkSpdif').join(','));
            appSettings.set('mpv-upmixaudiofor', getMultiCheckboxValues(view, 'chkUpmixAudioFor').join(','));
        }

        function renderSettings() {

            view.querySelector('.selectSpeakerLayout').value = appSettings.get('mpv-speakerlayout') || '';
            view.querySelector('.selectDrc').value = appSettings.get('mpv-drc') || '';
            view.querySelector('.chkExclusiveMode').checked = appSettings.get('mpv-exclusiveAudio') === 'true';

            setMultiCheckboxValues(view, 'chkSpdif', appSettings.get('mpv-audiospdif') || '');
            setMultiCheckboxValues(view, 'chkUpmixAudioFor', appSettings.get('mpv-upmixaudiofor') || '');
        }
    }

});