define([], function () {
    function send(info): Promise<void> {
        return fetch(`electronwakeonlan://wakeserver?macaddress=${info.MacAddress}&port=${info.Port}`, {
            method: "POST",
        }).then((response) => {
            if (!response.ok) {
                throw response;
            }
        });
    }

    function isSupported(): boolean {
        return true;
    }

    return {
        send,
        isSupported,
    };
});
