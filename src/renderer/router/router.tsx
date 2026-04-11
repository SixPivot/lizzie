import { createHashRouter, Navigate } from "react-router-dom";
import { App } from "../App";

export const router = createHashRouter([
    {
        path: "/",
        element: <Navigate to="/board" replace />,
    },
    {
        Component: App,
        children: [
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
        ],
    },
]);
