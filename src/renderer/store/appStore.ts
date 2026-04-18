import { create } from "zustand";
import type { SelectedBoard, BoardColumnInfo, CombinedBoardColumn, ThemePreference, WorkItemCard } from "../../shared/electronAPI";

interface AppState {
    orgUrl: string | null;
    pat: string | null;
    selectedBoards: SelectedBoard[];
    boardColumns: BoardColumnInfo[];
    combinedBoardColumns: CombinedBoardColumn[];
    workItems: WorkItemCard[];
    theme: ThemePreference;
    setAzDoCredentials: (orgUrl: string, pat: string) => void;
    setSelectedBoards: (boards: SelectedBoard[]) => void;
    setBoardColumns: (columns: BoardColumnInfo[]) => void;
    setCombinedBoardColumns: (columns: CombinedBoardColumn[]) => void;
    setWorkItems: (cards: WorkItemCard[]) => void;
    setTheme: (theme: ThemePreference) => void;
}

export const useAppStore = create<AppState>()((set) => ({
    orgUrl: null,
    pat: null,
    selectedBoards: [],
    boardColumns: [],
    combinedBoardColumns: [],
    workItems: [],
    theme: "auto",
    setAzDoCredentials: (orgUrl, pat) => set({ orgUrl, pat }),
    setSelectedBoards: (boards) => set({ selectedBoards: boards }),
    setBoardColumns: (columns) => set({ boardColumns: columns }),
    setCombinedBoardColumns: (columns) => set({ combinedBoardColumns: columns }),
    setWorkItems: (cards) => set({ workItems: cards }),
    setTheme: (theme) => set({ theme }),
}));
