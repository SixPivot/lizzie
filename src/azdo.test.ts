import { describe, it, expect, vi, beforeEach } from "vitest";
import { testConnection, fetchAvailableBoards, type ConnectionTestResult } from "./azdo";

// vi.hoisted runs before module resolution, making mocks available in the vi.mock factory
const connectMock = vi.hoisted(() => vi.fn());
const getCoreApiMock = vi.hoisted(() => vi.fn());
const getWorkApiMock = vi.hoisted(() => vi.fn());

vi.mock("azure-devops-node-api", () => {
    class WebApi {
        connect = connectMock;
        getCoreApi = getCoreApiMock;
        getWorkApi = getWorkApiMock;
    }
    return {
        WebApi,
        getPersonalAccessTokenHandler: vi.fn(() => ({})),
    };
});

describe("testConnection", () => {
    beforeEach(() => {
        connectMock.mockReset();
    });

    it("returns success when connect resolves", async () => {
        connectMock.mockResolvedValue({});
        const result: ConnectionTestResult = await testConnection({
            orgUrl: "https://dev.azure.com/myorg",
            pat: "validpat",
        });
        expect(result.success).toBe(true);
    });

    it("returns pat error for 401 status", async () => {
        const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://dev.azure.com/myorg", pat: "badpat" });
        expect(result.success).toBe(false);
        expect(result.errorField).toBe("pat");
        expect(result.error).toBe("Invalid PAT or insufficient permissions.");
    });

    it("returns pat error for 403 status", async () => {
        const err = Object.assign(new Error("Forbidden"), { statusCode: 403 });
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://dev.azure.com/myorg", pat: "badpat" });
        expect(result.success).toBe(false);
        expect(result.errorField).toBe("pat");
    });

    it("returns orgUrl error for ENOTFOUND network error", async () => {
        const err = new Error("getaddrinfo ENOTFOUND dev.azure.com");
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://bad-url.example", pat: "somepat" });
        expect(result.success).toBe(false);
        expect(result.errorField).toBe("orgUrl");
        expect(result.error).toContain("Could not reach");
    });

    it("returns orgUrl error for ECONNREFUSED", async () => {
        const err = new Error("connect ECONNREFUSED 127.0.0.1:443");
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://localhost", pat: "somepat" });
        expect(result.success).toBe(false);
        expect(result.errorField).toBe("orgUrl");
    });

    it("returns pat error with raw message for unknown errors", async () => {
        const err = new Error("Something went wrong");
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://dev.azure.com/myorg", pat: "somepat" });
        expect(result.success).toBe(false);
        expect(result.error).toBe("Something went wrong");
        expect(result.errorField).toBe("pat");
    });
});

