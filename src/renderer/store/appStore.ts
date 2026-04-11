import { create } from "zustand";

// Thin store shell — establishes the Zustand pattern for future features.
interface AppState {
    // placeholder for future state
}

export const useAppStore = create<AppState>()(() => ({}));
