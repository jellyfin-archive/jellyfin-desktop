define(['loading', 'pluginManager', 'scrollHelper', 'appSettings', 'emby-select', 'emby-checkbox'], function (loading, pluginManager, scrollHelper, appSettings) {

    return function (view, params) {

        var self = this;

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

            var selectHwaMode = view.querySelector('.selectHwaMode');
            config.VideoConfig.HwaMode = selectHwaMode.value;

            var selectRefreshRateMode = view.querySelector('.selectRefreshRateMode');
            config.VideoConfig.AutoChangeRefreshRate = selectRefreshRateMode.value;

            var selectNominalRange = view.querySelector('.selectNominalRange');
            config.VideoConfig.NominalRange = selectNominalRange.value;
        }

        function renderSettings() {

            var selectHwaMode = view.querySelector('.selectHwaMode');
            selectHwaMode.value = config.VideoConfig.HwaMode;

            var selectRefreshRateMode = view.querySelector('.selectRefreshRateMode');
            selectRefreshRateMode.value = config.VideoConfig.AutoChangeRefreshRate;

            var selectNominalRange = view.querySelector('.selectNominalRange');
            selectNominalRange.value = config.VideoConfig.NominalRange;
        }
    }

});