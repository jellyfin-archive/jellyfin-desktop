import { createSocket } from "dgram";
import { isIPv6 } from "net";

export function createMagicPacket(mac: string) {
    const MAC_LENGTH = 0x06;
    const MAC_REPEAT = 0x16;
    const PACKET_HEADER = 0x06;
    const parts = mac.match(/[0-9a-fA-F]{2}/g);
    if (!parts || parts.length !== MAC_LENGTH) {
        throw new Error(`malformed MAC address '${mac}'`);
    }
    let buffer = Buffer.alloc(PACKET_HEADER);
    const bufMac = Buffer.from(parts.map(p => parseInt(p, 16)));
    buffer.fill(0xff);
    for (let i = 0; i < MAC_REPEAT; i++) {
        buffer = Buffer.concat([buffer, bufMac]);
    }
    return buffer;
}

export function wake(mac, options, callback) {
    options = options || {};
    if (typeof options === "function") {
        callback = options;
    }
    const defaults = {
        address: "255.255.255.255",
        port: 9
    };
    for (const k in options) {
        if (options.hasOwnProperty(k)) {
            defaults[k] = options[k];
        }
    }
    options = defaults;
    let magicPacket;
    // create magic packet
    try {
        magicPacket = createMagicPacket(mac);
    } catch (err) {
        callback(err);
        return;
    }
    const socket = createSocket(isIPv6(options.address) ? "udp6" : "udp4")
        .on("error", err => {
            socket.close();
            if (callback) {
                callback(err);
            }
        })
        .once("listening", () => {
            socket.setBroadcast(true);
        });
    socket.send(
        magicPacket,
        0,
        magicPacket.length,
        options.port,
        options.address,
        (err, res) => {
            if (callback) {
                callback(err, res === magicPacket.length);
            }
            socket.close();
        }
    );
}
