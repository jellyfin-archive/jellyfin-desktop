// tslint:disable-next-line:interface-name
interface Window {
    Emby: {
        App: {
            start(appStartInfo: any): void;
        };
    };
    appStartInfo?: any;
    theaterApi: any;
    AppCloseHelper: {
        onClosing(): void;
    };
    require(modules: string[], callback: (...modules: any[]) => void);
}
