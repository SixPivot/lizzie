import { WindowControls } from "./WindowControls";

const isMac = window.electron.platform === "darwin";

export function TitleBar() {
    return (
        <div className="flex items-stretch h-10 bg-[var(--color-bg)] border-b border-[var(--color-border)] select-none [-webkit-app-region:drag] shrink-0">
            {/* macOS traffic-light inset spacer */}
            {isMac && <div className="w-20 shrink-0" />}

            {/* Spacer — fills drag area */}
            <div className="flex-1" />

            {/* Window controls (Windows / Linux only) */}
            {!isMac && <WindowControls />}
        </div>
    );
}
