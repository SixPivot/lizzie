import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { useAppStore } from "./store/appStore";
import { applyTheme } from "./theme";

export function App() {
    const selectedBoards = useAppStore((s) => s.selectedBoards);
    const setAzDoCredentials = useAppStore((s) => s.setAzDoCredentials);
    const setSelectedBoards = useAppStore((s) => s.setSelectedBoards);
    const setBoardColumns = useAppStore((s) => s.setBoardColumns);
    const setCombinedBoardColumns = useAppStore((s) => s.setCombinedBoardColumns);
    const theme = useAppStore((s) => s.theme);
    const setTheme = useAppStore((s) => s.setTheme);

    // Seed the store from persisted config on startup
    useEffect(() => {
        window.electron.loadSettings().then(({ orgUrl, pat, selectedBoards: boards }) => {
            if (orgUrl && pat) {
                setAzDoCredentials(orgUrl, pat);
            }
            setSelectedBoards(boards);
        });
        window.electron.loadCombinedBoardColumns().then(setCombinedBoardColumns);
        window.electron.loadTheme().then((savedTheme) => {
            setTheme(savedTheme);
            applyTheme(savedTheme);
        });
    }, [setAzDoCredentials, setSelectedBoards, setCombinedBoardColumns, setTheme]);

    useEffect(() => {
        window.electron.getBoardColumnsForSelected().then((result) => {
            if (result.columns) {
                setBoardColumns(result.columns);
            }
        });
    }, [selectedBoards, setBoardColumns]);

    // When theme is "auto", listen for OS preference changes and re-apply
    useEffect(() => {
        if (theme !== "auto") return;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => applyTheme("auto");
        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, [theme]);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
            <TitleBar />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

