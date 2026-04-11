import { create } from "zustand";

interface AppState {
    orgUrl: string | null;
    pat: string | null;
    setAzDoCredentials: (orgUrl: string, pat: string) => void;
}

export const useAppStore = create<AppState>()((set) => ({
    orgUrl: null,
    pat: null,
    setAzDoCredentials: (orgUrl, pat) => set({ orgUrl, pat }),
}));