describe("fetchAvailableBoards", () => {
    const makeGetProjectsMock = vi.fn();
    const makeGetTeamsMock = vi.fn();
    const makeGetBoardsMock = vi.fn();

    beforeEach(() => {
        makeGetProjectsMock.mockReset();
        makeGetTeamsMock.mockReset();
        makeGetBoardsMock.mockReset();

        getCoreApiMock.mockResolvedValue({
            getProjects: makeGetProjectsMock,
            getTeams: makeGetTeamsMock,
        });
        getWorkApiMock.mockResolvedValue({
            getBoards: makeGetBoardsMock,
        });
    });

    it("returns a flat sorted list of boards from all projects and teams", async () => {
        makeGetProjectsMock.mockResolvedValue([
            { id: "proj-1", name: "Alpha Project" },
            { id: "proj-2", name: "Beta Project" },
        ]);
        makeGetTeamsMock.mockImplementation((projectId: string) => {
            if (projectId === "proj-1") {
                return Promise.resolve([
                    { id: "team-1a", name: "Alpha Team" },
                    { id: "team-1b", name: "Beta Team" },
                ]);
            }
            return Promise.resolve([{ id: "team-2a", name: "Gamma Team" }]);
        });
        makeGetBoardsMock.mockImplementation(({ teamId }: { teamId: string }) => {
            if (teamId === "team-1a") return Promise.resolve([{ id: "board-1", name: "Stories" }, { id: "board-x", name: "Epics" }]);
            if (teamId === "team-1b") return Promise.resolve([{ id: "board-2", name: "Stories" }]);
            if (teamId === "team-2a") return Promise.resolve([{ id: "board-3", name: "Stories" }, { id: "board-y", name: "Features" }]);
            return Promise.resolve([]);
        });

        const result = await fetchAvailableBoards({ orgUrl: "https://dev.azure.com/myorg", pat: "pat" });

        expect(result).toHaveLength(3);

        // Sorted by projectName then boardName; non-Stories boards excluded
        expect(result[0]).toMatchObject({ projectName: "Alpha Project", boardName: "Stories", boardId: "board-1", teamId: "team-1a" });
        expect(result[1]).toMatchObject({ projectName: "Alpha Project", boardName: "Stories", boardId: "board-2", teamId: "team-1b" });
        expect(result[2]).toMatchObject({ projectName: "Beta Project", boardName: "Stories", boardId: "board-3", teamId: "team-2a" });
    });

    it("returns an empty array when the organisation has no projects", async () => {
        makeGetProjectsMock.mockResolvedValue([]);

        const result = await fetchAvailableBoards({ orgUrl: "https://dev.azure.com/myorg", pat: "pat" });

        expect(result).toEqual([]);
    });

    it("returns an empty array when projects have no teams", async () => {
        makeGetProjectsMock.mockResolvedValue([{ id: "proj-1", name: "Alpha Project" }]);
        makeGetTeamsMock.mockResolvedValue([]);

        const result = await fetchAvailableBoards({ orgUrl: "https://dev.azure.com/myorg", pat: "pat" });

        expect(result).toEqual([]);
    });

    it("returns an empty array when teams have no boards", async () => {
        makeGetProjectsMock.mockResolvedValue([{ id: "proj-1", name: "Alpha Project" }]);
        makeGetTeamsMock.mockResolvedValue([{ id: "team-1", name: "Alpha Team" }]);
        makeGetBoardsMock.mockResolvedValue([]);

        const result = await fetchAvailableBoards({ orgUrl: "https://dev.azure.com/myorg", pat: "pat" });

        expect(result).toEqual([]);
    });

    it("propagates errors from the AzDO API", async () => {
        makeGetProjectsMock.mockRejectedValue(new Error("API unavailable"));

        await expect(
            fetchAvailableBoards({ orgUrl: "https://dev.azure.com/myorg", pat: "pat" })
        ).rejects.toThrow("API unavailable");
    });

    it("skips boards or teams with missing id or name", async () => {
        makeGetProjectsMock.mockResolvedValue([{ id: "proj-1", name: "Alpha Project" }]);
        makeGetTeamsMock.mockResolvedValue([
            { id: "team-1", name: "Alpha Team" },
            { id: undefined, name: "Nameless Team" },
        ]);
        makeGetBoardsMock.mockResolvedValue([
            { id: "board-1", name: "Stories" },
            { id: "board-2", name: undefined },
            { id: "board-3", name: "Epics" },
        ]);

        const result = await fetchAvailableBoards({ orgUrl: "https://dev.azure.com/myorg", pat: "pat" });

        expect(result).toHaveLength(1);
        expect(result[0].boardId).toBe("board-1");
    });
});


describe("testConnection", () => {
    beforeEach(() => {
        connectMock.mockReset();
    });

    it("returns success when connect resolves", async () => {
        connectMock.mockResolvedValue({});
        const result: ConnectionTestResult = await testConnection({
            orgUrl: "https://dev.azure.com/myorg",
            pat: "validpat",
        });
        expect(result.success).toBe(true);
    });

    it("returns pat error for 401 status", async () => {
        const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://dev.azure.com/myorg", pat: "badpat" });
        expect(result.success).toBe(false);
        expect(result.errorField).toBe("pat");
        expect(result.error).toBe("Invalid PAT or insufficient permissions.");
    });

    it("returns pat error for 403 status", async () => {
        const err = Object.assign(new Error("Forbidden"), { statusCode: 403 });
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://dev.azure.com/myorg", pat: "badpat" });
        expect(result.success).toBe(false);
        expect(result.errorField).toBe("pat");
    });

    it("returns orgUrl error for ENOTFOUND network error", async () => {
        const err = new Error("getaddrinfo ENOTFOUND dev.azure.com");
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://bad-url.example", pat: "somepat" });
        expect(result.success).toBe(false);
        expect(result.errorField).toBe("orgUrl");
        expect(result.error).toContain("Could not reach");
    });

    it("returns orgUrl error for ECONNREFUSED", async () => {
        const err = new Error("connect ECONNREFUSED 127.0.0.1:443");
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://localhost", pat: "somepat" });
        expect(result.success).toBe(false);
        expect(result.errorField).toBe("orgUrl");
    });

    it("returns pat error with raw message for unknown errors", async () => {
        const err = new Error("Something went wrong");
        connectMock.mockRejectedValue(err);
        const result = await testConnection({ orgUrl: "https://dev.azure.com/myorg", pat: "somepat" });
        expect(result.success).toBe(false);
        expect(result.error).toBe("Something went wrong");
        expect(result.errorField).toBe("pat");
    });
});

