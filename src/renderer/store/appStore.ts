import { create } from "zustand";
import type { SelectedBoard } from "../../shared/electronAPI";

interface AppState {
    orgUrl: string | null;
    pat: string | null;
    selectedBoards: SelectedBoard[];
    setAzDoCredentials: (orgUrl: string, pat: string) => void;
    setSelectedBoards: (boards: SelectedBoard[]) => void;
}

export const useAppStore = create<AppState>()((set) => ({
    orgUrl: null,
    pat: null,
    selectedBoards: [],
    setAzDoCredentials: (orgUrl, pat) => set({ orgUrl, pat }),
    setSelectedBoards: (boards) => set({ selectedBoards: boards }),
}));
