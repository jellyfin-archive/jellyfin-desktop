import { INativeShell } from "@cromefire_/nativeshell-api-definition";

declare function define(moduleDefinitions: string[], module: (...modules: any) => any): void;
declare function require(moduleDefinitions: string[], module: (...modules: any) => any): void;

declare global {
    interface Window {
        NativeShell: INativeShell;
    }
}
