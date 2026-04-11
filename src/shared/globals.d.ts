import type { ElectronAPI } from "./electronAPI";

declare global {
    interface Window {
        electron: ElectronAPI;
    }
}
