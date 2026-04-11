export interface ElectronAPI {
    platform: NodeJS.Platform;
    minimise: () => void;
    maximise: () => void;
    close: () => void;
}
