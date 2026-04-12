import * as azdev from "azure-devops-node-api";
import type { SelectedBoard } from "./config";

export interface BoardColumnInfo {
    boardId: string;
    boardName: string;
    projectId: string;
    projectName: string;
    columnId: string;
    columnName: string;
}

export interface ConnectionTestResult {
    success: boolean;
    error?: string;
    errorField?: "pat" | "orgUrl";
}

export interface AvailableBoard {
    projectId: string;
    projectName: string;
    teamId: string;
    teamName: string;
    boardId: string;
    boardName: string;
}

export async function testConnection({
    orgUrl,
    pat,
}: {
    orgUrl: string;
    pat: string;
}): Promise<ConnectionTestResult> {
    try {
        const authHandler = azdev.getPersonalAccessTokenHandler(pat);
        const connection = new azdev.WebApi(orgUrl, authHandler);
        await connection.connect();
        return { success: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const statusCode = (err as { statusCode?: number }).statusCode;

        if (statusCode === 401 || statusCode === 403) {
            return {
                success: false,
                error: "Invalid PAT or insufficient permissions.",
                errorField: "pat",
            };
        }

        // Network/DNS errors
        const isNetworkError =
            message.includes("ENOTFOUND") ||
            message.includes("ECONNREFUSED") ||
            message.includes("ETIMEDOUT") ||
            message.includes("ECONNRESET") ||
            message.includes("getaddrinfo");

        if (isNetworkError) {
            return {
                success: false,
                error: "Could not reach the organisation URL. Check the URL and your network.",
                errorField: "orgUrl",
            };
        }

        return { success: false, error: message, errorField: "pat" };
    }
}

export async function fetchAvailableBoards({
    orgUrl,
    pat,
}: {
    orgUrl: string;
    pat: string;
}): Promise<AvailableBoard[]> {
    const authHandler = azdev.getPersonalAccessTokenHandler(pat);
    const connection = new azdev.WebApi(orgUrl, authHandler);

    const [coreApi, workApi] = await Promise.all([
        connection.getCoreApi(),
        connection.getWorkApi(),
    ]);

    const projects = await coreApi.getProjects();

    const boardsByProject = await Promise.all(
        projects
            .filter((p) => p.id && p.name)
            .map(async (project) => {
                const teams = await coreApi.getTeams(project.id!);

                const boardsByTeam = await Promise.all(
                    teams
                        .filter((t) => t.id && t.name)
                        .map(async (team) => {
                            try {
                                const boards = await workApi.getBoards({
                                    project: project.name,
                                    projectId: project.id,
                                    team: team.name,
                                    teamId: team.id,
                                });
                                return boards
                                    .filter((b) => b.id && b.name === "Stories")
                                    .map((board) => ({
                                        projectId: project.id!,
                                        projectName: project.name!,
                                        teamId: team.id!,
                                        teamName: team.name!,
                                        boardId: board.id!,
                                        boardName: board.name!,
                                    }));
                            } catch (err: unknown) {
                                const message = err instanceof Error ? err.message : String(err);
                                console.warn(`[azdo] Skipping boards for team "${team.name}" in project "${project.name}": ${message}`);
                                return [];
                            }
                        })
                );

                return boardsByTeam.flat();
            })
    );

    const all = boardsByProject.flat();

    return all.sort((a, b) => {
        const projectCompare = a.projectName.localeCompare(b.projectName);
        if (projectCompare !== 0) return projectCompare;
        return a.boardName.localeCompare(b.boardName);
    });
}

export async function fetchBoardColumns({
    orgUrl,
    pat,
    selectedBoards,
}: {
    orgUrl: string;
    pat: string;
    selectedBoards: SelectedBoard[];
}): Promise<BoardColumnInfo[]> {
    const authHandler = azdev.getPersonalAccessTokenHandler(pat);
    const connection = new azdev.WebApi(orgUrl, authHandler);
    const workApi = await connection.getWorkApi();

    const columnsByBoard = await Promise.all(
        selectedBoards.map(async (board) => {
            try {
                const teamContext = {
                    project: board.projectName,
                    projectId: board.projectId,
                    team: board.teamName,
                    teamId: board.teamId,
                };
                const columns = await workApi.getBoardColumns(teamContext, board.boardId);
                return columns
                    .filter((c) => c.id && c.name)
                    .map((c) => ({
                        boardId: board.boardId,
                        boardName: board.boardName,
                        projectId: board.projectId,
                        projectName: board.projectName,
                        teamId: board.teamId,
                        teamName: board.teamName,
                        columnId: c.id!,
                        columnName: c.name!,
                    }));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.warn(`[azdo] Skipping columns for board "${board.boardName}" in project "${board.projectName}": ${message}`);
                return [];
            }
        })
    );

    return columnsByBoard.flat();
}
