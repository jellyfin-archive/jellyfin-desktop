define(['loading', 'pluginManager', 'appSettings', 'emby-select', 'emby-checkbox', 'emby-input', 'emby-scroller'], function (loading, pluginManager, appSettings) {

    function onSubmit(e) {
        e.preventDefault();
        return false;
    }

    return function (view, params) {

        view.querySelector('form').addEventListener('submit', onSubmit);

        view.addEventListener('viewbeforeshow', function (e) {

            var isRestored = e.detail.isRestored;

            Emby.Page.setTitle('Video Settings');

            loading.hide();

            if (!isRestored) {

                renderSettings();
            }
        });

        view.addEventListener('viewbeforehide', saveSettings);

        function saveSettings() {

            appSettings.set('mpv-hwdec', view.querySelector('.selectHwaMode').value);
            appSettings.set('mpv-outputlevels', view.querySelector('.selectNominalRange').value);
            appSettings.set('mpv-displaysync', view.querySelector('.chkRefreshRateMode').checked);
            appSettings.set('mpv-displaysync_override', view.querySelector('.txtUserRefreshRate').value);
            appSettings.set('mpv-videosync', view.querySelector('.chkVideoSync').checked);
            appSettings.set('mpv-deinterlace', view.querySelector('.selectDeinterlace').value);
            appSettings.set('mpv-scale', view.querySelector('.selectScale').value);
            appSettings.set('mpv-cscale', view.querySelector('.selectCScale').value);
            appSettings.set('mpv-dscale', view.querySelector('.selectDScale').value);
            appSettings.set('mpv-tscale', view.querySelector('.selectTScale').value);
            appSettings.set('mpv-ditherdepth', view.querySelector('.selectDitherDepth').value);

            appSettings.set('mpv-audiodelay', view.querySelector('.txtDefaultAudioDelay').value);
            appSettings.set('mpv-audiodelay2325', view.querySelector('.txtAudioDelay2325').value);

            appSettings.set('mpv-interpolation', view.querySelector('.chkInterpolation').checked);
            appSettings.set('mpv-openglhq', view.querySelector('.chkOpenglhq').checked);
            appSettings.set('mpv-correctdownscaling', view.querySelector('.chkCorrectDownscaling').checked);
            appSettings.set('mpv-sigmoidupscaling', view.querySelector('.chkSigmoid').checked);
            appSettings.set('mpv-deband', view.querySelector('.chkDeband').checked);
            appSettings.set('mpv-videostereomode', view.querySelector('.selectVideoStereoMode').value);
        }

        function renderSettings() {

            view.querySelector('.selectHwaMode').value = appSettings.get('mpv-hwdec') || '';
            view.querySelector('.selectNominalRange').value = appSettings.get('mpv-outputlevels') || '';
            view.querySelector('.chkRefreshRateMode').checked = appSettings.get('mpv-displaysync') === 'true';
            view.querySelector('.txtUserRefreshRate').value = appSettings.get('mpv-displaysync_override') || '';
            view.querySelector('.chkVideoSync').checked = appSettings.get('mpv-videosync') === 'true';
            view.querySelector('.selectDeinterlace').value = appSettings.get('mpv-deinterlace') || '';
            view.querySelector('.selectScale').value = appSettings.get('mpv-scale') || '';
            view.querySelector('.selectCScale').value = appSettings.get('mpv-cscale') || '';
            view.querySelector('.selectDScale').value = appSettings.get('mpv-dscale') || '';
            view.querySelector('.selectTScale').value = appSettings.get('mpv-tscale') || '';
            view.querySelector('.selectVideoStereoMode').value = appSettings.get('mpv-videostereomode') || '';
            view.querySelector('.selectDitherDepth').value = appSettings.get('mpv-ditherdepth') || '';

            view.querySelector('.txtDefaultAudioDelay').value = appSettings.get('mpv-audiodelay') || '0';
            view.querySelector('.txtAudioDelay2325').value = appSettings.get('mpv-audiodelay2325') || '0';

            view.querySelector('.chkOpenglhq').checked = appSettings.get('mpv-openglhq') === 'true';
            view.querySelector('.chkInterpolation').checked = appSettings.get('mpv-interpolation') === 'true';
            view.querySelector('.chkCorrectDownscaling').checked = appSettings.get('mpv-correctdownscaling') === 'true';
            view.querySelector('.chkSigmoid').checked = appSettings.get('mpv-sigmoidupscaling') === 'true';
            view.querySelector('.chkDeband').checked = appSettings.get('mpv-deband') === 'true';
        }
    }

});
