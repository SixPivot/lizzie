import type { ThemePreference } from "../../../shared/electronAPI";
import { useAppStore } from "../../store/appStore";
import { applyTheme } from "../../theme";

// Exact colour values matching the CSS custom properties in index.css
const themeColours: Record<ThemePreference, { bg: string; sidebar: string; titleBar: string }> = {
    light: {
        bg: "hsl(214, 45%, 96%)",
        sidebar: "hsl(214, 40%, 92%)",
        titleBar: "hsl(214, 40%, 92%)",
    },
    dark: {
        bg: "hsl(214, 25%, 11%)",
        sidebar: "hsl(214, 25%, 14%)",
        titleBar: "hsl(214, 25%, 14%)",
    },
    auto: {
        bg: "hsl(214, 45%, 96%)",
        sidebar: "hsl(214, 40%, 92%)",
        titleBar: "hsl(214, 40%, 92%)",
    },
};

interface ThemeCardProps {
    value: ThemePreference;
    label: string;
    selected: boolean;
    onSelect: () => void;
}

function ThemeCard({ value, label, selected, onSelect }: ThemeCardProps) {
    const colours = themeColours[value];

    // For "auto", show a split light/dark preview
    const isAuto = value === "auto";
    const darkColours = themeColours.dark;

    return (
        <button
            type="button"
            onClick={onSelect}
            className={[
                "flex flex-col items-center gap-2 p-1 rounded-lg transition-all cursor-pointer",
                selected
                    ? "ring-2 ring-blue-500"
                    : "ring-1 ring-[var(--color-border)] hover:ring-[var(--color-text)]/20",
            ].join(" ")}
        >
            {/* Mini UI mock */}
            <div
                className="w-32 h-20 rounded overflow-hidden flex flex-col"
                style={{ backgroundColor: colours.bg }}
            >
                {/* Title bar strip */}
                <div
                    className="h-3 shrink-0"
                    style={{
                        background: isAuto
                            ? `linear-gradient(to right, ${colours.titleBar} 50%, ${darkColours.titleBar} 50%)`
                            : colours.titleBar,
                    }}
                />
                {/* Body row */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar strip */}
                    <div
                        className="w-5 shrink-0"
                        style={{
                            background: isAuto
                                ? `linear-gradient(to right, ${colours.sidebar} 50%, ${darkColours.sidebar} 50%)`
                                : colours.sidebar,
                        }}
                    />
                    {/* Content area */}
                    <div
                        className="flex-1"
                        style={{
                            background: isAuto
                                ? `linear-gradient(to right, ${colours.bg} 50%, ${darkColours.bg} 50%)`
                                : colours.bg,
                        }}
                    />
                </div>
            </div>
            <span className="text-xs font-medium text-[var(--color-text)]">{label}</span>
        </button>
    );
}

const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "auto", label: "Auto" },
];

export function AppearanceSection() {
    const theme = useAppStore((s) => s.theme);
    const setTheme = useAppStore((s) => s.setTheme);

    function handleSelect(value: ThemePreference) {
        window.electron.saveTheme(value);
        setTheme(value);
        applyTheme(value);
    }

    return (
        <div>
            <h2 className="text-base font-semibold text-[var(--color-text)] mb-1">Theme</h2>
            <p className="text-sm text-[var(--color-text)]/60 mb-4">
                Choose how the application looks. Auto follows your OS setting.
            </p>
            <div className="flex flex-row gap-4">
                {themeOptions.map(({ value, label }) => (
                    <ThemeCard
                        key={value}
                        value={value}
                        label={label}
                        selected={theme === value}
                        onSelect={() => handleSelect(value)}
                    />
                ))}
            </div>
        </div>
    );
}
