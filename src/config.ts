import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface SelectedBoard {
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    boardId: string;
    boardName: string;
}

interface ConfigFile {
    orgUrl?: string;
    encryptedPat?: string;
    selectedBoards?: SelectedBoard[];
}

export interface AppConfig {
    orgUrl: string | null;
    pat: string | null;
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

export function loadConfig(): AppConfig {
    const file = readConfigFile();

    const orgUrl = file.orgUrl ?? null;

    let pat: string | null = null;
    if (file.encryptedPat) {
        try {
            if (safeStorage.isEncryptionAvailable()) {
                const encrypted = Buffer.from(file.encryptedPat, "base64");
                pat = safeStorage.decryptString(encrypted);
            } else {
                // Stored as plain base64 when safeStorage unavailable
                pat = Buffer.from(file.encryptedPat, "base64").toString("utf-8");
            }
        } catch {
            console.warn("[config] Failed to decrypt PAT — leaving field empty.");
            pat = null;
        }
    }

    return { orgUrl, pat };
}

export function saveConfig({ orgUrl, pat }: { orgUrl: string; pat: string }): void {
    let encryptedPat: string;

    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(pat);
        encryptedPat = encrypted.toString("base64");
    } else {
        console.warn("[config] safeStorage not available — storing PAT as plain base64.");
        encryptedPat = Buffer.from(pat, "utf-8").toString("base64");
    }

    writeConfigFile({ ...readConfigFile(), orgUrl, encryptedPat });
}

export function loadSelectedBoards(): SelectedBoard[] {
    return readConfigFile().selectedBoards ?? [];
}

export function saveSelectedBoards(boards: SelectedBoard[]): void {
    writeConfigFile({ ...readConfigFile(), selectedBoards: boards });
}
