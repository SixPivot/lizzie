import { create } from "zustand";

// Thin store shell — establishes the Zustand pattern for future features.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AppState {}

export const useAppStore = create<AppState>()(() => ({}));
