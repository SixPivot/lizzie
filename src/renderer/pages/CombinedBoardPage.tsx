import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";
import { useAppStore } from "../store/appStore";
import { SpinnerIcon } from "../components/Shared/SpinnerIcon";
import type { WorkItemCard, CombinedBoardColumn } from "../../shared/electronAPI";

// ---------------------------------------------------------------------------
// Work item type icon
// ---------------------------------------------------------------------------

const TYPE_COLOURS: Record<string, string> = {
    "Bug": "#e05555",
    "User Story": "#3b82f6",
    "Task": "#eab308",
    "Feature": "#a855f7",
    "Epic": "#f97316",
    "Test Case": "#14b8a6",
};

function WorkItemTypeIcon({ typeName }: { typeName: string }) {
    const colour = TYPE_COLOURS[typeName] ?? "#6b7280";
    const isKnown = typeName in TYPE_COLOURS;

    if (!isKnown) {
        return (
            <span title={typeName}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill={colour}>
                    <rect width="14" height="14" rx="2" />
                </svg>
            </span>
        );
    }

    if (typeName === "Bug") {
        return (
            <svg width="14" height="14" viewBox="0 0 14 14" fill={colour}>
                <circle cx="7" cy="7" r="6" />
            </svg>
        );
    }

    if (typeName === "Task") {
        return (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={colour} strokeWidth="2">
                <rect x="1" y="1" width="12" height="12" rx="1" />
            </svg>
        );
    }

    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill={colour}>
            <rect width="14" height="14" rx="2" />
        </svg>
    );
}

// ---------------------------------------------------------------------------
// Tag pill
// ---------------------------------------------------------------------------

function TagPill({ tag }: { tag: string }) {
    return (
        <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {tag.trim()}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Open in AzDO button
// ---------------------------------------------------------------------------

function OpenInAzDOButton({ url }: { url: string }) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                window.electron.openExternal(url);
            }}
            title="Open in Azure DevOps"
            className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
            aria-label="Open in Azure DevOps"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Card detail modal
// ---------------------------------------------------------------------------

interface CollapsibleSectionProps {
    title: string;
    html: boolean;
    children: React.ReactNode;
}

function CollapsibleSection({ title, html: _html, children }: CollapsibleSectionProps) {
    const [expanded, setExpanded] = useState(true);
    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-left hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
            >
                <span>{title}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {expanded && (
                <div className="px-3 py-2 text-sm">
                    {children}
                </div>
            )}
        </div>
    );
}

interface CardDetailModalProps {
    card: WorkItemCard;
    onClose: () => void;
}

const ORDERED_FIELD_REFS = [
    { ref: "System.Description", label: "Description" },
    { ref: "Microsoft.VSTS.Common.AcceptanceCriteria", label: "Acceptance Criteria" },
    { ref: "Microsoft.VSTS.TCM.ReproSteps", label: "Repro Steps" },
    { ref: "Microsoft.VSTS.TCM.SystemInfo", label: "System Info" },
];

const ALWAYS_EXCLUDED_FIELDS = new Set([
    "System.Id",
    "System.Title",
    "System.WorkItemType",
    "System.AssignedTo",
    "System.Tags",
    "System.BoardColumn",
    "System.BoardColumnDone",
    ...ORDERED_FIELD_REFS.map((f) => f.ref),
]);

function isHtmlValue(value: unknown): boolean {
    if (typeof value !== "string") return false;
    return /<[a-z][\s\S]*>/i.test(value);
}

function sanitise(html: string): string {
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function FieldValue({ value }: { value: unknown }) {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "string" && isHtmlValue(value)) {
        return (
            <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitise(value) }}
            />
        );
    }

    if (typeof value === "object") {
        const display = (value as { displayName?: string }).displayName ?? JSON.stringify(value);
        return <span>{display}</span>;
    }

    return <span>{String(value)}</span>;
}

