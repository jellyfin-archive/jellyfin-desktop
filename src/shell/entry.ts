/**
 * @fileOverview Polyfills and similar
 */
import "source-map-support/register";
import { main } from "./main";

console.info("Starting app");
main().then(() => console.info("App started"));
