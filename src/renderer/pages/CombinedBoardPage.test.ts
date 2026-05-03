import { describe, expect, it } from "vitest";
import { buildWorkItemCardKey } from "./CombinedBoardPage";
import type { WorkItemCard } from "../../shared/electronAPI";

function makeCard(overrides: Partial<WorkItemCard> = {}): WorkItemCard {
    return {
        id: 101,
        connectionId: "conn-1",
        boardId: "board-1",
        columnName: "Backlog",
        boardOrder: 1,
        teamName: "Alpha Team",
        projectName: "Alpha",
        orgUrl: "https://dev.azure.com/alpha",
        fields: {},
        ...overrides,
    };
}

describe("buildWorkItemCardKey", () => {
    it("includes connectionId so identical board and work item ids stay distinct across orgs", () => {
        const first = makeCard({ connectionId: "conn-1", boardId: "shared-board", id: 42 });
        const second = makeCard({ connectionId: "conn-2", boardId: "shared-board", id: 42 });

        expect(buildWorkItemCardKey(first)).not.toBe(buildWorkItemCardKey(second));
        expect(buildWorkItemCardKey(first)).toBe("conn-1::shared-board::42");
        expect(buildWorkItemCardKey(second)).toBe("conn-2::shared-board::42");
    });
});