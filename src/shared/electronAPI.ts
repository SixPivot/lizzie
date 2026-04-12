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

export interface BoardColumnInfo {
    boardId: string;
    boardName: string;
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    columnId: string;
    columnName: string;
}

export interface CombinedBoardColumnMapping {
    boardId: string;
    boardName: string;
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    columnId: string;
    columnName: string;
}

export interface CombinedBoardColumn {
    id: string;
    name: string;
    sourceMappings: CombinedBoardColumnMapping[];
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
    getBoardColumnsForSelected: () => Promise<{ columns?: BoardColumnInfo[]; error?: string }>;
    loadCombinedBoardColumns: () => Promise<CombinedBoardColumn[]>;
    saveCombinedBoardColumns: (columns: CombinedBoardColumn[]) => Promise<void>;
}