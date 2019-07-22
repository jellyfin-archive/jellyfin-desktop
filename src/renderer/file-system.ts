import { Remote } from "comlink";
import { TheaterApi } from "../shell/api";

export class FileSystem {
    constructor(private api: Remote<TheaterApi>) {}

    public async fileExists(path: string) {
        return await this.api.exists(path);
    }

    public async directoryExists(path: string) {
        return await this.api.exists(path);
    }
}