function CardDetailModal({ card, onClose }: CardDetailModalProps) {
    const typeName = (card.fields["System.WorkItemType"] as string | undefined) ?? "Work Item";
    const title = (card.fields["System.Title"] as string | undefined) ?? "(No title)";
    const assignedTo = card.fields["System.AssignedTo"];
    const assigneeName =
        typeof assignedTo === "object" && assignedTo !== null
            ? (assignedTo as { displayName?: string }).displayName ?? "Unassigned"
            : typeof assignedTo === "string"
            ? assignedTo
            : "Unassigned";
    const tagsRaw = (card.fields["System.Tags"] as string | undefined) ?? "";
    const tags = tagsRaw ? tagsRaw.split(";").map((t) => t.trim()).filter(Boolean) : [];
    const azDoUrl = `${card.orgUrl}/${card.projectName}/_workitems/edit/${card.id}`;

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Build "other" fields (alphabetical, non-empty, not in known list)
    const otherFields = useMemo(() => {
        return Object.entries(card.fields)
            .filter(([ref, value]) => {
                if (ALWAYS_EXCLUDED_FIELDS.has(ref)) return false;
                if (value === null || value === undefined || value === "") return false;
                return true;
            })
            .map(([ref, value]) => ({
                ref,
                label: ref.split(".").pop() ?? ref,
                value,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [card.fields]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="mt-0.5 shrink-0">
                        <WorkItemTypeIcon typeName={typeName} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>{typeName}</span>
                            <span>·</span>
                            <button
                                type="button"
                                onClick={() => window.electron.openExternal(azDoUrl)}
                                className="underline hover:text-blue-500 transition-colors"
                            >
                                #{card.id}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => window.electron.openExternal(azDoUrl)}
                            className="text-base font-semibold text-left hover:underline focus:outline-none leading-snug"
                        >
                            {title}
                        </button>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {assigneeName}
                        </div>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {tags.map((tag) => (
                                    <TagPill key={tag} tag={tag} />
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {ORDERED_FIELD_REFS.map(({ ref, label }) => {
                        const value = card.fields[ref];
                        if (!value) return null;
                        return (
                            <CollapsibleSection key={ref} title={label} html>
                                <FieldValue value={value} />
                            </CollapsibleSection>
                        );
                    })}

                    {otherFields.map(({ ref, label, value }) => (
                        <CollapsibleSection key={ref} title={label} html={false}>
                            <FieldValue value={value} />
                        </CollapsibleSection>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Work item card
// ---------------------------------------------------------------------------

interface WorkItemCardProps {
    card: WorkItemCard;
    onClick: (card: WorkItemCard) => void;
}

function WorkItemCardComponent({ card, onClick }: WorkItemCardProps) {
    const typeName = (card.fields["System.WorkItemType"] as string | undefined) ?? "Work Item";
    const title = (card.fields["System.Title"] as string | undefined) ?? "(No title)";
    const assignedTo = card.fields["System.AssignedTo"];
    const assigneeName =
        typeof assignedTo === "object" && assignedTo !== null
            ? (assignedTo as { displayName?: string }).displayName
            : typeof assignedTo === "string"
            ? assignedTo
            : null;
    const tagsRaw = (card.fields["System.Tags"] as string | undefined) ?? "";
    const tags = tagsRaw ? tagsRaw.split(";").map((t) => t.trim()).filter(Boolean) : [];
    const azDoUrl = `${card.orgUrl}/${card.projectName}/_workitems/edit/${card.id}`;

    return (
        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                    <WorkItemTypeIcon typeName={typeName} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            {card.teamName}
                        </span>
                        <OpenInAzDOButton url={azDoUrl} />
                    </div>
                    <button
                        type="button"
                        onClick={() => onClick(card)}
                        className="text-sm font-medium text-left leading-snug hover:underline focus:outline-none w-full"
                    >
                        <span className="text-gray-400 dark:text-gray-500">#{card.id}</span>{" "}
                        {title}
                    </button>
                    {assigneeName && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {assigneeName}
                        </div>
                    )}
                    {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.map((tag) => (
                                <TagPill key={tag} tag={tag} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Board column
// ---------------------------------------------------------------------------

interface BoardColumnProps {
    column: CombinedBoardColumn;
    cards: WorkItemCard[];
    error: string | null;
    onCardClick: (card: WorkItemCard) => void;
}

function BoardColumn({ column, cards, error, onCardClick }: BoardColumnProps) {
    return (
        <div className="flex flex-col min-w-[280px] w-[280px] shrink-0 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <h2 className="text-sm font-semibold truncate">{column.name}</h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">{cards.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {error !== null ? (
                    <p className="text-xs text-red-600 dark:text-red-400 p-2">{error}</p>
                ) : cards.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic p-2">No items</p>
                ) : (
                    cards.map((card) => (
                        <WorkItemCardComponent
                            key={buildWorkItemCardKey(card)}
                            card={card}
                            onClick={onCardClick}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type LoadState = "idle" | "loading" | "error" | "loaded";

function formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function buildWorkItemCardKey(card: Pick<WorkItemCard, "connectionId" | "boardId" | "id">): string {
    return `${card.connectionId}::${card.boardId}::${card.id}`;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function filterCardsBySearch(cards: WorkItemCard[], query: string): WorkItemCard[] {
    const trimmed = query.trim();
    if (!trimmed) return cards;
    const lower = trimmed.toLowerCase();
    return cards.filter((card) => {
        const title = ((card.fields["System.Title"] as string | undefined) ?? "").toLowerCase();
        const descriptionRaw = (card.fields["System.Description"] as string | undefined) ?? "";
        const description = stripHtml(descriptionRaw).toLowerCase();
        return title.includes(lower) || description.includes(lower);
    });
}

export function CombinedBoardPage() {
    const connections = useAppStore((s) => s.connections);
    const selectedBoards = useAppStore((s) => s.selectedBoards);
    const combinedBoardColumns = useAppStore((s) => s.combinedBoardColumns);
    const workItems = useAppStore((s) => s.workItems);
    const setWorkItems = useAppStore((s) => s.setWorkItems);

    const [loadState, setLoadState] = useState<LoadState>("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [selectedCard, setSelectedCard] = useState<WorkItemCard | null>(null);
    const [failedConnections, setFailedConnections] = useState<string[]>([]);
    const [warningDismissed, setWarningDismissed] = useState(false);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const hasConnections = connections.length > 0;
    const hasBoards = selectedBoards.length > 0;
    const hasColumns = combinedBoardColumns.length > 0;

    const fetchCards = useCallback(async (background: boolean) => {
        if (background) {
            setIsRefreshing(true);
        } else {
            setLoadState("loading");
            setErrorMessage(null);
        }

        try {
            const result = await window.electron.getWorkItems();
            if (result.error) {
                if (!background) {
                    setErrorMessage(result.error);
                    setLoadState("error");
                }
            } else {
                setWorkItems(result.cards ?? []);
                setLastRefreshed(new Date());
                if (result.failedConnections && result.failedConnections.length > 0) {
                    setFailedConnections(result.failedConnections);
                    setWarningDismissed(false);
                } else {
                    setFailedConnections([]);
                }
                if (!background) {
                    setLoadState("loaded");
                }
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!background) {
                setErrorMessage(msg);
                setLoadState("error");
            }
        } finally {
            if (background) {
                setIsRefreshing(false);
            }
        }
    }, [setWorkItems]);

    // Initial load on mount (or when guard conditions are met)
    const hasFetchedRef = useRef(false);
    useEffect(() => {
        if (!hasConnections || !hasBoards || !hasColumns) return;
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        // If we already have data in the store, show it immediately and refresh in background
        if (workItems.length > 0) {
            setLoadState("loaded");
            fetchCards(true);
        } else {
            fetchCards(false);
        }
    }, [hasConnections, hasBoards, hasColumns, workItems.length, fetchCards]);

    // 5-minute auto-refresh
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        if (!hasConnections || !hasBoards || !hasColumns) return;

        intervalRef.current = setInterval(() => {
            fetchCards(true);
        }, 5 * 60 * 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [hasConnections, hasBoards, hasColumns, fetchCards]);

    // Compute cards per column
    const columnCards = useMemo(() => {
        return combinedBoardColumns.map((col) => {
            const cards: WorkItemCard[] = [];
            col.sourceMappings.forEach((mapping) => {
                const mappingCards = workItems
                    .filter(
                        (item) =>
                            item.connectionId === mapping.connectionId &&
                            item.boardId === mapping.boardId &&
                            item.columnName.toLowerCase() === mapping.columnName.toLowerCase()
                    )
                    .sort((a, b) => a.boardOrder - b.boardOrder);
                cards.push(...mappingCards);
            });
            const filteredCards = filterCardsBySearch(cards, searchQuery);
            return { column: col, cards: filteredCards, error: null as string | null };
        });
    }, [combinedBoardColumns, workItems, searchQuery]);

    // Guard states
    if (!hasConnections) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <div className="text-center space-y-2">
                    <p className="text-gray-600 dark:text-gray-400">
                        Configure a connection in Settings to use the Combined Board.
                    </p>
                    <Link
                        to="/settings"
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                        Go to Settings → Connections
                    </Link>
                </div>
            </div>
        );
    }

    if (!hasBoards) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <div className="text-center space-y-2">
                    <p className="text-gray-600 dark:text-gray-400">
                        Select at least one remote board in Settings to use the Combined Board.
                    </p>
                    <Link
                        to="/settings"
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                        Go to Settings → Remote Boards
                    </Link>
                </div>
            </div>
        );
    }

    if (!hasColumns) {
        return (
            <div className="flex items-center justify-center h-full p-8">
                <div className="text-center space-y-2">
                    <p className="text-gray-600 dark:text-gray-400">
                        Configure your Combined Board columns in Settings.
                    </p>
                    <Link
                        to="/settings"
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                    >
                        Go to Settings → Combined Board
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-[var(--color-bg)]">
                <h1 className="text-lg font-semibold">Combined Board</h1>
                {lastRefreshed && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        Last refreshed at {formatTime(lastRefreshed)}
                    </span>
                )}
                <div className="flex-1" />
                <div className="relative">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search cards…"
                        aria-label="Search cards"
                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-8 pr-3 py-1.5 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                    />
                </div>
                <button
                    type="button"
                    disabled={loadState === "loading" || isRefreshing}
                    onClick={() => {
                        if (loadState === "loaded" || loadState === "error") {
                            fetchCards(loadState === "loaded");
                        } else {
                            fetchCards(false);
                        }
                    }}
                    className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    {(isRefreshing || loadState === "loading") ? (
                        <SpinnerIcon />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                    )}
                    Refresh
                </button>
            </div>

            {/* Failed connections warning banner */}
            {failedConnections.length > 0 && !warningDismissed && (
                <div className="shrink-0 flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span className="flex-1">
                        Could not load items from:{" "}
                        <strong>{failedConnections.join(", ")}</strong>. Re-test these connections in{" "}
                        <Link to="/settings" className="underline hover:opacity-80">Settings → Connections</Link>.
                    </span>
                    <button
                        type="button"
                        onClick={() => setWarningDismissed(true)}
                        className="shrink-0 text-amber-600 dark:text-amber-400 hover:opacity-80"
                        aria-label="Dismiss warning"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Board area */}
            <div className="flex-1 overflow-hidden relative">
                {loadState === "loading" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-bg)] z-10">
                        <SpinnerIcon />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Loading board…</span>
                    </div>
                )}

                {loadState === "error" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-bg)] z-10">
                        <p className="text-sm text-red-600 dark:text-red-400">
                            {errorMessage ?? "Failed to load work items."}
                        </p>
                        <button
                            type="button"
                            onClick={() => fetchCards(false)}
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {(loadState === "loaded" || (loadState === "idle" && workItems.length > 0)) && (
                    <div className="flex h-full overflow-x-auto">
                        {columnCards.map(({ column, cards, error }) => (
                            <BoardColumn
                                key={column.id}
                                column={column}
                                cards={cards}
                                error={error}
                                onCardClick={setSelectedCard}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Card detail modal */}
            {selectedCard && (
                <CardDetailModal
                    card={selectedCard}
                    onClose={() => setSelectedCard(null)}
                />
            )}
        </div>
    );
}
