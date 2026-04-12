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

const EXPECTED_CONFIG_PATH = path.join("/fake/userData", "config.json");

async function importConfig() {
    return await import("./config");
}

describe("loadConfig", () => {
    beforeEach(() => {
        vi.resetModules();
        existsSync.mockReturnValue(false);
        readFileSync.mockReturnValue("{}");
        isEncryptionAvailable.mockReturnValue(true);
    });

    it("returns nulls when config file does not exist", async () => {
        existsSync.mockReturnValue(false);
        const { loadConfig } = await importConfig();
        const result = await loadConfig();
        expect(result).toEqual({ orgUrl: null, pat: null });
    });

    it("returns nulls when config file is corrupt JSON", async () => {
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue("not-json");
        const { loadConfig } = await importConfig();
        const result = await loadConfig();
        expect(result).toEqual({ orgUrl: null, pat: null });
    });

    it("returns orgUrl and null pat when encryptedPat is missing", async () => {
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(JSON.stringify({ orgUrl: "https://dev.azure.com/myorg" }));
        const { loadConfig } = await importConfig();
        const result = await loadConfig();
        expect(result.orgUrl).toBe("https://dev.azure.com/myorg");
        expect(result.pat).toBeNull();
    });

    it("decrypts PAT using safeStorage when available", async () => {
        const fakeEncrypted = Buffer.from("enc:mysecretpat", "utf-8").toString("base64");
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(
            JSON.stringify({ orgUrl: "https://dev.azure.com/myorg", encryptedPat: fakeEncrypted })
        );
        isEncryptionAvailable.mockReturnValue(true);
        decryptString.mockReturnValue("mysecretpat");
        const { loadConfig } = await importConfig();
        const result = await loadConfig();
        expect(result.pat).toBe("mysecretpat");
        expect(decryptString).toHaveBeenCalled();
    });

    it("reads PAT as plain base64 when safeStorage is unavailable", async () => {
        const plainBase64 = Buffer.from("fallbackpat", "utf-8").toString("base64");
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(
            JSON.stringify({ orgUrl: "https://dev.azure.com/myorg", encryptedPat: plainBase64 })
        );
        isEncryptionAvailable.mockReturnValue(false);
        const { loadConfig } = await importConfig();
        const result = await loadConfig();
        expect(result.pat).toBe("fallbackpat");
    });

    it("returns null PAT and logs warning when decryption throws", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const fakeEncrypted = Buffer.from("garbage", "utf-8").toString("base64");
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(
            JSON.stringify({ orgUrl: "https://dev.azure.com/myorg", encryptedPat: fakeEncrypted })
        );
        isEncryptionAvailable.mockReturnValue(true);
        decryptString.mockImplementation(() => { throw new Error("decrypt failed"); });
        const { loadConfig } = await importConfig();
        const result = await loadConfig();
        expect(result.pat).toBeNull();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe("saveConfig", () => {
    beforeEach(() => {
        vi.resetModules();
        writeFileSync.mockClear();
        encryptString.mockClear();
        isEncryptionAvailable.mockReturnValue(true);
    });

    it("encrypts PAT and writes config.json when safeStorage is available", async () => {
        encryptString.mockReturnValue(Buffer.from("enc:mypat", "utf-8"));
        const { saveConfig } = await importConfig();
        saveConfig({ orgUrl: "https://dev.azure.com/myorg", pat: "mypat" });
        expect(encryptString).toHaveBeenCalledWith("mypat");
        expect(writeFileSync).toHaveBeenCalledWith(
            EXPECTED_CONFIG_PATH,
            expect.stringContaining('"orgUrl": "https://dev.azure.com/myorg"'),
            "utf-8"
        );
        const written = JSON.parse((writeFileSync.mock.calls[0][1] as string));
        expect(written.encryptedPat).toBe(Buffer.from("enc:mypat", "utf-8").toString("base64"));
    });

    it("stores PAT as plain base64 when safeStorage is unavailable", async () => {
        isEncryptionAvailable.mockReturnValue(false);
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const { saveConfig } = await importConfig();
        saveConfig({ orgUrl: "https://dev.azure.com/myorg", pat: "mypat" });
        expect(encryptString).not.toHaveBeenCalled();
        const written = JSON.parse((writeFileSync.mock.calls[0][1] as string));
        expect(written.encryptedPat).toBe(Buffer.from("mypat", "utf-8").toString("base64"));
        warnSpy.mockRestore();
    });

    it("round-trips: saveConfig then loadConfig returns the original values", async () => {
        encryptString.mockImplementation((s: string) => Buffer.from(`enc:${s}`, "utf-8"));
        decryptString.mockImplementation((buf: Buffer) => buf.toString("utf-8").replace(/^enc:/, ""));
        isEncryptionAvailable.mockReturnValue(true);

        const { saveConfig, loadConfig } = await importConfig();
        saveConfig({ orgUrl: "https://dev.azure.com/myorg", pat: "roundtrippat" });

        // Simulate the written file being readable
        const writtenContent = writeFileSync.mock.calls[0][1] as string;
        existsSync.mockReturnValue(true);
        readFileSync.mockReturnValue(writtenContent);

        const result = await loadConfig();
        expect(result.orgUrl).toBe("https://dev.azure.com/myorg");
        expect(result.pat).toBe("roundtrippat");
    });
});

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
            JSON.stringify({ orgUrl: "https://dev.azure.com/myorg" })
        );
        const { saveCombinedBoardColumns } = await importConfig();
        saveCombinedBoardColumns([{ id: "col-1", name: "Backlog", sourceMappings: [] }]);
        const written = JSON.parse(writeFileSync.mock.calls[0][1] as string);
        expect(written.orgUrl).toBe("https://dev.azure.com/myorg");
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
