define([], function () {
    function exits(endpoint, path): Promise<boolean> {
        return fetch(`electronfs://${endpoint}?path=${path}`, { method: "POST" })
            .then((response) => {
                if (!response.ok) {
                    console.error("Error checking fs: ", response);
                    throw response;
                }
                return response;
            })
            .then(async (response) => {
                const text = await response.text();
                return text === "true";
            });
    }

    return {
        fileExists: function (path: string): Promise<boolean> {
            return exits("fileexists", path);
        },
        directoryExists: function (path: string): Promise<boolean> {
            return exits("directoryexists", path);
        },
    };
});
