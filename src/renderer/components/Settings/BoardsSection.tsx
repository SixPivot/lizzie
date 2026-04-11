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

type PageState = "loading" | "no-credentials" | "error" | "loaded";

interface SortableBoardItemProps {
    board: SelectedBoard;
    isStale: boolean;
    onRemove: (boardId: string) => void;
}

function SortableBoardItem({ board, isStale, onRemove }: SortableBoardItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: board.boardId,
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
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="3" y1="8" x2="21" y2="8" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="16" x2="21" y2="16" />
                </svg>
            </button>

            <span className="flex-1 min-w-0 truncate">
                <span className="text-gray-500 dark:text-gray-400">{board.projectName} / </span>
                {board.boardName}
            </span>

            {isStale && (
                <span
                    title="This board could not be found in your organisation. It may have been deleted or the connection may have changed."
                    className="shrink-0 text-amber-500"
                    aria-label="Board not found"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </span>
            )}

            <button
                type="button"
                onClick={() => onRemove(board.boardId)}
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            >
                Remove
            </button>
        </div>
    );
}

export function BoardsSection() {
    const setStoreSelectedBoards = useAppStore((s) => s.setSelectedBoards);

    const [pageState, setPageState] = useState<PageState>("loading");
    const [availableBoards, setAvailableBoards] = useState<AvailableBoard[]>([]);
    const [selectedBoards, setSelectedBoards] = useState<SelectedBoard[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    async function loadBoards() {
        setPageState("loading");
        setErrorMessage(null);

        const [settingsResult, boardsResult] = await Promise.all([
            window.electron.loadSettings(),
            window.electron.getAvailableBoards(),
        ]);

        setSelectedBoards(settingsResult.selectedBoards);
        setStoreSelectedBoards(settingsResult.selectedBoards);

        if (boardsResult.error === "NO_CREDENTIALS") {
            setPageState("no-credentials");
        } else if (boardsResult.error) {
            setErrorMessage(boardsResult.error);
            setPageState("error");
        } else {
            setAvailableBoards(boardsResult.boards ?? []);
            setPageState("loaded");
        }
    }

    useEffect(() => {
        loadBoards();
    }, []);

    async function updateSelected(boards: SelectedBoard[]) {
        setSelectedBoards(boards);
        setStoreSelectedBoards(boards);
        await window.electron.saveSelectedBoards(boards);
        toast.success("Boards saved");
    }

    function handleAdd(board: AvailableBoard) {
        updateSelected([...selectedBoards, board]);
    }

    function handleRemove(boardId: string) {
        updateSelected(selectedBoards.filter((b) => b.boardId !== boardId));
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = selectedBoards.findIndex((b) => b.boardId === active.id);
            const newIndex = selectedBoards.findIndex((b) => b.boardId === over.id);
            updateSelected(arrayMove(selectedBoards, oldIndex, newIndex));
        }
    }

    const selectedBoardIds = useMemo(
        () => new Set(selectedBoards.map((b) => b.boardId)),
        [selectedBoards]
    );

    const availableBoardIds = useMemo(
        () => new Set(availableBoards.map((b) => b.boardId)),
        [availableBoards]
    );

    const projectGroups = useMemo(() => {
        const lowerSearch = search.toLowerCase();

        const filtered = lowerSearch
            ? availableBoards.filter(
                  (b) =>
                      b.projectName.toLowerCase().includes(lowerSearch) ||
                      b.teamName.toLowerCase().includes(lowerSearch)
              )
            : availableBoards;

        const grouped = new Map<string, { projectName: string; boards: AvailableBoard[] }>();
        for (const board of filtered) {
            const entry = grouped.get(board.projectId);
            if (entry) {
                entry.boards.push(board);
            } else {
                grouped.set(board.projectId, { projectName: board.projectName, boards: [board] });
            }
        }
        return grouped;
    }, [availableBoards, search]);

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Remote Boards</h2>

            <div className="flex gap-6 min-h-0">
                {/* Available boards column */}
                <div className="flex-1 min-w-0 space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Available boards
                    </h3>

                    {pageState === "no-credentials" && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Configure your connection first.
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
                                placeholder="Filter by project or board…"
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                            />

                            {projectGroups.size === 0 && availableBoards.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No boards found in your organisation.
                                </p>
                            )}

                            {projectGroups.size === 0 && availableBoards.length > 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No boards match your search.
                                </p>
                            )}

                            <div className="space-y-4">
                                {Array.from(projectGroups.entries()).map(
                                    ([projectId, { projectName, boards }]) => (
                                        <div key={projectId}>
                                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                {projectName}
                                            </p>
                                            <div className="space-y-1">
                                                {boards.map((board) => {
                                                    const isSelected = selectedBoardIds.has(
                                                        board.boardId
                                                    );
                                                    return (
                                                        <div
                                                            key={board.boardId}
                                                            className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                                                        >
                                                            <span className="flex-1 min-w-0 truncate">
                                                                {board.teamName}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAdd(board)}
                                                                disabled={isSelected}
                                                                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                                                            >
                                                                Add
                                                            </button>
                                                        </div>
                                                    );
                                                })}
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
                                items={selectedBoards.map((b) => b.boardId)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-1">
                                    {selectedBoards.map((board) => (
                                        <SortableBoardItem
                                            key={board.boardId}
                                            board={board}
                                            isStale={!availableBoardIds.has(board.boardId) && pageState === "loaded"}
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
