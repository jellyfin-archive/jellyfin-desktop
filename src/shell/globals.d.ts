import { INativeShell } from "@cromefire_/nativeshell-api-definition";

declare global {
    function define(moduleDefinitions: string[], module: (...modules: any) => any): void;
    function require(moduleDefinitions: string[], module: (...modules: any) => any): void;

    interface Window {
        NativeShell: INativeShell;
    }
}
