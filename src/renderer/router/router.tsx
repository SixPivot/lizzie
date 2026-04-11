import { createHashRouter, Navigate } from "react-router-dom";

// Page components are added in Task 4 and the layout shell in Task 8.
// Routes are wired up progressively — this file is the single source of truth.
export const router = createHashRouter([
    {
        path: "/",
        element: <Navigate to="/board" replace />,
    },
    {
        path: "/board",
        lazy: async () => {
            const { CombinedBoardPage } = await import("../pages/CombinedBoardPage");
            return { Component: CombinedBoardPage };
        },
    },
    {
        path: "/sync",
        lazy: async () => {
            const { LocalSyncPage } = await import("../pages/LocalSyncPage");
            return { Component: LocalSyncPage };
        },
    },
    {
        path: "/settings",
        lazy: async () => {
            const { SettingsPage } = await import("../pages/SettingsPage");
            return { Component: SettingsPage };
        },
    },
]);
