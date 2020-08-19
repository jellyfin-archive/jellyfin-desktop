define(["events", "apphost"], function (events, apphost) {
    function sendCommand(name: string): Promise<any> {
        return fetch(`electronapphost://${name}`).then((response) => {
            if (!response.ok) {
                console.error("Error sending command: ", response);
                throw response;
            }
            return response.json();
        });
    }

    const shell: Record<string, any> = {};
    let closingWindowState: string | null;

    function getProcessClosePromise(pid: number): Promise<void> {
        // returns a promise that resolves or rejects when a process closes
        return new Promise(function (resolve, reject) {
            events.on(shell, "closed", function (e: any, processId: number, error: any) {
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

    (window as any)["onChildProcessClosed"] = function (processId: number, error: any): void {
        events.trigger(shell, "closed", [processId, error]);
    };

    type QueryParams = Record<string, string | number | boolean>;

    function paramsToString(params: QueryParams): string {
        const values: string[] = [];

        for (const key in params) {
            const value = params[key];

            if (value !== null && value !== undefined && value !== "") {
                values.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }
        return values.join("&");
    }

    shell["openUrl"] = function (url: string): Promise<Response> {
        return sendCommand(`openurl?url=${url}`);
    };

    shell["canExec"] = true;

    shell["close"] = function (processId: number): Promise<Response> {
        const url = `shellclose?id=${processId}`;

        return sendCommand(url);
    };

    shell["exec"] = function (options: QueryParams): Promise<any> {
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
