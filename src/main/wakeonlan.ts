import * as net from "net";
import * as dgram from "dgram";

export function createMagicPacket(mac: string): Buffer {
    const MAC_LENGTH = 6;
    const MAC_REPEAT = 16;
    const PACKET_HEADER = 6;
    const parts = mac.match(/[0-9a-fA-F]{2}/g);
    if (!parts || parts.length != MAC_LENGTH) throw new Error(`malformed MAC address '${mac}'`);
    let buffer = new Buffer(PACKET_HEADER);
    const bufMac = new Buffer(
        parts.map(function (p) {
            return parseInt(p, 16);
        })
    );
    buffer.fill(0xff);
    for (let i = 0; i < MAC_REPEAT; i++) {
        buffer = Buffer.concat([buffer, bufMac]);
    }
    return buffer;
}

export function wake(mac: string, port = 9, address = "255.255.255.255"): Promise<boolean> {
    // create magic packet
    let magicPacket: Buffer;
    try {
        magicPacket = createMagicPacket(mac);
    } catch (err) {
        return Promise.reject(err);
    }
    return new Promise<boolean>((resolve, reject) => {
        const socket = dgram
            .createSocket(net.isIPv6(address) ? "udp6" : "udp4")
            .on("error", (err) => {
                socket.close();
                reject(err);
            })
            .once("listening", () => {
                socket.setBroadcast(true);
            });
        socket.send(magicPacket, 0, magicPacket.length, port, address, function (err, res) {
            if (err) {
                reject(err);
            } else {
                resolve(res == magicPacket.length);
            }
            socket.close();
        });
    });
}
