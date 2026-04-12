import { NavLink } from "react-router-dom";
import { LayoutDashboard, RefreshCw, Settings } from "lucide-react";

interface NavItem {
    to: string;
    label: string;
    Icon: React.ComponentType<{ size?: number }>;
}

const topItems: NavItem[] = [
    { to: "/board", label: "Combined Board", Icon: LayoutDashboard },
    { to: "/sync", label: "Local Sync", Icon: RefreshCw },
];

const bottomItems: NavItem[] = [
    { to: "/settings", label: "Settings", Icon: Settings },
];

function SidebarNavItem({ to, label, Icon }: NavItem) {
    return (
        <div className="relative group">
            <NavLink
                to={to}
                className={({ isActive }) => [
                    "flex items-center justify-center w-10 h-10 rounded-md transition-colors",
                    isActive
                        ? "bg-[var(--color-active)] text-[var(--color-text)]"
                        : "text-[var(--color-text)]/50 hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-text)]",
                ].join(" ")}
            >
                <Icon size={20} />
            </NavLink>
            <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] shadow-sm z-50">
                {label}
            </span>
        </div>
    );
}

export function Sidebar() {
    return (
        <nav className="flex flex-col h-full w-14 shrink-0 border-r border-[var(--color-border)] [-webkit-app-region:no-drag] py-2 px-2">
            <div className="flex flex-col gap-1">
                {topItems.map((item) => (
                    <SidebarNavItem key={item.to} {...item} />
                ))}
            </div>

            <div className="flex-1" />

            <div className="flex flex-col gap-1">
                {bottomItems.map((item) => (
                    <SidebarNavItem key={item.to} {...item} />
                ))}
            </div>
        </nav>
    );
}
