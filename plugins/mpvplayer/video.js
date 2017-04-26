define(['loading', 'pluginManager', 'scrollHelper', 'appSettings', 'emby-select', 'emby-checkbox'], function (loading, pluginManager, scrollHelper, appSettings) {

    return function (view, params) {

        view.addEventListener('viewbeforeshow', function (e) {

            var isRestored = e.detail.isRestored;

            Emby.Page.setTitle('Video Settings');

            loading.hide();

            if (!isRestored) {
                scrollHelper.centerFocus.on(view.querySelector('.smoothScrollY'), false);

                renderSettings();
            }
        });

        view.addEventListener('viewbeforehide', saveSettings);

        function saveSettings() {

            appSettings.set('mpv-hwdec', view.querySelector('.selectHwaMode').value);
            appSettings.set('mpv-outputlevels', view.querySelector('.selectNominalRange').value);
            appSettings.set('mpv-refreshrate', view.querySelector('.selectRefreshRateMode').value);
        }

        function renderSettings() {

            view.querySelector('.selectHwaMode').value = appSettings.get('mpv-hwdec') || '';
            view.querySelector('.selectNominalRange').value = appSettings.get('mpv-outputlevels') || '';
            view.querySelector('.selectRefreshRateMode').value = appSettings.get('mpv-refreshrate') || '';
        }
    }

});