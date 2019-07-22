/* tslint:disable:no-string-literal */
import { expose, wrap } from "comlink";
import {
    mainProcObjectEndpoint,
    rendererProcObjectEndpoint
} from "comlink-electron-adapter";
import { ipcRenderer } from "electron";
import { join } from "path";

import { TheaterApi } from "../shell/api";
import { RendererApi } from "./api";
import { NativeShell } from "./native-shell";

// prevent commonjs errors
window["exports"] = {};

const endpoint = rendererProcObjectEndpoint(ipcRenderer);

const rendererApi = new RendererApi();

expose(rendererApi, endpoint);

function onDomLoaded() {
    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute(
        "href",
        `file://${join(__dirname, "../../assets/theater.css")}`
    );
    document.head.appendChild(link);
    console.info("Inserted custom styles");
    const script = document.createElement("script");
    link.setAttribute("src", "app://plugins/mpvplayer.js");
    document.head.appendChild(script);
}

function dispatchIfLoaded() {
    if (document.readyState === "complete") {
        onDomLoaded();
    } else {
        setTimeout(dispatchIfLoaded, 100);
    }
}

setTimeout(dispatchIfLoaded, 100);

const theaterApi = wrap<TheaterApi>(mainProcObjectEndpoint(ipcRenderer));
window["theaterApi"] = theaterApi;
theaterApi
    .conntest()
    .then(() => console.info("Communication main <- renderer established"));

self["NativeShell"] = new NativeShell(theaterApi);
