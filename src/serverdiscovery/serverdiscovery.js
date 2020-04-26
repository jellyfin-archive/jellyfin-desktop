define([], function () {

    return {

        findServers: function (timeoutMs) {

            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', 'electronserverdiscovery://findservers?timeout=' + timeoutMs, true);
                xhr.onload = function () {
                    if (this.response) {
                        var data = this.response;
                        try {
                            var servers = JSON.parse(data);
                            resolve(servers);
                        } catch (e){
                            reject();
                        }
                    } else {
                        reject();
                    }
                };
                xhr.onerror = reject;
                xhr.send();
                // Expected server properties
                // Name, Id, Address, EndpointAddress (optional)
            });
        }
    };

});