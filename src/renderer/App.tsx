import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { TitleBar } from "./components/TitleBar/TitleBar";
import { useAppStore } from "./store/appStore";

export function App() {
    const selectedBoards = useAppStore((s) => s.selectedBoards);
    const setAzDoCredentials = useAppStore((s) => s.setAzDoCredentials);
    const setSelectedBoards = useAppStore((s) => s.setSelectedBoards);
    const setBoardColumns = useAppStore((s) => s.setBoardColumns);
    const setCombinedBoardColumns = useAppStore((s) => s.setCombinedBoardColumns);

    // Seed the store from persisted config on startup
    useEffect(() => {
        window.electron.loadSettings().then(({ orgUrl, pat, selectedBoards: boards }) => {
            if (orgUrl && pat) {
                setAzDoCredentials(orgUrl, pat);
            }
            setSelectedBoards(boards);
        });
        window.electron.loadCombinedBoardColumns().then(setCombinedBoardColumns);
    }, [setAzDoCredentials, setSelectedBoards, setCombinedBoardColumns]);

    useEffect(() => {
        window.electron.getBoardColumnsForSelected().then((result) => {
            if (result.columns) {
                setBoardColumns(result.columns);
            }
        });
    }, [selectedBoards, setBoardColumns]);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-neutral-900">
            <TitleBar />
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
