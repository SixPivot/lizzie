import { useState, useMemo, useRef, useEffect } from "react";
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
import { useAppStore } from "../../store/appStore";
import type { BoardColumnInfo, CombinedBoardColumn, CombinedBoardColumnMapping } from "../../../shared/electronAPI";
import { WarningIcon } from "../Shared/WarningIcon";
import HamburgerIcon from "../Shared/HamburgerIcon";

// ---------------------------------------------------------------------------
// Pure logic helpers
// ---------------------------------------------------------------------------

export function resolveAutoAssign(
    columns: CombinedBoardColumn[],
    mapping: CombinedBoardColumnMapping,
    newColumnId: string
): CombinedBoardColumn[] {
    const matchIndex = columns.findIndex(
        (c) => c.name.toLowerCase() === mapping.columnName.toLowerCase()
    );
    if (matchIndex !== -1) {
        return columns.map((col, i) =>
            i === matchIndex
                ? { ...col, sourceMappings: [...col.sourceMappings, mapping] }
                : col
        );
    }
    return [
        ...columns,
        { id: newColumnId, name: mapping.columnName, sourceMappings: [mapping] },
    ];
}

export function isDuplicateColumnName(
    columns: CombinedBoardColumn[],
    name: string,
    excludeId?: string
): boolean {
    return columns.some(
        (c) => c.id !== excludeId && c.name.toLowerCase() === name.trim().toLowerCase()
    );
}

export function buildMappedColumnIds(columns: CombinedBoardColumn[]): Set<string> {
    const mapped = new Set<string>();
    for (const col of columns) {
        for (const m of col.sourceMappings) {
            mapped.add(`${m.connectionId}::${m.boardId}::${m.columnId}`);
        }
    }
    return mapped;
}

// ---------------------------------------------------------------------------
// Source column picker
// ---------------------------------------------------------------------------

interface SourceColumnPickerProps {
    boardColumns: BoardColumnInfo[];
    mappedIds: Set<string>;
    search: string;
    onSearchChange: (value: string) => void;
    onSelect: (column: BoardColumnInfo) => void;
    onClose: () => void;
    /** When true, the picker is rendered inline (no absolute positioning / click-outside). */
    inline?: boolean;
}

