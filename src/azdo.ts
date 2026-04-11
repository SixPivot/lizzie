import * as azdev from "azure-devops-node-api";

export interface ConnectionTestResult {
    success: boolean;
    error?: string;
    errorField?: "pat" | "orgUrl";
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
