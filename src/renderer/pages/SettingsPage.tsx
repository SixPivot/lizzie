import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConnectionSection } from "../components/Settings/ConnectionSection";
import { BoardsSection } from "../components/Settings/BoardsSection";
import { CombinedBoardSection } from "../components/Settings/CombinedBoardSection";
import { AppearanceSection } from "../components/Settings/AppearanceSection";
import { SystemSection } from "../components/Settings/SystemSection";

type SettingsSection = "appearance" | "connection" | "boards" | "combined-board" | "system";

const sections: { id: SettingsSection; label: string }[] = [
    { id: "appearance", label: "Appearance" },
    { id: "connection", label: "Connection" },
    { id: "boards", label: "Remote Boards" },
    { id: "combined-board", label: "Combined Board" },
    { id: "system", label: "System" },
];

export function SettingsPage() {
    const [searchParams] = useSearchParams();
    const initialSection = (searchParams.get("section") as SettingsSection | null) ?? "appearance";
    const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <nav className="w-52 shrink-0 border-r border-[var(--color-border)] p-4">
                <h1 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text)]/50">
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
                                        ? "bg-[var(--color-active)] text-[var(--color-text)]"
                                        : "text-[var(--color-text)]/70 hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]"
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
                {activeSection === "appearance" && (
                    <div className="flex-1 overflow-auto p-8">
                        <AppearanceSection />
                    </div>
                )}
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
                {activeSection === "system" && (
                    <div className="flex-1 overflow-auto p-8">
                        <SystemSection />
                    </div>
                )}
            </main>
        </div>
    );
}



