import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI } from "./shared/electronAPI";

const api: ElectronAPI = {
    platform: process.platform,
    minimise: () => ipcRenderer.send("window:minimise"),
    maximise: () => ipcRenderer.send("window:maximise"),
    close: () => ipcRenderer.send("window:close"),
    loadSettings: () => ipcRenderer.invoke("settings:load"),
    saveAndTestSettings: (args) => ipcRenderer.invoke("settings:saveAndTest", args),
    getAvailableBoards: () => ipcRenderer.invoke("boards:getAvailable"),
    saveSelectedBoards: (boards) => ipcRenderer.invoke("boards:saveSelected", boards),
    getBoardColumnsForSelected: () => ipcRenderer.invoke("boards:getBoardColumnsForSelected"),
    loadCombinedBoardColumns: () => ipcRenderer.invoke("combinedBoard:loadColumns"),
    saveCombinedBoardColumns: (columns) => ipcRenderer.invoke("combinedBoard:saveColumns", columns),
    getWorkItems: () => ipcRenderer.invoke("combinedBoard:getWorkItems"),
    openExternal: (url) => ipcRenderer.send("shell:openExternal", url),
    loadTheme: () => ipcRenderer.invoke("theme:load"),
    saveTheme: (theme) => ipcRenderer.invoke("theme:save", theme),
};

contextBridge.exposeInMainWorld("electron", api);