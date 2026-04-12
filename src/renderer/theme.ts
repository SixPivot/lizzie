import type { ThemePreference } from "../shared/electronAPI";

export function applyTheme(theme: ThemePreference): void {
    let resolved: "dark" | "light";
    if (theme === "auto") {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
        resolved = theme;
    }
    document.documentElement.classList.toggle("dark", resolved === "dark");
    localStorage.setItem("app-theme-resolved", resolved);
}
