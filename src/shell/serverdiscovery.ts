import { JsonObject } from "../common/types";

define([], function () {
    return {
        findServers: async function (timeoutMs: number): Promise<JsonObject> {
            const response = await fetch(`electronserverdiscovery://findservers?timeout=${timeoutMs}`, {
                method: "POST",
            });
            if (!response.ok) {
                throw response;
            }
            // Expected server properties
            // Name, Id, Address, EndpointAddress (optional)
            return response.json();
        },
    };
});
