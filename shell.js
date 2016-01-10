define([], function () {

    function sendCommand(name) {

        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'electronapphost://' + name, true);

        xhr.send();
    }

    return {
        openUrl: function (url) {
            sendCommand('openurl?url=' + url);
        }
    };
});