function SourceColumnPicker({ boardColumns, mappedIds, search, onSearchChange, onSelect, onClose, inline }: SourceColumnPickerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (inline) return;
        function handlePointerDown(e: PointerEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [onClose, inline]);

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Escape") {
            onClose();
        }
    }

    const filtered = useMemo(() => {
        const term = search.toLowerCase();
        const results = boardColumns.filter((c) => {
            if (mappedIds.has(`${c.boardId}::${c.columnId}`)) return false;
            if (!term) return true;
            return (
                c.projectName.toLowerCase().includes(term) ||
                c.boardName.toLowerCase().includes(term) ||
                c.columnName.toLowerCase().includes(term)
            );
        });
        return results.slice().sort((a, b) => a.columnName.localeCompare(b.columnName));
    }, [boardColumns, mappedIds, search]);

    const wrapperClass = inline
        ? "rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        : "absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900";

    return (
        <div ref={containerRef} className={wrapperClass}>
            <div className="p-2 border-b border-gray-100 dark:border-gray-800">
                <input
                    ref={inputRef}
                    type="search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search project, board, or column…"
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                />
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
                {filtered.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No results
                    </li>
                )}
                {filtered.map((c) => (
                    <li key={`${c.boardId}::${c.columnId}`}>
                        <button
                            type="button"
                            onClick={() => onSelect(c)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                            <span className="text-gray-500 dark:text-gray-400">
                                {c.projectName} / {c.teamName} /
                            </span>{" "}
                            {c.columnName}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Inline editable column name
// ---------------------------------------------------------------------------

interface InlineEditProps {
    value: string;
    onSave: (value: string) => void;
    onCancel: () => void;
    isDuplicate: boolean;
}

function InlineEdit({ value, onSave, onCancel, isDuplicate }: InlineEditProps) {
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            onSave(draft);
        } else if (e.key === "Escape") {
            onCancel();
        }
    }

    return (
        <div className="flex-1 min-w-0">
            <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => onSave(draft)}
                className={`w-full rounded border px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDuplicate
                        ? "border-red-400 dark:border-red-500"
                        : "border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                }`}
            />
            {isDuplicate && (
                <p className="mt-1 text-xs text-red-500">A column with this name already exists.</p>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteConfirmProps {
    columnName: string;
    onConfirm: () => void;
    onCancel: () => void;
}

function DeleteConfirmDialog({ columnName, onConfirm, onCancel }: DeleteConfirmProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900 w-full max-w-md mx-4">
                <h3 className="text-base font-semibold mb-2">Delete column</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Delete <strong>{columnName}</strong> and all its source column mappings? This cannot be undone.
                </p>
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
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sortable combined column card
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sortable mapping row (within a card)
// ---------------------------------------------------------------------------

interface SortableMappingRowProps {
    mappingKey: string;
    mapping: CombinedBoardColumnMapping;
    isStale: boolean;
    columnId: string;
    onRemove: (columnId: string, mappingKey: string) => void;
}

function SortableMappingRow({ mappingKey, mapping: m, isStale, columnId, onRemove }: SortableMappingRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: mappingKey,
    });

    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 rounded border px-2 py-1 text-xs ${
                isDragging
                    ? "opacity-50 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-900"
                    : "border-gray-100 dark:border-gray-800"
            }`}
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="shrink-0 cursor-grab text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 touch-none"
                aria-label="Drag to reorder"
            >
                <HamburgerIcon width="12" height="12" />
            </button>
            <span className="flex-1 min-w-0 truncate">
                <span className="text-gray-400 dark:text-gray-500">
                    {m.projectName} / {m.teamName} /
                </span>{" "}
                {m.columnName}
            </span>
            {isStale && (
                <WarningIcon title="This source column could not be found. It may have been renamed or deleted in Azure DevOps." />
            )}
            <button
                type="button"
                onClick={() => onRemove(columnId, mappingKey)}
                className="shrink-0 text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                aria-label="Remove mapping"
            >
                ×
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sortable combined column card
// ---------------------------------------------------------------------------

interface SortableColumnCardProps {
    column: CombinedBoardColumn;
    boardColumns: BoardColumnInfo[];
    mappedIds: Set<string>;
    isEditingName: boolean;
    isDuplicateName: boolean;
    activePicker: string | null;
    pickerSearch: string;
    onPickerSearchChange: (value: string) => void;
    onStartEditName: (columnId: string) => void;
    onSaveName: (columnId: string, name: string) => void;
    onCancelEditName: () => void;
    onOpenPicker: (columnId: string) => void;
    onClosePicker: () => void;
    onSelectSourceColumn: (column: BoardColumnInfo) => void;
    onRemoveMapping: (columnId: string, mappingKey: string) => void;
    onReorderMappings: (columnId: string, oldIndex: number, newIndex: number) => void;
    onDeleteColumn: (columnId: string) => void;
    fetchedColumnKeys: Set<string>;
}

function SortableColumnCard({
    column,
    boardColumns,
    mappedIds,
    isEditingName,
    isDuplicateName,
    activePicker,
    pickerSearch,
    onPickerSearchChange,
    onStartEditName,
    onSaveName,
    onCancelEditName,
    onOpenPicker,
    onClosePicker,
    onSelectSourceColumn,
    onRemoveMapping,
    onReorderMappings,
    onDeleteColumn,
    fetchedColumnKeys,
}: SortableColumnCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: column.id,
    });

    const mappingSensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    function handleMappingDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = column.sourceMappings.findIndex(
                (m) => `${m.connectionId}::${m.boardId}::${m.columnId}` === active.id
            );
            const newIndex = column.sourceMappings.findIndex(
                (m) => `${m.connectionId}::${m.boardId}::${m.columnId}` === over.id
            );
            if (oldIndex !== -1 && newIndex !== -1) {
                onReorderMappings(column.id, oldIndex, newIndex);
            }
        }
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-md border bg-white dark:bg-gray-900 ${
                isDragging
                    ? "opacity-50 border-blue-300 dark:border-blue-600"
                    : "border-gray-200 dark:border-gray-700"
            }`}
        >
            {/* Card header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="shrink-0 cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none"
                    aria-label="Drag to reorder"
                >
                    <HamburgerIcon />
                </button>

                {isEditingName ? (
                    <InlineEdit
                        value={column.name}
                        onSave={(name) => onSaveName(column.id, name)}
                        onCancel={onCancelEditName}
                        isDuplicate={isDuplicateName}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => onStartEditName(column.id)}
                        className="flex-1 min-w-0 text-left text-sm font-medium truncate hover:underline focus:outline-none focus:underline"
                        title="Click to rename"
                    >
                        {column.name}
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => onDeleteColumn(column.id)}
                    className="shrink-0 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                >
                    Delete
                </button>
            </div>

            {/* Source mappings */}
            <div className="px-3 py-2 space-y-1">
                {column.sourceMappings.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                        No source columns mapped.
                    </p>
                )}

                <DndContext
                    sensors={mappingSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleMappingDragEnd}
                >
                    <SortableContext
                        items={column.sourceMappings.map((m) => `${m.connectionId}::${m.boardId}::${m.columnId}`)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-1">
                            {column.sourceMappings.map((m) => {
                                const mappingKey = `${m.connectionId}::${m.boardId}::${m.columnId}`;
                                return (
                                    <SortableMappingRow
                                        key={mappingKey}
                                        mappingKey={mappingKey}
                                        mapping={m}
                                        isStale={!fetchedColumnKeys.has(mappingKey)}
                                        columnId={column.id}
                                        onRemove={onRemoveMapping}
                                    />
                                );
                            })}
                        </div>
                    </SortableContext>
                </DndContext>

                {/* Picker trigger */}
                <div className="relative mt-2">
                    <button
                        type="button"
                        onClick={() =>
                            activePicker === column.id ? onClosePicker() : onOpenPicker(column.id)
                        }
                        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 transition-colors"
                    >
                        + Add source column
                    </button>
                    {activePicker === column.id && (
                        <SourceColumnPicker
                            boardColumns={boardColumns}
                            mappedIds={mappedIds}
                            search={pickerSearch}
                            onSearchChange={onPickerSearchChange}
                            onSelect={onSelectSourceColumn}
                            onClose={onClosePicker}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Add-column inline form
// ---------------------------------------------------------------------------

interface AddColumnFormProps {
    existingColumns: CombinedBoardColumn[];
    boardColumns: BoardColumnInfo[];
    mappedIds: Set<string>;
    pickerSearch: string;
    onPickerSearchChange: (value: string) => void;
    onSaveName: (name: string) => void;
    onSaveFromColumn: (column: BoardColumnInfo) => void;
    onCancel: () => void;
}

function AddColumnForm({ existingColumns, boardColumns, mappedIds, pickerSearch, onPickerSearchChange, onSaveName, onSaveFromColumn, onCancel }: AddColumnFormProps) {
    const [name, setName] = useState("");
    const [mode, setMode] = useState<"name" | "pick">("name");
    const nameInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (mode === "name") nameInputRef.current?.focus();
    }, [mode]);

    const isDuplicate = isDuplicateColumnName(existingColumns, name);

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            if (name.trim() && !isDuplicate) {
                onSaveName(name.trim());
            }
        } else if (e.key === "Escape") {
            onCancel();
        }
    }

    function handleBlur() {
        // Don't cancel if focus moved to another element within the form (e.g. the "From remote column" tab)
        setTimeout(() => {
            if (formRef.current && formRef.current.contains(document.activeElement)) return;
            if (document.activeElement === nameInputRef.current) return;
            if (!name.trim() || isDuplicate) {
                onCancel();
            } else {
                onSaveName(name.trim());
            }
        }, 150);
    }

    return (
        <div ref={formRef} className="rounded-md border border-blue-300 bg-white dark:bg-gray-900 dark:border-blue-600 p-3 space-y-2">
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setMode("name")}
                    className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                        mode === "name"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                    Empty column
                </button>
                <button
                    type="button"
                    onClick={() => setMode("pick")}
                    className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                        mode === "pick"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                    From remote column
                </button>
            </div>

            {mode === "name" && (
                <>
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                        placeholder="Column name…"
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                    {isDuplicate && name.trim() && (
                        <p className="text-xs text-red-500">A column with this name already exists.</p>
                    )}
                </>
            )}

            {mode === "pick" && (
                <SourceColumnPicker
                    boardColumns={boardColumns}
                    mappedIds={mappedIds}
                    search={pickerSearch}
                    onSearchChange={onPickerSearchChange}
                    onSelect={onSaveFromColumn}
                    onClose={onCancel}
                    inline
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function CombinedBoardSection() {
    const boardColumns = useAppStore((s) => s.boardColumns);
    const combinedBoardColumns = useAppStore((s) => s.combinedBoardColumns);
    const setCombinedBoardColumns = useAppStore((s) => s.setCombinedBoardColumns);
    const selectedBoards = useAppStore((s) => s.selectedBoards);
    const connections = useAppStore((s) => s.connections);

    const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
    const [isDuplicateName, setIsDuplicateName] = useState(false);
    const [activePicker, setActivePicker] = useState<string | null>(null);
    const [pickerSearch, setPickerSearch] = useState("");
    const [addingColumn, setAddingColumn] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // Detect credentials / boards guard conditions by checking the store
    const hasBoards = selectedBoards.length > 0;

    // Derive the set of fetched column keys to detect stale mappings (composite: connectionId::boardId::columnId)
    const fetchedColumnKeys = useMemo(
        () => new Set(boardColumns.map((c) => `${c.connectionId}::${c.boardId}::${c.columnId}`)),
        [boardColumns]
    );

    const mappedIds = useMemo(
        () => buildMappedColumnIds(combinedBoardColumns),
        [combinedBoardColumns]
    );

    async function persist(columns: CombinedBoardColumn[]) {
        setCombinedBoardColumns(columns);
        await window.electron.saveCombinedBoardColumns(columns);
        toast.success("Combined board saved");
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = combinedBoardColumns.findIndex((c) => c.id === active.id);
            const newIndex = combinedBoardColumns.findIndex((c) => c.id === over.id);
            persist(arrayMove(combinedBoardColumns, oldIndex, newIndex));
        }
    }

    function handleStartEditName(columnId: string) {
        setEditingColumnId(columnId);
        setIsDuplicateName(false);
    }

    function handleSaveName(columnId: string, name: string) {
        const trimmed = name.trim();
        if (!trimmed) {
            setEditingColumnId(null);
            return;
        }
        if (isDuplicateColumnName(combinedBoardColumns, trimmed, columnId)) {
            setIsDuplicateName(true);
            return;
        }
        setIsDuplicateName(false);
        setEditingColumnId(null);
        persist(
            combinedBoardColumns.map((c) =>
                c.id === columnId ? { ...c, name: trimmed } : c
            )
        );
    }

    function handleCancelEditName() {
        setEditingColumnId(null);
        setIsDuplicateName(false);
    }

    function handleSelectSourceColumn(boardColumn: BoardColumnInfo) {
        const mapping: CombinedBoardColumnMapping = {
            connectionId: boardColumn.connectionId,
            boardId: boardColumn.boardId,
            boardName: boardColumn.boardName,
            projectId: boardColumn.projectId,
            projectName: boardColumn.projectName,
            teamId: boardColumn.teamId,
            teamName: boardColumn.teamName,
            columnId: boardColumn.columnId,
            columnName: boardColumn.columnName,
        };
        persist(resolveAutoAssign(combinedBoardColumns, mapping, generateId()));
    }

    function handleRemoveMapping(columnId: string, mappingKey: string) {
        const [connectionId, boardId, colId] = mappingKey.split("::");
        persist(
            combinedBoardColumns.map((col) =>
                col.id !== columnId
                    ? col
                    : {
                          ...col,
                          sourceMappings: col.sourceMappings.filter(
                              (m) => !(m.connectionId === connectionId && m.boardId === boardId && m.columnId === colId)
                          ),
                      }
            )
        );
    }

    function handleReorderMappings(columnId: string, oldIndex: number, newIndex: number) {
        persist(
            combinedBoardColumns.map((col) =>
                col.id !== columnId
                    ? col
                    : { ...col, sourceMappings: arrayMove(col.sourceMappings, oldIndex, newIndex) }
            )
        );
    }

    function handleDeleteColumn(columnId: string) {
        const col = combinedBoardColumns.find((c) => c.id === columnId);
        if (!col) return;
        if (col.sourceMappings.length > 0) {
            setPendingDeleteId(columnId);
        } else {
            persist(combinedBoardColumns.filter((c) => c.id !== columnId));
        }
    }

    function handleConfirmDelete() {
        if (pendingDeleteId) {
            persist(combinedBoardColumns.filter((c) => c.id !== pendingDeleteId));
        }
        setPendingDeleteId(null);
    }

    function handleAddColumnSave(name: string) {
        setAddingColumn(false);
        persist([...combinedBoardColumns, { id: generateId(), name, sourceMappings: [] }]);
    }

    function handleAddColumnFromRemote(boardColumn: BoardColumnInfo) {
        setAddingColumn(false);
        const mapping: CombinedBoardColumnMapping = {
            connectionId: boardColumn.connectionId,
            boardId: boardColumn.boardId,
            boardName: boardColumn.boardName,
            projectId: boardColumn.projectId,
            projectName: boardColumn.projectName,
            teamId: boardColumn.teamId,
            teamName: boardColumn.teamName,
            columnId: boardColumn.columnId,
            columnName: boardColumn.columnName,
        };
        persist(resolveAutoAssign(combinedBoardColumns, mapping, generateId()));
    }

    // Guard: no connections or no boards
    if (connections.length === 0 || !hasBoards) {
        return (
            <div className="flex-1 p-8 space-y-4">
                <h2 className="text-xl font-semibold">Combined Board</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Configure a connection and select at least one remote board before setting up the combined board.
                </p>
            </div>
        );
    }

    const pendingDeleteColumn = combinedBoardColumns.find((c) => c.id === pendingDeleteId);

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Pinned header */}
            <div className="shrink-0 flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
                <h2 className="text-xl font-semibold">Combined Board</h2>
                <button
                    type="button"
                    onClick={() => setAddingColumn(true)}
                    disabled={addingColumn}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
                >
                    Add column
                </button>
            </div>

            {/* Scrollable column list */}
            <div className="flex-1 overflow-y-auto p-8 space-y-3">
                {combinedBoardColumns.length === 0 && !addingColumn && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        No combined columns yet. Add a column or add a source column.
                    </p>
                )}

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={combinedBoardColumns.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-3">
                            {combinedBoardColumns.map((col) => (
                                <SortableColumnCard
                                    key={col.id}
                                    column={col}
                                    boardColumns={boardColumns}
                                    mappedIds={mappedIds}
                                    isEditingName={editingColumnId === col.id}
                                    isDuplicateName={editingColumnId === col.id && isDuplicateName}
                                    activePicker={activePicker}
                                    pickerSearch={pickerSearch}
                                    onPickerSearchChange={setPickerSearch}
                                    onStartEditName={handleStartEditName}
                                    onSaveName={handleSaveName}
                                    onCancelEditName={handleCancelEditName}
                                    onOpenPicker={setActivePicker}
                                    onClosePicker={() => setActivePicker(null)}
                                    onSelectSourceColumn={handleSelectSourceColumn}
                                    onRemoveMapping={handleRemoveMapping}
                                    onReorderMappings={handleReorderMappings}
                                    onDeleteColumn={handleDeleteColumn}
                                    fetchedColumnKeys={fetchedColumnKeys}
                                />
                            ))}

                            {addingColumn && (
                                <AddColumnForm
                                    existingColumns={combinedBoardColumns}
                                    boardColumns={boardColumns}
                                    mappedIds={mappedIds}
                                    pickerSearch={pickerSearch}
                                    onPickerSearchChange={setPickerSearch}
                                    onSaveName={handleAddColumnSave}
                                    onSaveFromColumn={handleAddColumnFromRemote}
                                    onCancel={() => setAddingColumn(false)}
                                />
                            )}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            {pendingDeleteColumn && (
                <DeleteConfirmDialog
                    columnName={pendingDeleteColumn.name}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setPendingDeleteId(null)}
                />
            )}
        </div>
    );
}
