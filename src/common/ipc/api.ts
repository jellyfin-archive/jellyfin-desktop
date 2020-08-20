export interface MainApi {
    appVersion(): string;
    deviceId(): Promise<string>;
    deviceName(): Promise<string>;
}
