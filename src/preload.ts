import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI } from "./shared/electronAPI";

const api: ElectronAPI = {
    platform: process.platform,
    minimise: () => ipcRenderer.send("window:minimise"),
    maximise: () => ipcRenderer.send("window:maximise"),
    close: () => ipcRenderer.send("window:close"),
    loadSettings: () => ipcRenderer.invoke("settings:load"),
    connections: {
        load: () => ipcRenderer.invoke("connections:load"),
        add: (args) => ipcRenderer.invoke("connections:add", args),
        remove: (args) => ipcRenderer.invoke("connections:remove", args),
        retest: (args) => ipcRenderer.invoke("connections:retest", args),
    },
    getAvailableBoards: (args) => ipcRenderer.invoke("boards:getAvailable", args),
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