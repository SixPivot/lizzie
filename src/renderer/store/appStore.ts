import { create } from "zustand";
import type { SelectedBoard, BoardColumnInfo, CombinedBoardColumn } from "../../shared/electronAPI";

interface AppState {
    orgUrl: string | null;
    pat: string | null;
    selectedBoards: SelectedBoard[];
    boardColumns: BoardColumnInfo[];
    combinedBoardColumns: CombinedBoardColumn[];
    setAzDoCredentials: (orgUrl: string, pat: string) => void;
    setSelectedBoards: (boards: SelectedBoard[]) => void;
    setBoardColumns: (columns: BoardColumnInfo[]) => void;
    setCombinedBoardColumns: (columns: CombinedBoardColumn[]) => void;
}

export const useAppStore = create<AppState>()((set) => ({
    orgUrl: null,
    pat: null,
    selectedBoards: [],
    boardColumns: [],
    combinedBoardColumns: [],
    setAzDoCredentials: (orgUrl, pat) => set({ orgUrl, pat }),
    setSelectedBoards: (boards) => set({ selectedBoards: boards }),
    setBoardColumns: (columns) => set({ boardColumns: columns }),
    setCombinedBoardColumns: (columns) => set({ combinedBoardColumns: columns }),
}));
