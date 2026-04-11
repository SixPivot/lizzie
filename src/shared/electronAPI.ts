export interface ElectronAPI {
    platform: NodeJS.Platform;
    minimise: () => void;
    maximise: () => void;
    close: () => void;
    loadSettings: () => Promise<{ orgUrl: string | null; pat: string | null }>;
    saveAndTestSettings: (args: { orgUrl: string; pat: string }) => Promise<{ success: boolean; error?: string; errorField?: "pat" | "orgUrl" }>;
}