import { describe, expect, it } from "vitest";
import { buildWorkItemCardKey, filterCardsBySearch } from "./CombinedBoardPage";
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

describe("filterCardsBySearch", () => {
    it("returns all cards when query is empty", () => {
        const cards = [
            makeCard({ fields: { "System.Title": "Fix login bug" } }),
            makeCard({ id: 102, fields: { "System.Title": "Add dashboard" } }),
        ];
        expect(filterCardsBySearch(cards, "")).toEqual(cards);
        expect(filterCardsBySearch(cards, "   ")).toEqual(cards);
    });

    it("filters by title (case-insensitive)", () => {
        const match = makeCard({ fields: { "System.Title": "Fix Login Bug" } });
        const noMatch = makeCard({ id: 102, fields: { "System.Title": "Add dashboard" } });
        const result = filterCardsBySearch([match, noMatch], "login");
        expect(result).toEqual([match]);
    });

    it("filters by description text (case-insensitive)", () => {
        const match = makeCard({ fields: { "System.Title": "Card A", "System.Description": "Reproduce the error on mobile" } });
        const noMatch = makeCard({ id: 102, fields: { "System.Title": "Card B", "System.Description": "Nothing relevant" } });
        const result = filterCardsBySearch([match, noMatch], "mobile");
        expect(result).toEqual([match]);
    });

    it("strips HTML tags from description before matching", () => {
        const match = makeCard({
            fields: {
                "System.Title": "Card A",
                "System.Description": "<p>Steps to <strong>reproduce</strong> the issue</p>",
            },
        });
        const noMatch = makeCard({ id: 102, fields: { "System.Title": "Card B", "System.Description": "<p>Unrelated</p>" } });
        expect(filterCardsBySearch([match, noMatch], "reproduce")).toEqual([match]);
    });

    it("does not match HTML tag names", () => {
        const card = makeCard({
            fields: {
                "System.Title": "Card A",
                "System.Description": "<p>Some content</p>",
            },
        });
        expect(filterCardsBySearch([card], "strong")).toEqual([]);
    });

    it("returns cards matching either title or description", () => {
        const titleMatch = makeCard({ fields: { "System.Title": "Deploy service", "System.Description": "No detail" } });
        const descMatch = makeCard({ id: 102, fields: { "System.Title": "Unrelated", "System.Description": "Deploy the application" } });
        const noMatch = makeCard({ id: 103, fields: { "System.Title": "Other", "System.Description": "Something else" } });
        const result = filterCardsBySearch([titleMatch, descMatch, noMatch], "deploy");
        expect(result).toEqual([titleMatch, descMatch]);
    });

    it("handles cards with missing title and description fields", () => {
        const card = makeCard({ fields: {} });
        expect(filterCardsBySearch([card], "anything")).toEqual([]);
    });
});