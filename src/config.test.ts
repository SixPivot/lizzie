import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// Mock Electron modules
const encryptString = vi.fn((s: string) => Buffer.from(`enc:${s}`, "utf-8"));
const decryptString = vi.fn((buf: Buffer) => buf.toString("utf-8").replace(/^enc:/, ""));
const isEncryptionAvailable = vi.fn(() => true);

vi.mock("electron", () => ({
    app: {
        getPath: vi.fn(() => "/fake/userData"),
    },
    safeStorage: {
        isEncryptionAvailable,
        encryptString,
        decryptString,
    },
}));

// Mock fs
const existsSync = vi.fn(() => false);
const readFileSync = vi.fn(() => "{}");
const writeFileSync = vi.fn();

vi.mock("node:fs", () => ({
    default: { existsSync, readFileSync, writeFileSync },
}));

// Mock crypto
vi.mock("node:crypto", () => ({
    randomUUID: vi.fn(() => "test-uuid-1234"),
}));

const EXPECTED_CONFIG_PATH = path.join("/fake/userData", "config.json");

async function importConfig() {
    return await import("./config");
}

// ---------------------------------------------------------------------------
// loadConfig (compat function reading first connection)
// ---------------------------------------------------------------------------

describe("loadConfig", () => {
    beforeEach(() => {
        vi.resetModules();
        existsSync.mockReturnValue(false);
        readFileSync.mockReturnValue("{}");
        isEncryptionAvailable.mockReturnValue(true);
        writeFileSync.mockClear();
    });

    it("returns nulls when config file does not exist", async () => {
        existsSync.mockReturnValue(false);
        const { loadConfig } = await importConfig();
        const result = loadConfig();
        expect(result).toEqual({ orgUrl: null, pat: null });
    });

    it("returns nulls when config file is corrupt JSON", async () => {
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue("not-json");
        const { loadConfig } = await importConfig();
        const result = loadConfig();
        expect(result).toEqual({ orgUrl: null, pat: null });
    });

    it("migrates legacy config and returns orgUrl and pat from first connection", async () => {
        const fakeEncrypted = Buffer.from("enc:mysecretpat", "utf-8").toString("base64");
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(
            JSON.stringify({ orgUrl: "https://dev.azure.com/myorg", encryptedPat: fakeEncrypted })
        );
        isEncryptionAvailable.mockReturnValue(true);
        decryptString.mockReturnValue("mysecretpat");
        const { loadConfig } = await importConfig();
        const result = loadConfig();
        expect(result.orgUrl).toBe("https://dev.azure.com/myorg");
        expect(result.pat).toBe("mysecretpat");
    });

    it("returns nulls when no connections configured", async () => {
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(JSON.stringify({ connections: [] }));
        const { loadConfig } = await importConfig();
        expect(loadConfig()).toEqual({ orgUrl: null, pat: null });
    });

    it("reads PAT as plain base64 when safeStorage is unavailable", async () => {
        const plainBase64 = Buffer.from("fallbackpat", "utf-8").toString("base64");
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(
            JSON.stringify({
                connections: [
                    { id: "c1", name: "Test", orgUrl: "https://dev.azure.com/myorg", encryptedPat: plainBase64 },
                ],
            })
        );
        isEncryptionAvailable.mockReturnValue(false);
        const { loadConfig } = await importConfig();
        const result = loadConfig();
        expect(result.pat).toBe("fallbackpat");
    });

    it("returns null PAT and logs warning when decryption throws", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const fakeEncrypted = Buffer.from("garbage", "utf-8").toString("base64");
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(
            JSON.stringify({
                connections: [
                    { id: "c1", name: "Test", orgUrl: "https://dev.azure.com/myorg", encryptedPat: fakeEncrypted },
                ],
            })
        );
        isEncryptionAvailable.mockReturnValue(true);
        decryptString.mockImplementation(() => { throw new Error("decrypt failed"); });
        const { loadConfig } = await importConfig();
        const result = loadConfig();
        expect(result.pat).toBeNull();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// migrateConfig
// ---------------------------------------------------------------------------

describe("migrateConfig", () => {
    beforeEach(() => {
        vi.resetModules();
        writeFileSync.mockClear();
    });

    it("migrates legacy orgUrl/encryptedPat to a connection named Connection 1", async () => {
        const { migrateConfig } = await importConfig();
        const raw = { orgUrl: "https://dev.azure.com/myorg", encryptedPat: "abc123" };
        const result = migrateConfig(raw);
        expect(result.connections).toHaveLength(1);
        expect(result.connections![0].name).toBe("Connection 1");
        expect(result.connections![0].orgUrl).toBe("https://dev.azure.com/myorg");
        expect(result.connections![0].encryptedPat).toBe("abc123");
        expect(result.orgUrl).toBeUndefined();
        expect(result.encryptedPat).toBeUndefined();
    });

    it("stamps connectionId onto existing selectedBoards during migration", async () => {
        const { migrateConfig } = await importConfig();
        const raw = {
            orgUrl: "https://dev.azure.com/myorg",
            encryptedPat: "abc123",
            selectedBoards: [
                { projectId: "p1", projectName: "Proj", teamId: "t1", teamName: "Team", boardId: "b1", boardName: "Stories" },
            ],
        };
        const result = migrateConfig(raw as never);
        const connectionId = result.connections![0].id;
        expect(result.selectedBoards![0].connectionId).toBe(connectionId);
    });

    it("stamps connectionId onto existing combinedBoardColumn mappings during migration", async () => {
        const { migrateConfig } = await importConfig();
        const raw = {
            orgUrl: "https://dev.azure.com/myorg",
            encryptedPat: "abc123",
            combinedBoardColumns: [
                {
                    id: "col-1",
                    name: "Backlog",
                    sourceMappings: [
                        { boardId: "b1", boardName: "Stories", projectId: "p1", projectName: "Proj", teamId: "t1", teamName: "Team", columnId: "c1", columnName: "Active" },
                    ],
                },
            ],
        };
        const result = migrateConfig(raw as never);
        const connectionId = result.connections![0].id;
        expect(result.combinedBoardColumns![0].sourceMappings[0].connectionId).toBe(connectionId);
    });

    it("does not re-migrate an already-migrated config", async () => {
        const { migrateConfig } = await importConfig();
        const raw = {
            connections: [
                { id: "existing-id", name: "My Org", orgUrl: "https://dev.azure.com/myorg", encryptedPat: "abc123" },
            ],
        };
        const result = migrateConfig(raw);
        expect(result.connections).toHaveLength(1);
        expect(result.connections![0].id).toBe("existing-id");
    });

    it("returns the config unchanged when no legacy fields present and no connections", async () => {
        const { migrateConfig } = await importConfig();
        const raw = { theme: "dark" as const };
        const result = migrateConfig(raw);
        expect(result).toEqual({ theme: "dark" });
    });
});

// ---------------------------------------------------------------------------
// isOrgUrlTaken
// ---------------------------------------------------------------------------

describe("isOrgUrlTaken", () => {
    beforeEach(() => {
        vi.resetModules();
        existsSync.mockReturnValue(true);
        writeFileSync.mockClear();
    });

    it("returns false when no connections exist", async () => {
        readFileSync.mockReturnValue(JSON.stringify({ connections: [] }));
        const { isOrgUrlTaken } = await importConfig();
        expect(isOrgUrlTaken("https://dev.azure.com/myorg")).toBe(false);
    });

    it("returns true for an exact match", async () => {
        readFileSync.mockReturnValue(JSON.stringify({
            connections: [{ id: "c1", name: "Test", orgUrl: "https://dev.azure.com/myorg", encryptedPat: "x" }],
        }));
        const { isOrgUrlTaken } = await importConfig();
        expect(isOrgUrlTaken("https://dev.azure.com/myorg")).toBe(true);
    });

    it("returns true for a case-insensitive match", async () => {
        readFileSync.mockReturnValue(JSON.stringify({
            connections: [{ id: "c1", name: "Test", orgUrl: "https://DEV.AZURE.COM/myorg", encryptedPat: "x" }],
        }));
        const { isOrgUrlTaken } = await importConfig();
        expect(isOrgUrlTaken("https://dev.azure.com/myorg")).toBe(true);
    });

    it("returns false when excludeId matches the connection", async () => {
        readFileSync.mockReturnValue(JSON.stringify({
            connections: [{ id: "c1", name: "Test", orgUrl: "https://dev.azure.com/myorg", encryptedPat: "x" }],
        }));
        const { isOrgUrlTaken } = await importConfig();
        expect(isOrgUrlTaken("https://dev.azure.com/myorg", "c1")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// addConnection / loadConnections
// ---------------------------------------------------------------------------

describe("addConnection and loadConnections", () => {
    beforeEach(() => {
        vi.resetModules();
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(JSON.stringify({ connections: [] }));
        writeFileSync.mockClear();
        encryptString.mockReturnValue(Buffer.from("enc:mypat", "utf-8"));
        isEncryptionAvailable.mockReturnValue(true);
    });

    it("adds a connection and persists it", async () => {
        const { addConnection } = await importConfig();
        const summary = addConnection({ name: "My Org", orgUrl: "https://dev.azure.com/myorg", pat: "mypat" });
        expect(summary.name).toBe("My Org");
        expect(summary.orgUrl).toBe("https://dev.azure.com/myorg");
        expect(summary.id).toBeTruthy();
        const written = JSON.parse(writeFileSync.mock.calls[0][1] as string);
        expect(written.connections).toHaveLength(1);
        expect(written.connections[0].name).toBe("My Org");
    });

    it("loadConnections returns summaries without encrypted PAT", async () => {
        readFileSync.mockReturnValue(JSON.stringify({
            connections: [
                { id: "c1", name: "My Org", orgUrl: "https://dev.azure.com/myorg", encryptedPat: "secret" },
            ],
        }));
        const { loadConnections } = await importConfig();
        const result = loadConnections();
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ id: "c1", name: "My Org", orgUrl: "https://dev.azure.com/myorg" });
        expect((result[0] as Record<string, unknown>).encryptedPat).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// removeConnection
// ---------------------------------------------------------------------------

describe("removeConnection", () => {
    beforeEach(() => {
        vi.resetModules();
        existsSync.mockReturnValue(true);
        writeFileSync.mockClear();
    });

    it("removes the connection by id and persists", async () => {
        readFileSync.mockReturnValue(JSON.stringify({
            connections: [
                { id: "c1", name: "A", orgUrl: "https://dev.azure.com/a", encryptedPat: "x" },
                { id: "c2", name: "B", orgUrl: "https://dev.azure.com/b", encryptedPat: "y" },
            ],
        }));
        const { removeConnection } = await importConfig();
        removeConnection("c1");
        const written = JSON.parse(writeFileSync.mock.calls[0][1] as string);
        expect(written.connections).toHaveLength(1);
        expect(written.connections[0].id).toBe("c2");
    });

    it("prunes selectedBoards belonging to the removed connection", async () => {
        readFileSync.mockReturnValue(JSON.stringify({
            connections: [{ id: "c1", name: "A", orgUrl: "https://dev.azure.com/a", encryptedPat: "x" }],
            selectedBoards: [
                { connectionId: "c1", projectId: "p1", projectName: "Proj", teamId: "t1", teamName: "Team", boardId: "b1", boardName: "Stories" },
                { connectionId: "c2", projectId: "p1", projectName: "Proj", teamId: "t1", teamName: "Team", boardId: "b2", boardName: "Stories" },
            ],
        }));
        const { removeConnection } = await importConfig();
        removeConnection("c1");
        const written = JSON.parse(writeFileSync.mock.calls[0][1] as string);
        expect(written.selectedBoards).toHaveLength(1);
        expect(written.selectedBoards[0].connectionId).toBe("c2");
    });

    it("prunes column mappings belonging to the removed connection", async () => {
        readFileSync.mockReturnValue(JSON.stringify({
            connections: [{ id: "c1", name: "A", orgUrl: "https://dev.azure.com/a", encryptedPat: "x" }],
            combinedBoardColumns: [
                {
                    id: "col-1",
                    name: "Backlog",
                    sourceMappings: [
                        { connectionId: "c1", boardId: "b1", boardName: "S", projectId: "p1", projectName: "P", teamId: "t1", teamName: "T", columnId: "c1", columnName: "Active" },
                        { connectionId: "c2", boardId: "b2", boardName: "S", projectId: "p1", projectName: "P", teamId: "t1", teamName: "T", columnId: "c2", columnName: "Active" },
                    ],
                },
            ],
        }));
        const { removeConnection } = await importConfig();
        removeConnection("c1");
        const written = JSON.parse(writeFileSync.mock.calls[0][1] as string);
        expect(written.combinedBoardColumns[0].sourceMappings).toHaveLength(1);
        expect(written.combinedBoardColumns[0].sourceMappings[0].connectionId).toBe("c2");
    });
});

// ---------------------------------------------------------------------------
// loadCombinedBoardColumns
// ---------------------------------------------------------------------------

describe("loadCombinedBoardColumns", () => {
    beforeEach(() => {
        vi.resetModules();
        existsSync.mockReturnValue(true);
    });

    it("returns empty array when config file has no combinedBoardColumns", async () => {
        readFileSync.mockReturnValue(JSON.stringify({}));
        const { loadCombinedBoardColumns } = await importConfig();
        expect(loadCombinedBoardColumns()).toEqual([]);
    });

    it("returns the stored combined board columns", async () => {
        const columns = [
            { id: "col-1", name: "Backlog", sourceMappings: [] },
            { id: "col-2", name: "In Progress", sourceMappings: [] },
        ];
        readFileSync.mockReturnValue(JSON.stringify({ combinedBoardColumns: columns }));
        const { loadCombinedBoardColumns } = await importConfig();
        expect(loadCombinedBoardColumns()).toEqual(columns);
    });

    it("returns empty array when config file does not exist", async () => {
        existsSync.mockReturnValue(false);
        const { loadCombinedBoardColumns } = await importConfig();
        expect(loadCombinedBoardColumns()).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// saveCombinedBoardColumns
// ---------------------------------------------------------------------------

describe("saveCombinedBoardColumns", () => {
    beforeEach(() => {
        vi.resetModules();
        writeFileSync.mockClear();
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(JSON.stringify({}));
    });

    it("writes combinedBoardColumns to config.json", async () => {
        const columns = [{ id: "col-1", name: "Backlog", sourceMappings: [] }];
        const { saveCombinedBoardColumns } = await importConfig();
        saveCombinedBoardColumns(columns);
        const written = JSON.parse(writeFileSync.mock.calls[0][1] as string);
        expect(written.combinedBoardColumns).toEqual(columns);
    });

    it("preserves other config fields when saving combined columns", async () => {
        readFileSync.mockReturnValue(
            JSON.stringify({ connections: [{ id: "c1", name: "Test", orgUrl: "https://dev.azure.com/myorg", encryptedPat: "x" }] })
        );
        const { saveCombinedBoardColumns } = await importConfig();
        saveCombinedBoardColumns([{ id: "col-1", name: "Backlog", sourceMappings: [] }]);
        const written = JSON.parse(writeFileSync.mock.calls[0][1] as string);
        expect(written.connections).toHaveLength(1);
        expect(written.combinedBoardColumns).toHaveLength(1);
    });

    it("overwrites the previously stored combined columns", async () => {
        const existing = [{ id: "col-1", name: "Backlog", sourceMappings: [] }];
        readFileSync.mockReturnValue(JSON.stringify({ combinedBoardColumns: existing }));
        const { saveCombinedBoardColumns } = await importConfig();
        const updated = [{ id: "col-2", name: "Done", sourceMappings: [] }];
        saveCombinedBoardColumns(updated);
        const written = JSON.parse(writeFileSync.mock.calls[0][1] as string);
        expect(written.combinedBoardColumns).toEqual(updated);
    });
});
