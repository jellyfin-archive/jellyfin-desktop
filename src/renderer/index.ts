import { expose } from "comlink";
import { rendererProcObjectEndpoint } from "comlink-electron-adapter";
import { ipcRenderer } from "electron";
import { join } from "path";

import { RendererApi } from "../api/renderer";

const endpoint = rendererProcObjectEndpoint(ipcRenderer);

const rendererApi = new RendererApi();

expose(rendererApi, endpoint);

function onDomLoaded() {
    console.info("Inserted custom styles");
    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute(
        "href",
        `file://${join(__dirname, "../../assets/theater.css")}`
    );
    document.head.appendChild(link);
}

function dispatchIfLoaded() {
    if (document.readyState === "complete") {
        onDomLoaded();
    } else {
        setTimeout(dispatchIfLoaded, 100);
    }
}

setTimeout(dispatchIfLoaded, 100);
