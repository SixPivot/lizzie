interface WindowControlButtonProps {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
}

function WindowControlButton({ label, onClick, children, danger = false }: WindowControlButtonProps) {
    return (
        <button
            aria-label={label}
            onClick={onClick}
            className={[
                "flex items-center justify-center w-11 h-full",
                "text-[var(--color-text)]/60 hover:text-[var(--color-text)] transition-colors",
                "[-webkit-app-region:no-drag]",
                danger ? "hover:bg-red-600 hover:text-white" : "hover:bg-[var(--color-active)]",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

export function WindowControls() {
    return (
        <div className="flex h-full">
            <WindowControlButton
                label="Minimise"
                onClick={() => window.electron.minimise()}
            >
                <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
                    <rect width="10" height="1" />
                </svg>
            </WindowControlButton>

            <WindowControlButton
                label="Maximise"
                onClick={() => window.electron.maximise()}
            >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="0.5" y="0.5" width="9" height="9" />
                </svg>
            </WindowControlButton>

            <WindowControlButton
                label="Close"
                onClick={() => window.electron.close()}
                danger
            >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            </WindowControlButton>
        </div>
    );
}
