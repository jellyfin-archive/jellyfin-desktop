/**
 * @fileOverview Polyfills and similar
 */
import { ElectronMessageAdapter } from "electron-comlink";
import "source-map-support/register";
import { main } from "./main";

ElectronMessageAdapter.patchMessagePort(global); // Required because Comlink expects the MessagePort global to exist

console.info("Starting app");
main().then(() => console.info("App started"));
