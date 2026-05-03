import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EyeIcon } from "../Shared/EyeIcon";
import { SpinnerIcon } from "../Shared/SpinnerIcon";
import { useAppStore } from "../../store/appStore";
import type { ImportedConfigFile, ImportedConnection } from "../../../shared/electronAPI";

interface PendingImportState {
    imported: ImportedConfigFile;
    connectionsRequiringPat: ImportedConnection[];
}

interface PatPromptDialogProps {
    pendingImport: PendingImportState;
    loading: boolean;
    onConfirm: (newConnectionPatsByOrgUrl: Record<string, string>) => void;
    onCancel: () => void;
}

function PatPromptDialog({ pendingImport, loading, onConfirm, onCancel }: PatPromptDialogProps) {
    const [patsByOrgUrl, setPatsByOrgUrl] = useState<Record<string, string>>({});
    const [visibleOrgUrls, setVisibleOrgUrls] = useState<Record<string, boolean>>({});
    const [errorsByOrgUrl, setErrorsByOrgUrl] = useState<Record<string, string>>({});

    function handleConfirm() {
        const nextErrors: Record<string, string> = {};
        for (const connection of pendingImport.connectionsRequiringPat) {
            if (!patsByOrgUrl[connection.orgUrl]?.trim()) {
                nextErrors[connection.orgUrl] = "Personal Access Token is required.";
            }
        }

        setErrorsByOrgUrl(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        onConfirm(patsByOrgUrl);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900 mx-4">
                <h3 className="text-base font-semibold mb-2">Complete import</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Enter a PAT for each imported connection that does not already exist locally.
                </p>
                <div className="space-y-4">
                    {pendingImport.connectionsRequiringPat.map((connection) => {
                        const isVisible = visibleOrgUrls[connection.orgUrl] ?? false;
                        return (
                            <div key={connection.orgUrl} className="space-y-1">
                                <div className="text-sm font-medium">{connection.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{connection.orgUrl}</div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type={isVisible ? "text" : "password"}
                                        value={patsByOrgUrl[connection.orgUrl] ?? ""}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setPatsByOrgUrl((current) => ({ ...current, [connection.orgUrl]: value }));
                                            setErrorsByOrgUrl((current) => ({ ...current, [connection.orgUrl]: "" }));
                                        }}
                                        placeholder="Paste PAT"
                                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setVisibleOrgUrls((current) => ({ ...current, [connection.orgUrl]: !isVisible }))}
                                        className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                                        aria-label={isVisible ? "Hide PAT" : "Show PAT"}
                                        disabled={loading}
                                    >
                                        <EyeIcon visible={isVisible} />
                                    </button>
                                </div>
                                {errorsByOrgUrl[connection.orgUrl] && (
                                    <p className="text-sm text-red-600 dark:text-red-400">{errorsByOrgUrl[connection.orgUrl]}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                        disabled={loading}
                    >
                        {loading && <SpinnerIcon />}
                        Import
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ClearConfigDialogProps {
    loading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

function ClearConfigDialog({ loading, onConfirm, onCancel }: ClearConfigDialogProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900 mx-4">
                <h3 className="text-base font-semibold mb-2">Clear configuration</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    This removes connections, selected boards, and combined board configuration. Theme and window layout are preserved.
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                        disabled={loading}
                    >
                        {loading && <SpinnerIcon />}
                        Clear configuration
                    </button>
                </div>
            </div>
        </div>
    );
}

export function SystemSection() {
    const setConnections = useAppStore((state) => state.setConnections);
    const setSelectedBoards = useAppStore((state) => state.setSelectedBoards);
    const setBoardColumns = useAppStore((state) => state.setBoardColumns);
    const setCombinedBoardColumns = useAppStore((state) => state.setCombinedBoardColumns);
    const setWorkItems = useAppStore((state) => state.setWorkItems);

    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [pendingImport, setPendingImport] = useState<PendingImportState | null>(null);
    const [confirmingClear, setConfirmingClear] = useState(false);

    const hasPendingPatPrompt = useMemo(
        () => pendingImport !== null && pendingImport.connectionsRequiringPat.length > 0,
        [pendingImport]
    );

    async function refreshState() {
        const [{ connections, selectedBoards }, combinedBoardColumns, boardColumnsResult] = await Promise.all([
            window.electron.loadSettings(),
            window.electron.loadCombinedBoardColumns(),
            window.electron.getBoardColumnsForSelected(),
        ]);

        setConnections(connections);
        setSelectedBoards(selectedBoards);
        setCombinedBoardColumns(combinedBoardColumns);
        setBoardColumns(boardColumnsResult.columns ?? []);
        setWorkItems([]);
    }

    async function handleExport() {
        setIsExporting(true);
        try {
            const result = await window.electron.system.exportConfig();
            if (result.canceled) {
                return;
            }
            if (!result.success) {
                toast.error(result.error ?? "Could not export configuration to the selected location.");
                return;
            }
            toast.success("Configuration exported.");
        } finally {
            setIsExporting(false);
        }
    }

    async function handleImportClick() {
        setIsImporting(true);
        try {
            const result = await window.electron.system.selectImportFile();
            if (result.canceled) {
                return;
            }
            if (!result.success || !result.imported) {
                toast.error(result.error ?? "Could not read the selected configuration file.");
                return;
            }
            if ((result.connectionsRequiringPat ?? []).length > 0) {
                setPendingImport({
                    imported: result.imported,
                    connectionsRequiringPat: result.connectionsRequiringPat ?? [],
                });
                return;
            }

            const applyResult = await window.electron.system.applyImportedConfig({
                imported: result.imported,
                newConnectionPatsByOrgUrl: {},
            });

            if (!applyResult.success) {
                toast.error(applyResult.error ?? "Import failed.");
                return;
            }

            await refreshState();
            toast.success("Configuration imported.");
        } finally {
            setIsImporting(false);
        }
    }

    async function handleConfirmImport(newConnectionPatsByOrgUrl: Record<string, string>) {
        if (!pendingImport) {
            return;
        }

        setIsImporting(true);
        try {
            const result = await window.electron.system.applyImportedConfig({
                imported: pendingImport.imported,
                newConnectionPatsByOrgUrl,
            });
            if (!result.success) {
                toast.error(result.error ?? "Import failed.");
                return;
            }

            setPendingImport(null);
            await refreshState();
            toast.success("Configuration imported.");
        } finally {
            setIsImporting(false);
        }
    }

    async function handleConfirmClear() {
        setIsClearing(true);
        try {
            await window.electron.system.clearConfig();
            setConfirmingClear(false);
            await refreshState();
            toast.success("Configuration cleared.");
        } finally {
            setIsClearing(false);
        }
    }

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h2 className="text-xl font-semibold">System</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Import, export, or clear Lizzie configuration. Exported files never include PATs.
                </p>
            </div>

            <section className="space-y-4 rounded-md border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                <div>
                    <h3 className="text-sm font-semibold">Export configuration</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Save connections, selected boards, and combined board mappings to a shareable JSON file.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting || isImporting || isClearing}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isExporting && <SpinnerIcon />}
                    Export configuration
                </button>
            </section>

            <section className="space-y-4 rounded-md border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                <div>
                    <h3 className="text-sm font-semibold">Import configuration</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Merge a previously exported Lizzie configuration into the current setup. New connections require a PAT.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleImportClick}
                    disabled={isExporting || isImporting || isClearing}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isImporting && <SpinnerIcon />}
                    Import configuration
                </button>
            </section>

            <section className="space-y-4 rounded-md border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
                <div>
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Clear configuration</h3>
                    <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">
                        Remove connections, selected boards, and combined board configuration while keeping theme and window layout.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setConfirmingClear(true)}
                    disabled={isExporting || isImporting || isClearing}
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Clear configuration
                </button>
            </section>

            {hasPendingPatPrompt && pendingImport && (
                <PatPromptDialog
                    pendingImport={pendingImport}
                    loading={isImporting}
                    onConfirm={handleConfirmImport}
                    onCancel={() => setPendingImport(null)}
                />
            )}

            {confirmingClear && (
                <ClearConfigDialog
                    loading={isClearing}
                    onConfirm={handleConfirmClear}
                    onCancel={() => setConfirmingClear(false)}
                />
            )}
        </div>
    );
}