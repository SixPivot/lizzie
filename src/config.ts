import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface Connection {
    id: string;
    name: string;
    orgUrl: string;
    encryptedPat: string;
}

export interface ConnectionSummary {
    id: string;
    name: string;
    orgUrl: string;
}

export interface SelectedBoard {
    connectionId: string;
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    boardId: string;
    boardName: string;
}

interface WindowBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface CombinedBoardColumnMapping {
    connectionId: string;
    boardId: string;
    boardName: string;
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    columnId: string;
    columnName: string;
}

export interface CombinedBoardColumn {
    id: string;
    name: string;
    sourceMappings: CombinedBoardColumnMapping[];
}

export type ThemePreference = "light" | "dark" | "auto";

interface ConfigFile {
    /** @deprecated Use connections[] instead */
    orgUrl?: string;
    /** @deprecated Use connections[] instead */
    encryptedPat?: string;
    connections?: Connection[];
    selectedBoards?: SelectedBoard[];
    combinedBoardColumns?: CombinedBoardColumn[];
    windowBounds?: WindowBounds;
    theme?: ThemePreference;
}

function getConfigPath(): string {
    return path.join(app.getPath("userData"), "config.json");
}

function readConfigFile(): ConfigFile {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return {};
    }
    try {
        const raw = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(raw) as ConfigFile;
    } catch {
        console.warn("[config] Failed to parse config.json — treating as empty.");
        return {};
    }
}

function writeConfigFile(file: ConfigFile): void {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(file, null, 2), "utf-8");
}

function encryptPat(pat: string): string {
    if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(pat).toString("base64");
    }
    console.warn("[config] safeStorage not available — storing PAT as plain base64.");
    return Buffer.from(pat, "utf-8").toString("base64");
}

function decryptPat(encryptedPat: string): string | null {
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = Buffer.from(encryptedPat, "base64");
            return safeStorage.decryptString(encrypted);
        }
        return Buffer.from(encryptedPat, "base64").toString("utf-8");
    } catch {
        console.warn("[config] Failed to decrypt PAT — leaving field empty.");
        return null;
    }
}

/**
 * Migrates a legacy single-connection config (flat orgUrl/encryptedPat) to the
 * new connections[] format. Idempotent — does nothing if already migrated.
 */
export function migrateConfig(file: ConfigFile): ConfigFile {
    if (!file.orgUrl && !file.encryptedPat) {
        return file;
    }
    if (file.connections && file.connections.length > 0) {
        // Already migrated — clean up legacy fields if still present
        const { orgUrl: _o, encryptedPat: _e, ...rest } = file;
        return rest;
    }

    const connectionId = randomUUID();
    const connection: Connection = {
        id: connectionId,
        name: "Connection 1",
        orgUrl: file.orgUrl!,
        encryptedPat: file.encryptedPat!,
    };

    const migratedBoards = (file.selectedBoards ?? []).map((b) =>
        "connectionId" in b ? b : { ...b, connectionId }
    );

    const migratedColumns = (file.combinedBoardColumns ?? []).map((col) => ({
        ...col,
        sourceMappings: col.sourceMappings.map((m) =>
            "connectionId" in m ? m : { ...m, connectionId }
        ),
    }));

    const { orgUrl: _o, encryptedPat: _e, ...rest } = file;
    return {
        ...rest,
        connections: [connection],
        selectedBoards: migratedBoards,
        combinedBoardColumns: migratedColumns,
    };
}

function readAndMigrateConfigFile(): ConfigFile {
    const raw = readConfigFile();
    const migrated = migrateConfig(raw);
    // Persist migration if it changed anything
    if (migrated !== raw) {
        writeConfigFile(migrated);
    }
    return migrated;
}

// ---------------------------------------------------------------------------
// Connection functions
// ---------------------------------------------------------------------------

export function loadConnections(): ConnectionSummary[] {
    const file = readAndMigrateConfigFile();
    return (file.connections ?? []).map(({ id, name, orgUrl }) => ({ id, name, orgUrl }));
}

export function findConnectionById(id: string): Connection | null {
    const file = readAndMigrateConfigFile();
    return (file.connections ?? []).find((c) => c.id === id) ?? null;
}

export function decryptConnectionPat(connection: Connection): string | null {
    return decryptPat(connection.encryptedPat);
}

export function isOrgUrlTaken(orgUrl: string, excludeId?: string): boolean {
    const file = readAndMigrateConfigFile();
    const lower = orgUrl.toLowerCase();
    return (file.connections ?? []).some(
        (c) => c.orgUrl.toLowerCase() === lower && c.id !== excludeId
    );
}

export function addConnection({ name, orgUrl, pat }: { name: string; orgUrl: string; pat: string }): ConnectionSummary {
    const file = readAndMigrateConfigFile();
    const id = randomUUID();
    const connection: Connection = {
        id,
        name,
        orgUrl,
        encryptedPat: encryptPat(pat),
    };
    writeConfigFile({ ...file, connections: [...(file.connections ?? []), connection] });
    return { id, name, orgUrl };
}

export function removeConnection(connectionId: string): void {
    const file = readAndMigrateConfigFile();
    const connections = (file.connections ?? []).filter((c) => c.id !== connectionId);
    const selectedBoards = (file.selectedBoards ?? []).filter((b) => b.connectionId !== connectionId);
    const combinedBoardColumns = (file.combinedBoardColumns ?? []).map((col) => ({
        ...col,
        sourceMappings: col.sourceMappings.filter((m) => m.connectionId !== connectionId),
    }));
    writeConfigFile({ ...file, connections, selectedBoards, combinedBoardColumns });
}

// ---------------------------------------------------------------------------
// Legacy loadConfig — kept for backward compat during transition; reads from
// the first connection if available
// ---------------------------------------------------------------------------

export function loadConfig(): { orgUrl: string | null; pat: string | null } {
    const file = readAndMigrateConfigFile();
    const first = (file.connections ?? [])[0];
    if (!first) return { orgUrl: null, pat: null };
    return { orgUrl: first.orgUrl, pat: decryptPat(first.encryptedPat) };
}

export function loadSelectedBoards(): SelectedBoard[] {
    return readAndMigrateConfigFile().selectedBoards ?? [];
}

export function saveSelectedBoards(boards: SelectedBoard[]): void {
    writeConfigFile({ ...readAndMigrateConfigFile(), selectedBoards: boards });
}

export function loadCombinedBoardColumns(): CombinedBoardColumn[] {
    return readAndMigrateConfigFile().combinedBoardColumns ?? [];
}

export function saveCombinedBoardColumns(columns: CombinedBoardColumn[]): void {
    writeConfigFile({ ...readAndMigrateConfigFile(), combinedBoardColumns: columns });
}

export function loadWindowBounds(): WindowBounds | null {
    return readAndMigrateConfigFile().windowBounds ?? null;
}

export function saveWindowBounds(bounds: WindowBounds): void {
    writeConfigFile({ ...readAndMigrateConfigFile(), windowBounds: bounds });
}

export function loadTheme(): ThemePreference {
    return readAndMigrateConfigFile().theme ?? "auto";
}

export function saveTheme(theme: ThemePreference): void {
    writeConfigFile({ ...readAndMigrateConfigFile(), theme });
}
