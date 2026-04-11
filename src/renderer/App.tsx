import { Outlet } from "react-router-dom";
import { TitleBar } from "./components/TitleBar/TitleBar";

export function App() {
    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-neutral-900">
            <TitleBar />
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
