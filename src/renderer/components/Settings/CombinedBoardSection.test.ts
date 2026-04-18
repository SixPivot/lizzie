import { describe, it, expect } from "vitest";
import {
    resolveAutoAssign,
    isDuplicateColumnName,
    buildMappedColumnIds,
} from "./CombinedBoardSection";
import type { CombinedBoardColumn, CombinedBoardColumnMapping } from "../../../shared/electronAPI";

function makeColumn(overrides: Partial<CombinedBoardColumn> = {}): CombinedBoardColumn {
    return {
        id: "col-1",
        name: "Backlog",
        sourceMappings: [],
        ...overrides,
    };
}

function makeMapping(overrides: Partial<CombinedBoardColumnMapping> = {}): CombinedBoardColumnMapping {
    return {
        connectionId: "conn-1",
        boardId: "board-1",
        boardName: "Stories",
        projectId: "proj-1",
        projectName: "Alpha",
        teamId: "team-1",
        teamName: "Alpha Team",
        columnId: "c-1",
        columnName: "Backlog",
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// resolveAutoAssign
// ---------------------------------------------------------------------------

describe("resolveAutoAssign", () => {
    it("adds mapping to matching combined column (exact case)", () => {
        const columns = [makeColumn({ id: "col-1", name: "Backlog" })];
        const mapping = makeMapping({ columnName: "Backlog" });
        const result = resolveAutoAssign(columns, mapping, "new-id");
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("col-1");
        expect(result[0].sourceMappings).toHaveLength(1);
        expect(result[0].sourceMappings[0]).toEqual(mapping);
    });

    it("adds mapping to matching combined column (case-insensitive)", () => {
        const columns = [makeColumn({ id: "col-1", name: "BACKLOG" })];
        const mapping = makeMapping({ columnName: "backlog" });
        const result = resolveAutoAssign(columns, mapping, "new-id");
        expect(result).toHaveLength(1);
        expect(result[0].sourceMappings).toHaveLength(1);
    });

    it("creates a new combined column when no name match exists", () => {
        const columns = [makeColumn({ id: "col-1", name: "Backlog" })];
        const mapping = makeMapping({ columnName: "In Progress", columnId: "c-2" });
        const result = resolveAutoAssign(columns, mapping, "new-id");
        expect(result).toHaveLength(2);
        expect(result[1].id).toBe("new-id");
        expect(result[1].name).toBe("In Progress");
        expect(result[1].sourceMappings).toHaveLength(1);
    });

    it("creates the first combined column when starting from empty", () => {
        const result = resolveAutoAssign([], makeMapping({ columnName: "Backlog" }), "new-id");
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("new-id");
        expect(result[0].name).toBe("Backlog");
    });

    it("does not mutate the original columns array", () => {
        const columns = [makeColumn()];
        const mapping = makeMapping();
        resolveAutoAssign(columns, mapping, "new-id");
        expect(columns[0].sourceMappings).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// isDuplicateColumnName
// ---------------------------------------------------------------------------

describe("isDuplicateColumnName", () => {
    const columns = [
        makeColumn({ id: "col-1", name: "Backlog" }),
        makeColumn({ id: "col-2", name: "In Progress" }),
    ];

    it("returns true when the same name already exists", () => {
        expect(isDuplicateColumnName(columns, "Backlog")).toBe(true);
    });

    it("is case-insensitive", () => {
        expect(isDuplicateColumnName(columns, "backlog")).toBe(true);
        expect(isDuplicateColumnName(columns, "IN PROGRESS")).toBe(true);
    });

    it("returns false when the name is unique", () => {
        expect(isDuplicateColumnName(columns, "Done")).toBe(false);
    });

    it("excludes the column being renamed (edit-in-place scenario)", () => {
        // col-1 renaming to its own name should NOT be a duplicate
        expect(isDuplicateColumnName(columns, "Backlog", "col-1")).toBe(false);
    });

    it("still detects duplicates when excludeId is a different column", () => {
        // col-2 renaming to "Backlog" — that IS a duplicate from col-1
        expect(isDuplicateColumnName(columns, "Backlog", "col-2")).toBe(true);
    });

    it("trims the name before comparison", () => {
        expect(isDuplicateColumnName(columns, "  Backlog  ")).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// buildMappedColumnIds
// ---------------------------------------------------------------------------

describe("buildMappedColumnIds", () => {
    it("returns an empty set when no columns exist", () => {
        expect(buildMappedColumnIds([])).toEqual(new Set());
    });

    it("returns an empty set when no mappings exist", () => {
        const columns = [makeColumn({ sourceMappings: [] })];
        expect(buildMappedColumnIds(columns)).toEqual(new Set());
    });

    it("includes all mapped connectionId::boardId::columnId keys", () => {
        const columns = [
            makeColumn({
                id: "col-1",
                sourceMappings: [makeMapping({ connectionId: "conn-1", boardId: "b1", columnId: "c1" })],
            }),
            makeColumn({
                id: "col-2",
                sourceMappings: [
                    makeMapping({ connectionId: "conn-1", boardId: "b1", columnId: "c2" }),
                    makeMapping({ connectionId: "conn-2", boardId: "b2", columnId: "c3" }),
                ],
            }),
        ];
        const result = buildMappedColumnIds(columns);
        expect(result).toEqual(new Set(["conn-1::b1::c1", "conn-1::b1::c2", "conn-2::b2::c3"]));
    });

    it("excludes columns from the picker that are already mapped", () => {
        const columns = [
            makeColumn({
                sourceMappings: [makeMapping({ connectionId: "conn-1", boardId: "b1", columnId: "c1" })],
            }),
        ];
        const mappedIds = buildMappedColumnIds(columns);
        expect(mappedIds.has("conn-1::b1::c1")).toBe(true);
        expect(mappedIds.has("conn-1::b1::c2")).toBe(false);
    });
});
