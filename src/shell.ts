define(["events", "apphost"], function (events, apphost) {
    function sendCommand(name: string): Promise<Response> {
        return fetch(`electronapphost://${name}`).then((response) => {
            if (!response.ok) {
                console.error("Error sending command: ", response);
                throw response;
            }
            return response;
        });
    }

    const shell = {};
    let closingWindowState;

    function getProcessClosePromise(pid): Promise<void> {
        // returns a promise that resolves or rejects when a process closes
        return new Promise(function (resolve, reject) {
            events.on(shell, "closed", function (e, processId, error) {
                if (processId === pid) {
                    if (closingWindowState) {
                        apphost.setWindowState(closingWindowState);
                        closingWindowState = null;
                    }

                    if (error) {
                        reject();
                    } else {
                        resolve();
                    }
                }
            });
        });
    }

    window["onChildProcessClosed"] = function (processId, error): void {
        events.trigger(shell, "closed", [processId, error]);
    };

    function paramsToString(params): string {
        const values = [];

        for (const key in params) {
            const value = params[key];

            if (value !== null && value !== undefined && value !== "") {
                values.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }
        return values.join("&");
    }

    shell["openUrl"] = function (url): Promise<Response> {
        return sendCommand(`openurl?url=${url}`);
    };

    shell["canExec"] = true;

    shell["close"] = function (processId): Promise<Response> {
        const url = `shellclose?id=${processId}`;

        return sendCommand(url);
    };

    shell["exec"] = function (options): Promise<any> {
        const url = `shellstart?${paramsToString(options)}`;

        return sendCommand(url).then(function (response) {
            if (apphost.supports("windowstate")) {
                closingWindowState = apphost.getWindowState();
                apphost.setWindowState("Minimized");
            }

            events.trigger(shell, "exec", [response]);

            return {
                id: response,
                promise: getProcessClosePromise(response),
            };
        });
    };

    return shell;
});
