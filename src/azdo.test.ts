import { describe, it, expect, vi, beforeEach } from "vitest";
import { testConnection, type ConnectionTestResult } from "./azdo";

// vi.hoisted runs before module resolution, making connectMock available in the vi.mock factory
const connectMock = vi.hoisted(() => vi.fn());

vi.mock("azure-devops-node-api", () => {
    class WebApi {
        connect = connectMock;
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

