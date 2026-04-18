import { create } from "zustand";
import type { ConnectionSummary, SelectedBoard, BoardColumnInfo, CombinedBoardColumn, ThemePreference, WorkItemCard } from "../../shared/electronAPI";

interface AppState {
    connections: ConnectionSummary[];
    selectedBoards: SelectedBoard[];
    boardColumns: BoardColumnInfo[];
    combinedBoardColumns: CombinedBoardColumn[];
    workItems: WorkItemCard[];
    theme: ThemePreference;
    setConnections: (connections: ConnectionSummary[]) => void;
    addConnection: (connection: ConnectionSummary) => void;
    removeConnection: (connectionId: string) => void;
    setSelectedBoards: (boards: SelectedBoard[]) => void;
    setBoardColumns: (columns: BoardColumnInfo[]) => void;
    setCombinedBoardColumns: (columns: CombinedBoardColumn[]) => void;
    setWorkItems: (cards: WorkItemCard[]) => void;
    setTheme: (theme: ThemePreference) => void;
}

export const useAppStore = create<AppState>()((set) => ({
    connections: [],
    selectedBoards: [],
    boardColumns: [],
    combinedBoardColumns: [],
    workItems: [],
    theme: "auto",
    setConnections: (connections) => set({ connections }),
    addConnection: (connection) => set((s) => ({ connections: [...s.connections, connection] })),
    removeConnection: (connectionId) => set((s) => ({ connections: s.connections.filter((c) => c.id !== connectionId) })),
    setSelectedBoards: (boards) => set({ selectedBoards: boards }),
    setBoardColumns: (columns) => set({ boardColumns: columns }),
    setCombinedBoardColumns: (columns) => set({ combinedBoardColumns: columns }),
    setWorkItems: (cards) => set({ workItems: cards }),
    setTheme: (theme) => set({ theme }),
}));
