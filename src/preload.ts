import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI } from "./shared/electronAPI";

const api: ElectronAPI = {
    platform: process.platform,
    minimise: () => ipcRenderer.send("window:minimise"),
    maximise: () => ipcRenderer.send("window:maximise"),
    close: () => ipcRenderer.send("window:close"),
};

contextBridge.exposeInMainWorld("electron", api);
