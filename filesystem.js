define([], function () {

    return {
        fileExists: function (path) {
            return new Promise(function (resolve, reject) {

                var xhr = new XMLHttpRequest();
                xhr.open('POST', 'electronfs://fileexists?path=' + path, true);
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
        },
        directoryExists: function (path) {
            return new Promise(function (resolve, reject) {

                var xhr = new XMLHttpRequest();
                xhr.open('POST', 'electronfs://directoryexists?path=' + path, true);
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
    };
});