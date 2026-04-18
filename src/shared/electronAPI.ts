export interface ConnectionSummary {
    id: string;
    name: string;
    orgUrl: string;
}

export interface SelectedBoard {
    connectionId: string;
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
    connectionId: string;
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
    connectionId: string;
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

export interface WorkItemCard {
    id: number;
    connectionId: string;
    boardId: string;
    columnName: string;
    boardOrder: number;
    teamName: string;
    projectName: string;
    orgUrl: string;
    fields: Record<string, unknown>;
}

export type ThemePreference = "light" | "dark" | "auto";

export interface ElectronAPI {
    platform: NodeJS.Platform;
    minimise: () => void;
    maximise: () => void;
    close: () => void;
    loadSettings: () => Promise<{ connections: ConnectionSummary[]; selectedBoards: SelectedBoard[] }>;
    connections: {
        load: () => Promise<ConnectionSummary[]>;
        add: (args: { name: string; orgUrl: string; pat: string }) => Promise<{ success: boolean; connection?: ConnectionSummary; error?: string; errorField?: "pat" | "orgUrl" | "name" }>;
        remove: (args: { connectionId: string }) => Promise<{ success: boolean }>;
        retest: (args: { connectionId: string }) => Promise<{ success: boolean; error?: string }>;
    };
    getAvailableBoards: (args: { connectionId: string }) => Promise<{ boards?: AvailableBoard[]; error?: string }>;
    saveSelectedBoards: (boards: SelectedBoard[]) => Promise<void>;
    getBoardColumnsForSelected: () => Promise<{ columns?: BoardColumnInfo[]; error?: string }>;
    loadCombinedBoardColumns: () => Promise<CombinedBoardColumn[]>;
    saveCombinedBoardColumns: (columns: CombinedBoardColumn[]) => Promise<void>;
    getWorkItems: () => Promise<{ cards?: WorkItemCard[]; failedConnections?: string[]; error?: string }>;
    openExternal: (url: string) => void;
    loadTheme: () => Promise<ThemePreference>;
    saveTheme: (theme: ThemePreference) => Promise<void>;
}