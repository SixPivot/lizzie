import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SpinnerIcon } from "../Shared/SpinnerIcon";
import { useAppStore } from "../../store/appStore";
import type { AvailableBoard, SelectedBoard } from "../../../shared/electronAPI";
import HamburgerIcon from "../Shared/HamburgerIcon";
import { WarningIcon } from "../Shared/WarningIcon";

type PageState = "loading" | "no-credentials" | "error" | "loaded";

interface AvailableBoardWithConnection extends AvailableBoard {
    connectionId: string;
    connectionName: string;
}

interface SortableBoardItemProps {
    board: SelectedBoard;
    connectionName: string;
    isStale: boolean;
    onRemove: (connectionId: string, boardId: string) => void;
}

function SortableBoardItem({ board, connectionName, isStale, onRemove }: SortableBoardItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: `${board.connectionId}::${board.boardId}`,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-900 ${
                isDragging
                    ? "opacity-50 border-blue-300 dark:border-blue-600"
                    : "border-gray-200 dark:border-gray-700"
            }`}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="shrink-0 cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none"
                aria-label="Drag to reorder"
            >
                <HamburgerIcon />
            </button>

            <span className="flex-1 min-w-0 truncate">
                <span className="text-gray-400 dark:text-gray-500">{connectionName} / {board.projectName} / </span>
                {board.teamName}
            </span>

            {isStale && (
                <WarningIcon title="This board could not be found in your organisation. It may have been deleted or the connection may have changed." />
            )}

            <button
                type="button"
                onClick={() => onRemove(board.connectionId, board.boardId)}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            >
                Remove
            </button>
        </div>
    );
}

export function BoardsSection() {
    const setStoreSelectedBoards = useAppStore((s) => s.setSelectedBoards);
    const setBoardColumns = useAppStore((s) => s.setBoardColumns);
    const storeCombinedBoardColumns = useAppStore((s) => s.combinedBoardColumns);
    const setStoreCombinedBoardColumns = useAppStore((s) => s.setCombinedBoardColumns);
    const connections = useAppStore((s) => s.connections);

    const [pageState, setPageState] = useState<PageState>("loading");
    const [availableBoards, setAvailableBoards] = useState<AvailableBoardWithConnection[]>([]);
    const [selectedBoards, setSelectedBoards] = useState<SelectedBoard[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [pendingRemove, setPendingRemove] = useState<{ connectionId: string; boardId: string } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    async function loadBoards() {
        setPageState("loading");
        setErrorMessage(null);

        if (connections.length === 0) {
            setPageState("no-credentials");
            return;
        }

        const settingsResult = await window.electron.loadSettings();
        setSelectedBoards(settingsResult.selectedBoards);
        setStoreSelectedBoards(settingsResult.selectedBoards);

        const boardResults = await Promise.all(
            connections.map((conn) =>
                window.electron.getAvailableBoards({ connectionId: conn.id }).then((result) => ({
                    connectionId: conn.id,
                    connectionName: conn.name,
                    result,
                }))
            )
        );

        const allBoards: AvailableBoardWithConnection[] = [];
        let anyError = false;
        const errorMessages: string[] = [];

        for (const { connectionId, connectionName, result } of boardResults) {
            if (result.error && result.error !== "NO_CREDENTIALS") {
                anyError = true;
                errorMessages.push(`${connectionName}: ${result.error}`);
            } else if (result.boards) {
                for (const board of result.boards) {
                    allBoards.push({ ...board, connectionId, connectionName });
                }
            }
        }

        setAvailableBoards(allBoards);

        if (anyError && allBoards.length === 0) {
            setErrorMessage(errorMessages.join("\n"));
            setPageState("error");
        } else {
            setPageState("loaded");
        }
    }

    useEffect(() => {
        loadBoards();
    }, [connections.length]);

    async function updateSelected(boards: SelectedBoard[]) {
        setSelectedBoards(boards);
        setStoreSelectedBoards(boards);
        await window.electron.saveSelectedBoards(boards);
        const columnsResult = await window.electron.getBoardColumnsForSelected();
        if (columnsResult.columns) {
            setBoardColumns(columnsResult.columns);
        }
        toast.success("Boards saved");
    }

    function handleAdd(board: AvailableBoardWithConnection) {
        const selectedBoard: SelectedBoard = {
            connectionId: board.connectionId,
            projectId: board.projectId,
            projectName: board.projectName,
            teamId: board.teamId,
            teamName: board.teamName,
            boardId: board.boardId,
            boardName: board.boardName,
        };
        updateSelected([...selectedBoards, selectedBoard]);
    }

    function handleRemove(connectionId: string, boardId: string) {
        const hasMappings = storeCombinedBoardColumns.some((col) =>
            col.sourceMappings.some((m) => m.connectionId === connectionId && m.boardId === boardId)
        );
        if (hasMappings) {
            setPendingRemove({ connectionId, boardId });
        } else {
            doRemoveBoard(connectionId, boardId);
        }
    }

    async function doRemoveBoard(connectionId: string, boardId: string) {
        const prunedColumns = storeCombinedBoardColumns.map((col) => ({
            ...col,
            sourceMappings: col.sourceMappings.filter(
                (m) => !(m.connectionId === connectionId && m.boardId === boardId)
            ),
        }));
        await window.electron.saveCombinedBoardColumns(prunedColumns);
        setStoreCombinedBoardColumns(prunedColumns);
        updateSelected(
            selectedBoards.filter((b) => !(b.connectionId === connectionId && b.boardId === boardId))
        );
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = selectedBoards.findIndex(
                (b) => `${b.connectionId}::${b.boardId}` === active.id
            );
            const newIndex = selectedBoards.findIndex(
                (b) => `${b.connectionId}::${b.boardId}` === over.id
            );
            updateSelected(arrayMove(selectedBoards, oldIndex, newIndex));
        }
    }

    const selectedBoardKeys = useMemo(
        () => new Set(selectedBoards.map((b) => `${b.connectionId}::${b.boardId}`)),
        [selectedBoards]
    );

    const availableBoardKeys = useMemo(
        () => new Set(availableBoards.map((b) => `${b.connectionId}::${b.boardId}`)),
        [availableBoards]
    );

    const connectionGroups = useMemo(() => {
        const lowerSearch = search.toLowerCase();

        const filtered = lowerSearch
            ? availableBoards.filter(
                  (b) =>
                      b.connectionName.toLowerCase().includes(lowerSearch) ||
                      b.projectName.toLowerCase().includes(lowerSearch) ||
                      b.teamName.toLowerCase().includes(lowerSearch)
              )
            : availableBoards;

        const grouped = new Map<
            string,
            { connectionName: string; projects: Map<string, { projectName: string; boards: AvailableBoardWithConnection[] }> }
        >();

        for (const board of filtered) {
            let connEntry = grouped.get(board.connectionId);
            if (!connEntry) {
                connEntry = { connectionName: board.connectionName, projects: new Map() };
                grouped.set(board.connectionId, connEntry);
            }
            let projEntry = connEntry.projects.get(board.projectId);
            if (!projEntry) {
                projEntry = { projectName: board.projectName, boards: [] };
                connEntry.projects.set(board.projectId, projEntry);
            }
            projEntry.boards.push(board);
        }

        return grouped;
    }, [availableBoards, search]);

    const connectionMap = useMemo(
        () => new Map(connections.map((c) => [c.id, c.name])),
        [connections]
    );

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Remote Boards</h2>

            {pendingRemove !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900 w-full max-w-md mx-4">
                        <h3 className="text-base font-semibold mb-2">Remove board</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Removing this board will also delete its column mappings in the Combined Board configuration. Do you want to continue?
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPendingRemove(null)}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const { connectionId, boardId } = pendingRemove;
                                    setPendingRemove(null);
                                    doRemoveBoard(connectionId, boardId);
                                }}
                                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-6 min-h-0">
                {/* Available boards column */}
                <div className="flex-1 min-w-0 space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Available boards
                    </h3>

                    {pageState === "no-credentials" && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Configure a connection first.
                        </p>
                    )}

                    {pageState === "loading" && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <SpinnerIcon />
                            <span>Loading boards…</span>
                        </div>
                    )}

                    {pageState === "error" && (
                        <div className="space-y-2">
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {errorMessage ?? "Failed to load boards."}
                            </p>
                            <button
                                type="button"
                                onClick={loadBoards}
                                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {pageState === "loaded" && (
                        <>
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter by connection, project or board…"
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                            />

                            {connectionGroups.size === 0 && availableBoards.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No boards found across your connections.
                                </p>
                            )}

                            {connectionGroups.size === 0 && availableBoards.length > 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No boards match your search.
                                </p>
                            )}

                            <div className="space-y-6">
                                {Array.from(connectionGroups.entries()).map(
                                    ([connectionId, { connectionName, projects }]) => (
                                        <div key={connectionId}>
                                            <p className="mb-2 text-s font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                                                {connectionName}
                                            </p>
                                            <div className="space-y-4">
                                                {Array.from(projects.entries()).map(([projectId, { projectName, boards }]) => (
                                                    <div key={projectId}>
                                                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                            {projectName}
                                                        </p>
                                                        <div className="space-y-1">
                                                            {boards.map((board) => {
                                                                const key = `${board.connectionId}::${board.boardId}`;
                                                                const isSelected = selectedBoardKeys.has(key);
                                                                return (
                                                                    <div
                                                                        key={key}
                                                                        className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                                                                    >
                                                                        <span className="flex-1 min-w-0 truncate">
                                                                            {board.teamName}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleAdd(board)}
                                                                            disabled={isSelected}
                                                                            className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                                                                        >
                                                                            Add
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Selected boards column */}
                <div className="flex-1 min-w-0 space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Selected boards
                    </h3>

                    {selectedBoards.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            No boards selected. Add boards from the list on the left.
                        </p>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={selectedBoards.map((b) => `${b.connectionId}::${b.boardId}`)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-1">
                                    {selectedBoards.map((board) => (
                                        <SortableBoardItem
                                            key={`${board.connectionId}::${board.boardId}`}
                                            board={board}
                                            connectionName={connectionMap.get(board.connectionId) ?? board.connectionId}
                                            isStale={!availableBoardKeys.has(`${board.connectionId}::${board.boardId}`) && pageState === "loaded"}
                                            onRemove={handleRemove}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>
        </div>
    );
}
