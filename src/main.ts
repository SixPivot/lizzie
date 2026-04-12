import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { loadConfig, saveConfig, loadSelectedBoards, saveSelectedBoards, loadWindowBounds, saveWindowBounds, type SelectedBoard } from "./config";
import { testConnection, fetchAvailableBoards } from "./azdo";

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
  const config = loadConfig();
  return { ...config, selectedBoards: loadSelectedBoards() };
});

ipcMain.handle("settings:saveAndTest", async (_, { orgUrl, pat }: { orgUrl: string; pat: string }) => {
  saveConfig({ orgUrl, pat });
  return testConnection({ orgUrl, pat });
});

// Boards IPC handlers
ipcMain.handle("boards:getAvailable", async () => {
  const { orgUrl, pat } = loadConfig();
  if (!orgUrl || !pat) {
    return { error: "NO_CREDENTIALS" };
  }
  try {
    const boards = await fetchAvailableBoards({ orgUrl, pat });
    return { boards };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
});

ipcMain.handle("boards:saveSelected", (_, boards: SelectedBoard[]) => {
  saveSelectedBoards(boards);
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
