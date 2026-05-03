import { app, BrowserWindow, dialog, ipcMain, screen, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import started from "electron-squirrel-startup";
import {
    loadConnections,
    findConnectionById,
    decryptConnectionPat,
    isOrgUrlTaken,
    addConnection,
    removeConnection,
    loadSelectedBoards,
    saveSelectedBoards,
    loadCombinedBoardColumns,
    saveCombinedBoardColumns,
    loadWindowBounds,
    saveWindowBounds,
    loadTheme,
    saveTheme,
    exportConfigFile,
    importConfigFile,
    clearConfigFile,
    isImportedConfigFile,
    type SelectedBoard,
    type CombinedBoardColumn,
    type ImportedConfigFile,
    type ThemePreference,
} from "./config";
import { testConnection, fetchAvailableBoards, fetchBoardColumns, fetchWorkItemsForBoard } from "./azdo";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

function createWindow() {
  const isMac = process.platform === "darwin";

  const defaultWidth = 1024;
  const defaultHeight = 768;

  const savedBounds = loadWindowBounds();
  let restoredBounds: { x: number; y: number; width: number; height: number } | null = null;

  if (savedBounds) {
    const displays = screen.getAllDisplays();
    const centerX = savedBounds.x + savedBounds.width / 2;
    const centerY = savedBounds.y + savedBounds.height / 2;
    const isOnScreen = displays.some(({ bounds }) =>
      centerX >= bounds.x && centerX <= bounds.x + bounds.width &&
      centerY >= bounds.y && centerY <= bounds.y + bounds.height
    );
    if (isOnScreen) {
      restoredBounds = savedBounds;
    }
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: restoredBounds?.width ?? defaultWidth,
    height: restoredBounds?.height ?? defaultHeight,
    ...(restoredBounds ? { x: restoredBounds.x, y: restoredBounds.y } : {}),
    frame: false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSaveBounds() {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(() => {
      if (!mainWindow.isDestroyed() && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
        saveWindowBounds(mainWindow.getBounds());
      }
    }, 500);
  }

  mainWindow.on("move", scheduleSaveBounds);
  mainWindow.on("resize", scheduleSaveBounds);

  mainWindow.on("close", () => {
    if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
    if (!mainWindow.isMinimized()) {
      saveWindowBounds(mainWindow.getNormalBounds());
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
}

// Window control IPC handlers
ipcMain.on("window:minimise", () => {
  BrowserWindow.getFocusedWindow()?.minimize();
});

ipcMain.on("window:maximise", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on("window:close", () => {
  BrowserWindow.getFocusedWindow()?.close();
});

// Settings IPC handlers
ipcMain.handle("settings:load", () => {
    return { connections: loadConnections(), selectedBoards: loadSelectedBoards() };
});

// Connection IPC handlers
ipcMain.handle("connections:load", () => {
    return loadConnections();
});

ipcMain.handle("connections:add", async (_, { name, orgUrl, pat }: { name: string; orgUrl: string; pat: string }) => {
    if (isOrgUrlTaken(orgUrl)) {
        return { success: false, error: "A connection to this organisation already exists.", errorField: "orgUrl" };
    }
    const result = await testConnection({ orgUrl, pat });
    if (!result.success) {
        return { success: false, error: result.error, errorField: result.errorField };
    }
    const connection = addConnection({ name, orgUrl, pat });
    return { success: true, connection };
});

ipcMain.handle("connections:remove", (_, { connectionId }: { connectionId: string }) => {
    removeConnection(connectionId);
    return { success: true };
});

ipcMain.handle("connections:retest", async (_, { connectionId }: { connectionId: string }) => {
    const connection = findConnectionById(connectionId);
    if (!connection) {
        return { success: false, error: "Connection not found." };
    }
    const pat = decryptConnectionPat(connection);
    if (!pat) {
        return { success: false, error: "Could not decrypt PAT." };
    }
    const result = await testConnection({ orgUrl: connection.orgUrl, pat });
    return result;
});

// Boards IPC handlers
ipcMain.handle("boards:getAvailable", async (_, { connectionId }: { connectionId: string }) => {
    const connection = findConnectionById(connectionId);
    if (!connection) {
        return { error: "NO_CREDENTIALS" };
    }
    const pat = decryptConnectionPat(connection);
    if (!pat) {
        return { error: "NO_CREDENTIALS" };
    }
    try {
        const boards = await fetchAvailableBoards({ orgUrl: connection.orgUrl, pat });
        return { boards };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
    }
});

ipcMain.handle("boards:saveSelected", (_, boards: SelectedBoard[]) => {
  saveSelectedBoards(boards);
});

ipcMain.handle("boards:getBoardColumnsForSelected", async () => {
    const selectedBoards = loadSelectedBoards();
    const connections = loadConnections();

    // Group boards by connectionId
    const boardsByConnection = new Map<string, SelectedBoard[]>();
    for (const board of selectedBoards) {
        const list = boardsByConnection.get(board.connectionId) ?? [];
        list.push(board);
        boardsByConnection.set(board.connectionId, list);
    }

    const allColumns = await Promise.all(
        Array.from(boardsByConnection.entries()).map(async ([connectionId, boards]) => {
            const connectionSummary = connections.find((c) => c.id === connectionId);
            if (!connectionSummary) return [];
            const connection = findConnectionById(connectionId);
            if (!connection) return [];
            const pat = decryptConnectionPat(connection);
            if (!pat) return [];
            try {
                const cols = await fetchBoardColumns({ orgUrl: connection.orgUrl, pat, selectedBoards: boards });
                return cols.map((c) => ({ ...c, connectionId }));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.warn(`[main] Failed to fetch board columns for connection ${connectionId}: ${message}`);
                return [];
            }
        })
    );

    return { columns: allColumns.flat() };
});

// Combined board IPC handlers
ipcMain.handle("combinedBoard:loadColumns", () => {
  return loadCombinedBoardColumns();
});

ipcMain.handle("combinedBoard:saveColumns", (_, columns: CombinedBoardColumn[]) => {
  saveCombinedBoardColumns(columns);
});

ipcMain.handle("combinedBoard:getWorkItems", async () => {
    const selectedBoards = loadSelectedBoards();

    // Group boards by connectionId
    const boardsByConnection = new Map<string, SelectedBoard[]>();
    for (const board of selectedBoards) {
        const list = boardsByConnection.get(board.connectionId) ?? [];
        list.push(board);
        boardsByConnection.set(board.connectionId, list);
    }

    const failedConnections: string[] = [];
    const connections = loadConnections();

    const cardsByConnection = await Promise.all(
        Array.from(boardsByConnection.entries()).map(async ([connectionId, boards]) => {
            const connectionSummary = connections.find((c) => c.id === connectionId);
            const connection = findConnectionById(connectionId);
            if (!connection || !connectionSummary) return [];
            const pat = decryptConnectionPat(connection);
            if (!pat) {
                failedConnections.push(connectionSummary.name);
                return [];
            }
            try {
                const cardsByBoard = await Promise.all(
                    boards.map((board) => fetchWorkItemsForBoard({ orgUrl: connection.orgUrl, pat, board }))
                );
                return cardsByBoard.flat().map((card) => ({ ...card, connectionId }));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.warn(`[main] Failed to fetch work items for connection ${connectionId}: ${message}`);
                failedConnections.push(connectionSummary.name);
                return [];
            }
        })
    );

    return { cards: cardsByConnection.flat(), failedConnections };
});

// Shell IPC handlers
ipcMain.on("shell:openExternal", (_, url: string) => {
  shell.openExternal(url);
});

// Theme IPC handlers
ipcMain.handle("theme:load", () => {
  return loadTheme();
});

ipcMain.handle("theme:save", (_, theme: ThemePreference) => {
  saveTheme(theme);
});

// System IPC handlers
ipcMain.handle("system:exportConfig", async () => {
  const target = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow() ?? undefined, {
    title: "Export Lizzie configuration",
    defaultPath: "lizzie-config.json",
    filters: [{ name: "JSON Files", extensions: ["json"] }],
  });

  if (target.canceled || !target.filePath) {
    return { success: false, canceled: true };
  }

  try {
    const exported = exportConfigFile();
    fs.writeFileSync(target.filePath, JSON.stringify(exported, null, 2), "utf-8");
    return { success: true };
  } catch {
    return { success: false, error: "Could not export configuration to the selected location." };
  }
});

ipcMain.handle("system:selectImportFile", async () => {
  const target = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow() ?? undefined, {
    title: "Import Lizzie configuration",
    properties: ["openFile"],
    filters: [{ name: "JSON Files", extensions: ["json"] }],
  });

  if (target.canceled || target.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  try {
    const raw = fs.readFileSync(target.filePaths[0], "utf-8");
    const parsed: unknown = JSON.parse(raw);

    if (!isImportedConfigFile(parsed)) {
      return { success: false, error: "The selected file is not a valid Lizzie configuration export." };
    }

    const existingOrgUrls = new Set(loadConnections().map((connection) => connection.orgUrl.trim().toLowerCase()));
    const connectionsRequiringPat = parsed.connections.filter(
      (connection) => !existingOrgUrls.has(connection.orgUrl.trim().toLowerCase())
    );

    return {
      success: true,
      imported: parsed,
      connectionsRequiringPat,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: "The selected file is not valid JSON." };
    }

    return { success: false, error: "Could not read the selected configuration file." };
  }
});

ipcMain.handle("system:applyImportedConfig", async (_, { imported, newConnectionPatsByOrgUrl }: { imported: ImportedConfigFile; newConnectionPatsByOrgUrl: Record<string, string> }) => {
  if (!isImportedConfigFile(imported)) {
    return { success: false, error: "The selected file is not a valid Lizzie configuration export." };
  }

  const existingOrgUrls = new Set(loadConnections().map((connection) => connection.orgUrl.trim().toLowerCase()));
  for (const connection of imported.connections) {
    const normalisedOrgUrl = connection.orgUrl.trim().toLowerCase();
    if (existingOrgUrls.has(normalisedOrgUrl)) {
      continue;
    }

    const pat = newConnectionPatsByOrgUrl[normalisedOrgUrl] ?? newConnectionPatsByOrgUrl[connection.orgUrl];
    if (!pat?.trim()) {
      return { success: false, error: "A Personal Access Token is required to import this connection." };
    }

    const result = await testConnection({ orgUrl: connection.orgUrl, pat: pat.trim() });
    if (!result.success) {
      return { success: false, error: result.error ?? "Could not connect to Azure DevOps. Check your PAT and try again." };
    }
  }

  try {
    importConfigFile(imported, newConnectionPatsByOrgUrl);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("system:clearConfig", () => {
  clearConfigFile();
  return { success: true };
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
