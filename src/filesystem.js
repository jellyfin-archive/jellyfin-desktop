define([], function () {

    function exits(endpoint, path) {
        return new Promise(function (resolve, reject) {

            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'electronfs://' + endpoint + '?path=' + path, true);
            xhr.onload = function () {
                if (this.response == 'true') {
                    resolve();
                } else {
                    reject();
                }
            };
            xhr.onerror = reject;
            xhr.send();
        });
    }

    return {
        fileExists: function (path) {
            return exits('fileexists', path);
        },
        directoryExists: function (path) {
            return exits('directoryexists', path);
        }
    };
});