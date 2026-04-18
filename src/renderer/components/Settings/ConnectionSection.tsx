import { toast } from "sonner";
import { EyeIcon } from "../Shared/EyeIcon";
import { SpinnerIcon } from "../Shared/SpinnerIcon";
import { useEffect, useState } from "react";
import { useAppStore } from "../../store/appStore";
import type { ConnectionSummary } from "../../../shared/electronAPI";

// ---------------------------------------------------------------------------
// Connection row (list item)
// ---------------------------------------------------------------------------

type RowStatus = "idle" | "testing" | "healthy" | "failed";

interface ConnectionRowProps {
    connection: ConnectionSummary;
    selectedBoardCount: number;
    mappingCount: number;
    onRemove: (connectionId: string) => void;
}

function ConnectionRow({ connection, selectedBoardCount, mappingCount, onRemove }: ConnectionRowProps) {
    const [rowStatus, setRowStatus] = useState<RowStatus>("idle");
    const [pendingRemove, setPendingRemove] = useState(false);

    async function handleRetest() {
        setRowStatus("testing");
        const result = await window.electron.connections.retest({ connectionId: connection.id });
        if (result.success) {
            setRowStatus("healthy");
            toast.success(`Connected to ${connection.name} successfully.`);
        } else {
            setRowStatus("failed");
            toast.error(`Could not connect to ${connection.name}: ${result.error ?? "unknown error"}`);
        }
    }

    function handleRemoveClick() {
        setPendingRemove(true);
    }

    return (
        <>
            <div className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3 text-sm bg-white dark:bg-gray-900">
                <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{connection.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{connection.orgUrl}</div>
                </div>

                {rowStatus === "healthy" && (
                    <span className="shrink-0 h-2 w-2 rounded-full bg-green-500" title="Connected" aria-label="Connected" />
                )}
                {rowStatus === "failed" && (
                    <span className="shrink-0 h-2 w-2 rounded-full bg-red-500" title="Connection failed" aria-label="Connection failed" />
                )}

                <button
                    type="button"
                    onClick={handleRetest}
                    disabled={rowStatus === "testing"}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
                >
                    {rowStatus === "testing" && <SpinnerIcon />}
                    Re-test
                </button>

                <button
                    type="button"
                    onClick={handleRemoveClick}
                    className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                >
                    Remove
                </button>
            </div>

            {pendingRemove && (
                <RemoveConnectionDialog
                    connectionName={connection.name}
                    selectedBoardCount={selectedBoardCount}
                    mappingCount={mappingCount}
                    onConfirm={() => {
                        setPendingRemove(false);
                        onRemove(connection.id);
                    }}
                    onCancel={() => setPendingRemove(false)}
                />
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Remove confirmation dialog
// ---------------------------------------------------------------------------

interface RemoveConnectionDialogProps {
    connectionName: string;
    selectedBoardCount: number;
    mappingCount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

function RemoveConnectionDialog({ connectionName, selectedBoardCount, mappingCount, onConfirm, onCancel }: RemoveConnectionDialogProps) {
    const hasImpact = selectedBoardCount > 0 || mappingCount > 0;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900 w-full max-w-md mx-4">
                <h3 className="text-base font-semibold mb-2">Remove connection</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Remove <strong>{connectionName}</strong>?
                </p>
                {hasImpact && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        This will also remove{" "}
                        {selectedBoardCount > 0 && (
                            <strong>{selectedBoardCount} selected board{selectedBoardCount !== 1 ? "s" : ""}</strong>
                        )}
                        {selectedBoardCount > 0 && mappingCount > 0 && " and "}
                        {mappingCount > 0 && (
                            <strong>{mappingCount} column mapping{mappingCount !== 1 ? "s" : ""}</strong>
                        )}
                        . This cannot be undone.
                    </p>
                )}
                {!hasImpact && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        This cannot be undone.
                    </p>
                )}
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                    >
                        Remove
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Add connection form
// ---------------------------------------------------------------------------

interface AddConnectionFormProps {
    onAdded: (connection: ConnectionSummary) => void;
    existingOrgUrls: string[];
}

function AddConnectionForm({ onAdded, existingOrgUrls }: AddConnectionFormProps) {
    const [name, setName] = useState("");
    const [orgUrl, setOrgUrl] = useState("");
    const [pat, setPat] = useState("");
    const [patVisible, setPatVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [orgUrlError, setOrgUrlError] = useState<string | null>(null);
    const [patError, setPatError] = useState<string | null>(null);

    function validate(): boolean {
        let valid = true;
        if (!name.trim()) {
            setNameError("Connection name is required.");
            valid = false;
        } else {
            setNameError(null);
        }
        if (!orgUrl.trim()) {
            setOrgUrlError("Organisation URL is required.");
            valid = false;
        } else {
            let parsedUrl: URL | null = null;
            try {
                parsedUrl = new URL(orgUrl.trim());
            } catch {
                // invalid URL
            }
            if (!parsedUrl || parsedUrl.protocol !== "https:") {
                setOrgUrlError("Organisation URL must be a valid URL (e.g. https://dev.azure.com/your-org).");
                valid = false;
            } else if (existingOrgUrls.some((u) => u.toLowerCase() === orgUrl.trim().toLowerCase())) {
                setOrgUrlError("A connection to this organisation already exists.");
                valid = false;
            } else {
                setOrgUrlError(null);
            }
        }
        if (!pat.trim()) {
            setPatError("Personal Access Token is required.");
            valid = false;
        } else {
            setPatError(null);
        }
        return valid;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const result = await window.electron.connections.add({
                name: name.trim(),
                orgUrl: orgUrl.trim(),
                pat: pat.trim(),
            });

            if (result.success && result.connection) {
                toast.success(`Connected to ${name.trim()} successfully.`);
                onAdded(result.connection);
                setName("");
                setOrgUrl("");
                setPat("");
                setPatVisible(false);
            } else {
                if (result.errorField === "orgUrl") {
                    setOrgUrlError(result.error ?? "An error occurred.");
                } else {
                    setPatError(result.error ?? "Could not connect to Azure DevOps. Check your PAT and try again.");
                }
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-sm font-semibold">Add connection</h3>

            <div className="space-y-1">
                <label htmlFor="conn-name" className="block text-sm font-medium">
                    Connection name
                </label>
                <input
                    id="conn-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. My Company"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    disabled={loading}
                />
                {nameError && <p className="text-sm text-red-600 dark:text-red-400">{nameError}</p>}
            </div>

            <div className="space-y-1">
                <label htmlFor="conn-orgUrl" className="block text-sm font-medium">
                    Organisation URL
                </label>
                <input
                    id="conn-orgUrl"
                    type="text"
                    value={orgUrl}
                    onChange={(e) => setOrgUrl(e.target.value)}
                    placeholder="https://dev.azure.com/your-organisation"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    disabled={loading}
                />
                {orgUrlError && <p className="text-sm text-red-600 dark:text-red-400">{orgUrlError}</p>}
            </div>

            <div className="space-y-1">
                <label htmlFor="conn-pat" className="block text-sm font-medium">
                    Personal Access Token
                </label>
                <div className="flex items-center gap-2">
                    <input
                        id="conn-pat"
                        type={patVisible ? "text" : "password"}
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        placeholder="Paste your PAT here"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                        disabled={loading}
                    />
                    <button
                        type="button"
                        onClick={() => setPatVisible((v) => !v)}
                        className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                        aria-label={patVisible ? "Hide PAT" : "Show PAT"}
                    >
                        <EyeIcon visible={patVisible} />
                    </button>
                </div>
                {patError && <p className="text-sm text-red-600 dark:text-red-400">{patError}</p>}
            </div>

            <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {loading && <SpinnerIcon />}
                {loading ? "Testing..." : "Add & Test"}
            </button>
        </form>
    );
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function ConnectionSection() {
    const connections = useAppStore((s) => s.connections);
    const setConnections = useAppStore((s) => s.setConnections);
    const addConnectionToStore = useAppStore((s) => s.addConnection);
    const removeConnectionFromStore = useAppStore((s) => s.removeConnection);
    const selectedBoards = useAppStore((s) => s.selectedBoards);
    const combinedBoardColumns = useAppStore((s) => s.combinedBoardColumns);
    const setSelectedBoards = useAppStore((s) => s.setSelectedBoards);
    const setCombinedBoardColumns = useAppStore((s) => s.setCombinedBoardColumns);

    useEffect(() => {
        window.electron.connections.load().then(setConnections);
    }, [setConnections]);

    function getImpactCounts(connectionId: string) {
        const selectedBoardCount = selectedBoards.filter((b) => b.connectionId === connectionId).length;
        const mappingCount = combinedBoardColumns.reduce(
            (sum, col) => sum + col.sourceMappings.filter((m) => m.connectionId === connectionId).length,
            0
        );
        return { selectedBoardCount, mappingCount };
    }

    async function handleRemove(connectionId: string) {
        await window.electron.connections.remove({ connectionId });

        // Update store to reflect removal
        removeConnectionFromStore(connectionId);
        const prunedBoards = selectedBoards.filter((b) => b.connectionId !== connectionId);
        setSelectedBoards(prunedBoards);
        const prunedColumns = combinedBoardColumns.map((col) => ({
            ...col,
            sourceMappings: col.sourceMappings.filter((m) => m.connectionId !== connectionId),
        }));
        setCombinedBoardColumns(prunedColumns);

        toast.success("Connection removed.");
    }

    function handleAdded(connection: ConnectionSummary) {
        addConnectionToStore(connection);
    }

    return (
        <div className="max-w-lg space-y-6">
            <h2 className="text-xl font-semibold">Connections</h2>

            {connections.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No connections configured yet.</p>
            )}

            {connections.length > 0 && (
                <div className="space-y-2">
                    {connections.map((connection) => {
                        const { selectedBoardCount, mappingCount } = getImpactCounts(connection.id);
                        return (
                            <ConnectionRow
                                key={connection.id}
                                connection={connection}
                                selectedBoardCount={selectedBoardCount}
                                mappingCount={mappingCount}
                                onRemove={handleRemove}
                            />
                        );
                    })}
                </div>
            )}

            <AddConnectionForm
                onAdded={handleAdded}
                existingOrgUrls={connections.map((c) => c.orgUrl)}
            />
        </div>
    );
}
