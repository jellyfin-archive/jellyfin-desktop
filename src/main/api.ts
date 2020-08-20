import { MainApi } from "../common/ipc/api";
import { app } from "electron";
import { hostname } from "os";
import { join } from "path";
import { promises as fs } from "fs";

const genRanHex = (size) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");

async function exists(path: string) {
    try {
        await fs.access(path);
    } catch (e) {
        return false;
    }
    return true;
}

export class MainApiService implements MainApi {
    appVersion(): string {
        return app.getVersion();
    }
    async deviceId(): Promise<string> {
        const deviceIdPath = join(app.getPath("userData"), "device.id");

        if (await exists(deviceIdPath)) {
            return fs.readFile(deviceIdPath, { encoding: "utf-8" });
        }
        const id = genRanHex(16);
        await fs.writeFile(deviceIdPath, id, { encoding: "utf-8" });
        return id;
    }
    deviceName(): Promise<string> {
        return Promise.resolve(hostname());
    }
}
