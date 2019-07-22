/* tslint:disable:no-namespace */
// tslint:disable-next-line:interface-name
declare interface Window {
    theaterApi: any;
}

interface IAlameda {
    (
        modules: string[],
        callback?: (...modules: any[]) => any,
        errback?: (error) => void
    ): Promise<any[]>;

    config(config: any);
}

declare const requirejs: IAlameda;
declare const define: IAlameda;
