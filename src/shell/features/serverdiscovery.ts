import { createSocket } from "dgram";
import { IFoundServer } from "../../types";

export function findServers(timeoutMs: number) {
    return new Promise<IFoundServer[]>(resolve => {
        const PORT = 7359;
        const MULTICAST_ADDR = "255.255.255.255";

        const servers = [];
        let client;

        try {
            client = createSocket({ type: "udp4", reuseAddr: true });
        } catch (err) {
            resolve(servers);
            return;
        }

        function onReceive(message, info) {
            try {
                if (info !== null) {
                    console.log(`Message from: ${info.address}:${info.port}`);
                    console.log("ServerDiscovery message received");
                    // Expected server properties
                    // Name, Id, Address, EndpointAddress (optional)
                    console.log(`Server discovery json: ${message.toString()}`);
                    const server = JSON.parse(message.toString());
                    server.EndpointAddress = info.address;
                    servers.push(server);
                }
            } catch (err) {
                console.log(`Error receiving server info: ${err}`);
            }
        }

        function onTimerExpired() {
            console.log("timer expired", servers.length, "servers received");
            console.log(servers);
            resolve(servers);

            try {
                client.close();
            } catch (err) {}
        }

        client.on("message", onReceive);

        client.on("listening", () => {
            try {
                const address = client.address();
                client.setBroadcast(true);
                const message = Buffer.from("who is JellyfinServer?");
                client.send(
                    message,
                    0,
                    message.length,
                    PORT,
                    MULTICAST_ADDR,
                    err => {
                        if (err) {
                            console.error(err);
                        }
                    }
                );
                console.log(
                    `UDP Client listening on ${address.address}:${address.port}`
                );
                console.log(
                    `Starting udp receive timer with timeout ms: ${timeoutMs}`
                );
                setTimeout(onTimerExpired, timeoutMs);
            } catch (err) {
                onTimerExpired();
            }
        });

        try {
            client.bind();
        } catch (err) {
            onTimerExpired();
        }
    });
}
