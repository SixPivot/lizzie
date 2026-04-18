import * as azdev from "azure-devops-node-api";
import type { SelectedBoard } from "./config";

export interface WorkItemCard {
    id: number;
    boardId: string;
    columnName: string;
    boardOrder: number;
    teamName: string;
    projectName: string;
    orgUrl: string;
    fields: Record<string, unknown>;
}

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

const WORK_ITEM_FIELDS = [
    "System.Id",
    "System.Title",
    "System.WorkItemType",
    "System.AssignedTo",
    "System.Tags",
    "System.Description",
    "System.BoardColumn",
    "System.BoardColumnDone",
    "System.State",
    "System.AreaPath",
    "System.IterationPath",
    "System.CreatedDate",
    "System.ChangedDate",
    "System.CreatedBy",
    "System.ChangedBy",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "Microsoft.VSTS.Common.Priority",
    "Microsoft.VSTS.Common.ResolvedReason",
    "Microsoft.VSTS.Common.ClosedDate",
    "Microsoft.VSTS.Common.ActivatedDate",
    "Microsoft.VSTS.TCM.ReproSteps",
    "Microsoft.VSTS.TCM.SystemInfo",
    "Microsoft.VSTS.Common.StackRank",
];

export async function fetchWorkItemsForBoard({
    orgUrl,
    pat,
    board,
}: {
    orgUrl: string;
    pat: string;
    board: SelectedBoard;
}): Promise<WorkItemCard[]> {
    const authHandler = azdev.getPersonalAccessTokenHandler(pat);
    const connection = new azdev.WebApi(orgUrl, authHandler);
    const witApi = await connection.getWorkItemTrackingApi();

    const teamContext = {
        project: board.projectName,
        projectId: board.projectId,
        team: board.teamName,
        teamId: board.teamId,
    };

    const wiqlResult = await witApi.queryByWiql(
        {
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${board.projectName.replace(/'/g, "''")}' ORDER BY [Microsoft.VSTS.Common.StackRank]`,
        },
        teamContext,
        false,
        500
    );

    const refs = wiqlResult.workItems ?? [];
    if (refs.length === 0) return [];

    const ids = refs.map((r) => r.id!).filter(Boolean);

    // Fetch in batches of 200 (API limit)
    const BATCH_SIZE = 200;
    const batches: number[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        batches.push(ids.slice(i, i + BATCH_SIZE));
    }

    const workItemBatches = await Promise.all(
        batches.map((batch) => witApi.getWorkItems(batch, WORK_ITEM_FIELDS, undefined, undefined, undefined, board.projectName))
    );
    const workItems = workItemBatches.flat();

    const cards: WorkItemCard[] = [];
    let boardOrder = 0;

    for (const item of workItems) {
        if (!item.id || !item.fields) continue;

        const columnName = item.fields["System.BoardColumn"] as string | undefined;
        if (!columnName) continue; // not on this board

        cards.push({
            id: item.id,
            boardId: board.boardId,
            columnName,
            boardOrder: boardOrder++,
            teamName: board.teamName,
            projectName: board.projectName,
            orgUrl,
            fields: item.fields,
        });
    }

    return cards;
}
