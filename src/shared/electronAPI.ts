export interface SelectedBoard {
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    boardId: string;
    boardName: string;
}

export interface AvailableBoard {
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    boardId: string;
    boardName: string;
}

export interface ElectronAPI {
    platform: NodeJS.Platform;
    minimise: () => void;
    maximise: () => void;
    close: () => void;
    loadSettings: () => Promise<{ orgUrl: string | null; pat: string | null; selectedBoards: SelectedBoard[] }>;
    saveAndTestSettings: (args: { orgUrl: string; pat: string }) => Promise<{ success: boolean; error?: string; errorField?: "pat" | "orgUrl" }>;
    getAvailableBoards: () => Promise<{ boards?: AvailableBoard[]; error?: string }>;
    saveSelectedBoards: (boards: SelectedBoard[]) => Promise<void>;
}