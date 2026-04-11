import { NavLink } from "react-router-dom";
import { WindowControls } from "./WindowControls";

const isMac = window.electron.platform === "darwin";

const navItems = [
    { to: "/board", label: "Combined Board" },
    { to: "/sync", label: "Local Sync" },
    { to: "/settings", label: "Settings" },
];

export function TitleBar() {
    return (
        <div className="flex items-stretch h-10 bg-neutral-900 select-none [-webkit-app-region:drag] shrink-0">
            {/* macOS traffic-light inset spacer */}
            {isMac && <div className="w-20 shrink-0" />}

            {/* Navigation tabs */}
            <div className="flex items-stretch [-webkit-app-region:no-drag]">
                {navItems.map(({ to, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => [
                            "flex items-center px-4 text-sm font-medium transition-colors",
                            isActive
                                ? "text-white bg-white/10"
                                : "text-gray-400 hover:text-white hover:bg-white/5",
                        ].join(" ")}
                    >
                        {label}
                    </NavLink>
                ))}
            </div>

            {/* Spacer — fills remaining drag area */}
            <div className="flex-1" />

            {/* Window controls (Windows / Linux only) */}
            {!isMac && <WindowControls />}
        </div>
    );
}
