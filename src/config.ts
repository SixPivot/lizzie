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

export interface ImportedConnection {
    id: string;
    name: string;
    orgUrl: string;
}

export interface ImportedConfigFile {
    version: 1;
    connections: ImportedConnection[];
    selectedBoards: SelectedBoard[];
    combinedBoardColumns: CombinedBoardColumn[];
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

function cloneCombinedBoardColumns(columns: CombinedBoardColumn[]): CombinedBoardColumn[] {
    return columns.map((column) => ({
        ...column,
        sourceMappings: column.sourceMappings.map((mapping) => ({ ...mapping })),
    }));
}

function normaliseOrgUrl(orgUrl: string): string {
    return orgUrl.trim().toLowerCase();
}

function buildSelectedBoardKey(board: Pick<SelectedBoard, "connectionId" | "boardId">): string {
    return `${board.connectionId}::${board.boardId}`;
}

function buildSourceMappingKey(mapping: Pick<CombinedBoardColumnMapping, "connectionId" | "boardId" | "columnId">): string {
    return `${mapping.connectionId}::${mapping.boardId}::${mapping.columnId}`;
}

function isValidHttpsOrgUrl(orgUrl: string): boolean {
    try {
        const parsed = new URL(orgUrl);
        return parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export function isImportedConfigFile(value: unknown): value is ImportedConfigFile {
    if (!value || typeof value !== "object") {
        return false;
    }

    const candidate = value as Partial<ImportedConfigFile>;

    if (candidate.version !== 1) {
        return false;
    }

    if (!Array.isArray(candidate.connections) || !Array.isArray(candidate.selectedBoards) || !Array.isArray(candidate.combinedBoardColumns)) {
        return false;
    }

    return candidate.connections.every(
        (connection) =>
            connection &&
            typeof connection === "object" &&
            typeof connection.id === "string" &&
            typeof connection.name === "string" &&
            typeof connection.orgUrl === "string"
    );
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

export function exportConfigFile(): ImportedConfigFile {
    const file = readAndMigrateConfigFile();
    return {
        version: 1,
        connections: (file.connections ?? []).map(({ id, name, orgUrl }) => ({ id, name, orgUrl })),
        selectedBoards: (file.selectedBoards ?? []).map((board) => ({ ...board })),
        combinedBoardColumns: cloneCombinedBoardColumns(file.combinedBoardColumns ?? []),
    };
}

export function importConfigFile(imported: ImportedConfigFile, newConnectionPatsByOrgUrl: Record<string, string>): void {
    if (!isImportedConfigFile(imported)) {
        throw new Error("The selected file is not a valid Lizzie configuration export.");
    }

    for (const connection of imported.connections) {
        if (!isValidHttpsOrgUrl(connection.orgUrl)) {
            throw new Error("One or more imported connections have an invalid organisation URL.");
        }
    }

    const file = readAndMigrateConfigFile();
    const currentConnections = [...(file.connections ?? [])];
    const nextConnections = [...currentConnections];
    const importedConnectionToLocalId = new Map<string, string>();
    const existingConnectionsByOrgUrl = new Map(
        currentConnections.map((connection) => [normaliseOrgUrl(connection.orgUrl), connection])
    );

    for (const importedConnection of imported.connections) {
        const normalisedOrgUrl = normaliseOrgUrl(importedConnection.orgUrl);
        const existingConnection = existingConnectionsByOrgUrl.get(normalisedOrgUrl);

        if (existingConnection) {
            importedConnectionToLocalId.set(importedConnection.id, existingConnection.id);
            continue;
        }

        const providedPat = newConnectionPatsByOrgUrl[normalisedOrgUrl] ?? newConnectionPatsByOrgUrl[importedConnection.orgUrl];
        if (!providedPat?.trim()) {
            throw new Error("A Personal Access Token is required to import this connection.");
        }

        const newConnectionId = randomUUID();
        const newConnection: Connection = {
            id: newConnectionId,
            name: importedConnection.name,
            orgUrl: importedConnection.orgUrl,
            encryptedPat: encryptPat(providedPat.trim()),
        };

        nextConnections.push(newConnection);
        existingConnectionsByOrgUrl.set(normalisedOrgUrl, newConnection);
        importedConnectionToLocalId.set(importedConnection.id, newConnectionId);
    }

    const nextSelectedBoards = [...(file.selectedBoards ?? [])];
    const selectedBoardKeys = new Set(nextSelectedBoards.map(buildSelectedBoardKey));

    for (const importedBoard of imported.selectedBoards) {
        const mappedConnectionId = importedConnectionToLocalId.get(importedBoard.connectionId);
        if (!mappedConnectionId) {
            throw new Error("The selected file is not a valid Lizzie configuration export.");
        }

        const remappedBoard: SelectedBoard = {
            ...importedBoard,
            connectionId: mappedConnectionId,
        };

        const boardKey = buildSelectedBoardKey(remappedBoard);
        if (selectedBoardKeys.has(boardKey)) {
            continue;
        }

        nextSelectedBoards.push(remappedBoard);
        selectedBoardKeys.add(boardKey);
    }

    const nextCombinedBoardColumns = cloneCombinedBoardColumns(file.combinedBoardColumns ?? []);
    const mappingOwnerByKey = new Map<string, string>();

    for (const column of nextCombinedBoardColumns) {
        for (const mapping of column.sourceMappings) {
            mappingOwnerByKey.set(buildSourceMappingKey(mapping), column.id);
        }
    }

    for (const importedColumn of imported.combinedBoardColumns) {
        const remappedMappings = importedColumn.sourceMappings.map((mapping) => {
            const mappedConnectionId = importedConnectionToLocalId.get(mapping.connectionId);
            if (!mappedConnectionId) {
                throw new Error("The selected file is not a valid Lizzie configuration export.");
            }

            return {
                ...mapping,
                connectionId: mappedConnectionId,
            };
        });

        const newMappings = remappedMappings.filter((mapping) => !mappingOwnerByKey.has(buildSourceMappingKey(mapping)));
        if (newMappings.length === 0) {
            continue;
        }

        const existingColumn = nextCombinedBoardColumns.find(
            (column) => column.name.toLowerCase() === importedColumn.name.toLowerCase()
        );

        if (existingColumn) {
            existingColumn.sourceMappings.push(...newMappings);
            for (const mapping of newMappings) {
                mappingOwnerByKey.set(buildSourceMappingKey(mapping), existingColumn.id);
            }
            continue;
        }

        const newColumnId = randomUUID();
        nextCombinedBoardColumns.push({
            id: newColumnId,
            name: importedColumn.name,
            sourceMappings: newMappings,
        });

        for (const mapping of newMappings) {
            mappingOwnerByKey.set(buildSourceMappingKey(mapping), newColumnId);
        }
    }

    writeConfigFile({
        ...file,
        connections: nextConnections,
        selectedBoards: nextSelectedBoards,
        combinedBoardColumns: nextCombinedBoardColumns,
    });
}

export function clearConfigFile(): void {
    const file = readAndMigrateConfigFile();
    writeConfigFile({
        theme: file.theme,
        windowBounds: file.windowBounds,
    });
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
