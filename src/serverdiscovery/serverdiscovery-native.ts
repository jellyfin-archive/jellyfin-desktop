import * as dgram from "dgram";

export function findServers(timeoutMs): Promise<string> {
    const PORT = 7359;
    const MULTICAST_ADDR = "255.255.255.255";

    const servers = [];
    let client: dgram.Socket;

    let callback: (res: string) => void;

    const result = new Promise<string>((resolve) => (callback = resolve));

    try {
        client = dgram.createSocket({ type: "udp4", reuseAddr: true });
    } catch (err) {
        return Promise.resolve(JSON.stringify(servers));
    }

    function onError(err: Error): void {
        console.warn("Error discovering servers: ", err);
        try {
            client.close();
        } catch (err) {
            console.warn("Error closing udp client: ", err);
        }
    }

    function onTimerExpired(): void {
        console.log("timer expired", servers.length, "servers received");
        console.log(servers);
        callback(JSON.stringify(servers));

        try {
            client.close();
        } catch (err) {
            console.error("Error: Closing udp client: ", err);
        }
    }

    client.on("message", (message, info) => {
        console.info(`Message from: ${info.address}:${info.port}`);
        try {
            // Expected server properties
            console.debug(`Server discovery json: ${message.toString()}`);
            const server = JSON.parse(message.toString());
            server.EndpointAddress = info.address;
            servers.push(server);
        } catch (err) {
            console.warn(`Error receiving server info: ${err}`);
        }
    });

    client.on("listening", function () {
        try {
            const address = client.address();
            client.setBroadcast(true);
            const message = new Buffer("who is JellyfinServer?");
            client.send(message, 0, message.length, PORT, MULTICAST_ADDR, function (err) {
                if (err) console.error(err);
            });
            console.info(`UDP Client listening on ${address.address}:${address.port}`);
            console.info(`starting udp receive timer with timeout ms: ${timeoutMs}`);
            timeoutMs = setTimeout(onTimerExpired, timeoutMs);
        } catch (err) {
            onError(err);
        }
    });

    try {
        client.bind();
    } catch (err) {
        onError(err);
        return Promise.resolve(JSON.stringify(servers));
    }

    return result;
}
