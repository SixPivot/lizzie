// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyTheme } from "./theme";

// We directly test the exported applyTheme function.
// It touches document.documentElement and localStorage — both available in vitest's default jsdom-like globals.

describe("applyTheme", () => {
    beforeEach(() => {
        document.documentElement.classList.remove("dark");
        localStorage.clear();
    });

    it("adds .dark when theme is 'dark'", () => {
        applyTheme("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes .dark when theme is 'light'", () => {
        document.documentElement.classList.add("dark");
        applyTheme("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("writes 'dark' to localStorage when theme is 'dark'", () => {
        applyTheme("dark");
        expect(localStorage.getItem("app-theme-resolved")).toBe("dark");
    });

    it("writes 'light' to localStorage when theme is 'light'", () => {
        applyTheme("light");
        expect(localStorage.getItem("app-theme-resolved")).toBe("light");
    });

    it("resolves 'auto' to dark when OS prefers dark", () => {
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: query === "(prefers-color-scheme: dark)",
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        applyTheme("auto");

        expect(document.documentElement.classList.contains("dark")).toBe(true);
        expect(localStorage.getItem("app-theme-resolved")).toBe("dark");

        vi.unstubAllGlobals();
    });

    it("resolves 'auto' to light when OS prefers light", () => {
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        applyTheme("auto");

        expect(document.documentElement.classList.contains("dark")).toBe(false);
        expect(localStorage.getItem("app-theme-resolved")).toBe("light");

        vi.unstubAllGlobals();
    });
});
