import { useState } from "react";
import { ConnectionSection } from "../components/Settings/ConnectionSection";
import { BoardsSection } from "../components/Settings/BoardsSection";
import { CombinedBoardSection } from "../components/Settings/CombinedBoardSection";

type SettingsSection = "connection" | "boards" | "combined-board";

const sections: { id: SettingsSection; label: string }[] = [
    { id: "connection", label: "Connection" },
    { id: "boards", label: "Remote Boards" },
    { id: "combined-board", label: "Combined Board" },
];

export function SettingsPage() {
    const [activeSection, setActiveSection] = useState<SettingsSection>("connection");

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <nav className="w-52 shrink-0 border-r border-gray-200 dark:border-gray-700 p-4">
                <h1 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Settings
                </h1>
                <ul className="space-y-1">
                    {sections.map((section) => (
                        <li key={section.id}>
                            <button
                                type="button"
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                                    activeSection === section.id
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                }`}
                            >
                                {section.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Content area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {activeSection === "connection" && (
                    <div className="flex-1 overflow-auto p-8">
                        <ConnectionSection />
                    </div>
                )}
                {activeSection === "boards" && (
                    <div className="flex-1 overflow-auto p-8">
                        <BoardsSection />
                    </div>
                )}
                {activeSection === "combined-board" && <CombinedBoardSection />}
            </main>
        </div>
    );
}

