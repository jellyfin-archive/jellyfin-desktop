// tslint:disable-next-line:interface-name
declare interface Window {
    Emby: {
        App: {
            start(appStartInfo: any): void;
        };
    };
    appStartInfo?: any;
}
