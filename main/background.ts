/**
 * File: main/background.ts
 * Purpose: Main Electron process bootstrap and IPC registration.
 * Summary of what was added/changed:
 * - Added central IPC handler for renderer error reporting.
 * - Added process-level fallback logging for uncaught exceptions and unhandled rejections.
 * Author: Malek Kchaou (add your name if you made changes here)
 * Update Log:
 *  - 2026-04-12: Atharva Patil - Added code for quiz integration.
 * Date Created: 
 * Last Updated: 2026-04-12
 */

/**
 * Main Electron Process (background.ts)
 *
 * Serves as the primary entry point for the application's main process. Responsibilities include:
 * - App lifecycle management (ready, quit, navigation)
 * - Creating and managing the main BrowserWindow with persistent window state
 * - Initializing the settings system (SettingsManager) and loading global config
 * - Building and managing the native application menu (File, Edit, View, Window, Help)
 * - Enforcing Windows menu visibility behavior and auto-hide toggle support
 * - Registering IPC handlers for renderer ↔ main communication
 * - Initializing and managing the SQLite database
 * - Managing tab state across renderer lifecycle
 * - Handling file system operations (create, read, write, delete, rename, watch)
 * - Managing file chunking, indexing, and embedding operations
 * - Coordinating autosave and file persist operations
 * - Providing context menu and native dialogues
 *
 * Revision History:
 *  • Wesley McDougal - 29MAR2026 - Windows menu visibility enforcement and title bar adjustments
 *  • Atharva Patil - 12APR2026 - Bootstraps local quiz session services (IPC + WebSocket server). Ensures graceful shutdown of quiz resources on app exit.
 */
import path from "path";
import { app, ipcMain, BrowserWindow, Menu, dialog, shell } from "electron";
app.disableHardwareAcceleration();
import serve from "electron-serve";
import { createWindow, ensureConfigDirectory, getConfigDirectoryPath } from "./helpers";
import fs from "fs/promises";
import * as fsSync from "fs";
import { loadTags, updateTags, removeTags } from "./tags";
import { SettingsManager, registerSettingsIpc, buildMenuTemplate } from "./settings";
import { getQueue } from "./fsQueue";
import { withRetry } from "./fsRetry";
import { debouncedWriter } from "./helpers/debounced-writer";
import { closeDB, initializeDB } from "./database/sqllite";
import { 
    addDirectory, 
    updateDirectory, 
    deleteDirectory, 
    getDirectory, 
    getAllDirectories,
    addFile,
    updateFileHash,
    deleteFile,
    getFilesByDirectory,
    addChunk,
    deleteChunksByFile,
    getChunksByDirectory,
    getChunksByFile,
    addEmbedding
} from "./database/documentRepository";
import { chunkDirectory, chunkSingleFile, getChunkStats, DirectoryChunkerConfig, chunkAndStoreDirectory, chunkAndStoreFile } from "./indexing/DirectoryChuncker";
import { UUID, randomUUID } from "crypto";
import { startWatching, stopWatching, stopAllWatchers, getActiveWatchers, isWatching } from "./watcher/fileWatcher";
import {
    logMainError,
    logRendererError,
} from "./logging/errorLogger";
import { registerErrorLoggingIpc } from "./logging/registerErrorLoggingIpc";
import { QuizSessionManager } from "./quiz/quizSessionManager";
import { QuizWebSocketServer } from "./quiz/quizWebSocketServer";
import { registerQuizIpc } from "./quiz/ipc-handlers";
import { LOCAL_NOTES_FOLDER } from "./helpers/project-settings";

const isProd = process.env.NODE_ENV === "production";

// if current os is a macbookd
const isMac = process.platform === "darwin";

// Tab management
interface TabData {
  id: number;
  filePath: string | null;
  content: string;
}

class TabManager {
  private tabs: TabData[] = [
    {
      id: 0,
      filePath: null,
      content: "",
    },
  ];
  private selectedTabId: number = 0;
  private nextTabId: number = 1;

  getAllTabIds(): number[] {
    return this.tabs.map((tab) => tab.id);
  }

  getSelectedTabId(): number {
    return this.selectedTabId;
  }

  getTabContent(id: number): string {
    const tab = this.tabs.find((t) => t.id === id);
    return tab ? tab.content : "";
  }

  getTabFilePath(id: number): string | null {
    const tab = this.tabs.find((t) => t.id === id);
    return tab ? tab.filePath : null;
  }

  setTabContent(id: number, content: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) {
      tab.content = content;
    }
  }

  setTabFilePath(id: number, filePath: string | null): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) {
      tab.filePath = filePath;
    }
  }

  select(id: number): void {
    if (this.tabs.some((tab) => tab.id === id)) {
      this.selectedTabId = id;
    }
  }

  close(id: number): void {
    const index = this.tabs.findIndex((tab) => tab.id === id);
    if (index !== -1) {
      this.tabs.splice(index, 1);
      if (this.selectedTabId === id) {
        const newTab = this.tabs[Math.min(index, this.tabs.length - 1)];
        this.selectedTabId = newTab ? newTab.id : 0;
      }
      if (this.tabs.length === 0) {
        this.tabs.push({
          id: this.nextTabId++,
          filePath: null,
          content: "",
        });
      }
    }
  }

  new(): number {
    const newId = this.nextTabId++;
    this.tabs.push({
      id: newId,
      filePath: null,
      content: "",
    });
    this.selectedTabId = newId;
    return newId;
  }

  reorder(ids: number[]): void {
    if (
      ids.length === this.tabs.length &&
      ids.every((id) => this.tabs.some((tab) => tab.id === id))
    ) {
      this.tabs = ids.map((id) => this.tabs.find((tab) => tab.id === id)!);
    }
  }
}

const tabManager = new TabManager();

// IPC handlers for tab management
ipcMain.handle("tabs:getAllTabIds", () => tabManager.getAllTabIds());
ipcMain.handle("tabs:getSelectedTabId", () => tabManager.getSelectedTabId());
ipcMain.handle("tabs:select", (_, id: number) => tabManager.select(id));
ipcMain.handle("tabs:close", (_, id: number) => tabManager.close(id));
ipcMain.handle("tabs:new", () => tabManager.new());
ipcMain.handle("tabs:reorder", (_, ids: number[]) => tabManager.reorder(ids));
ipcMain.handle("tabs:getContent", (_, id: number) => tabManager.getTabContent(id));
ipcMain.handle("tabs:setContent", (_, { id, content }: { id: number; content: string }) =>
  tabManager.setTabContent(id, content)
);
ipcMain.handle("tabs:getFilePath", (_, id: number) => tabManager.getTabFilePath(id));
ipcMain.handle("tabs:setFilePath", (_, { id, filePath }: { id: number; filePath: string | null }) =>
  tabManager.setTabFilePath(id, filePath)
);

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

/**
 * Adds top-level safety nets so catastrophic main-process issues
 * still get written to the same log file.
 */
function registerProcessLevelErrorHandlers(): void {
    process.on("uncaughtException", (error) => {
        logMainError(error, "process.uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
        logMainError(reason, "process.unhandledRejection");
    });
}

// ---------------------------------------------------------------------------
// Settings manager (singleton)
// ---------------------------------------------------------------------------
const settingsManager = new SettingsManager();
let mainWindowRef: Electron.BrowserWindow | null = null;
const quizSessionManager = new QuizSessionManager();
const quizWebSocketServer = new QuizWebSocketServer(quizSessionManager, 9898);
const TRASH_FOLDER_NAME = ".trash";
const TRASH_INDEX_FILE = "index.json";

interface TrashIndexEntry {
  id: string;
  name: string;
  originalPath: string;
  trashedPath: string;
  isDirectory: boolean;
  deletedAt: string;
}

function getTrashRoot(projectRoot: string): string {
  return path.join(projectRoot, LOCAL_NOTES_FOLDER, TRASH_FOLDER_NAME);
}

function getTrashIndexPath(projectRoot: string): string {
  return path.join(getTrashRoot(projectRoot), TRASH_INDEX_FILE);
}

async function ensureTrashDirectory(projectRoot: string): Promise<string> {
  const trashRoot = getTrashRoot(projectRoot);
  await fs.mkdir(trashRoot, { recursive: true });
  return trashRoot;
}

async function readTrashIndex(projectRoot: string): Promise<TrashIndexEntry[]> {
  const indexPath = getTrashIndexPath(projectRoot);
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === "string");
  } catch {
    return [];
  }
}

async function writeTrashIndex(projectRoot: string, items: TrashIndexEntry[]): Promise<void> {
  await ensureTrashDirectory(projectRoot);
  await fs.writeFile(getTrashIndexPath(projectRoot), JSON.stringify(items, null, 2), "utf-8");
}

function isWithinPath(targetPath: string, parentPath: string): boolean {
  const target = path.normalize(targetPath);
  const parent = path.normalize(parentPath);
  if (process.platform === "win32") {
    return target.toLowerCase() === parent.toLowerCase() || target.toLowerCase().startsWith(`${parent.toLowerCase()}${path.sep}`);
  }
  return target === parent || target.startsWith(`${parent}${path.sep}`);
}

async function resolveProjectRoot(itemPath: string, explicitProjectRoot?: string): Promise<string> {
  if (explicitProjectRoot) return path.normalize(explicitProjectRoot);

  let current = path.normalize(path.dirname(itemPath));
  while (true) {
    const localNotesCandidate = path.join(current, LOCAL_NOTES_FOLDER);
    const localNotesCompatCandidate = path.join(current, ".localnotes");
    if (fsSync.existsSync(localNotesCandidate) || fsSync.existsSync(localNotesCompatCandidate)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.dirname(path.normalize(itemPath));
}

function buildNonConflictingRestorePath(originalPath: string): string {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const base = path.basename(originalPath, ext);
  const restoredDateString = new Date().toISOString().replace(/[T:.Z]/g, "-");
  const suffix = ` (restored ${restoredDateString})`;
  return path.join(dir, ext ? `${base}${suffix}${ext}` : `${base}${suffix}`);
}

async function applyTrashAutoPurge(projectRoot: string): Promise<void> {
  const settings = settingsManager.getResolvedGlobal();
  const autoPurgeDays = Number(settings?.trash?.autoPurgeDays ?? 30);
  if (!Number.isFinite(autoPurgeDays) || autoPurgeDays <= 0) return;

  const cutoff = Date.now() - autoPurgeDays * 24 * 60 * 60 * 1000;
  const index = await readTrashIndex(projectRoot);
  const retained: TrashIndexEntry[] = [];

  for (const entry of index) {
    const deletedAtMs = new Date(entry.deletedAt).getTime();
    const hasValidTimestamp = Number.isFinite(deletedAtMs);
    if (!hasValidTimestamp) {
      console.warn(`[Trash] Purging item with invalid deletedAt timestamp: ${entry.id}`);
    }
    const shouldPurge = !hasValidTimestamp || deletedAtMs < cutoff;
    if (!shouldPurge) {
      retained.push(entry);
      continue;
    }

    try {
      const stat = await fs.stat(entry.trashedPath);
      if (stat.isDirectory()) await fs.rm(entry.trashedPath, { recursive: true, force: true });
      else await fs.unlink(entry.trashedPath);
    } catch {
      // Keep index cleanup best-effort.
    }
  }

  await writeTrashIndex(projectRoot, retained);
}

(async () => {
    try {
        /**
         * Wait for Electron to finish initialization before using app APIs.
         */
        await app.whenReady();

        /**
         * Register centralized error plumbing as early as possible.
         * This ensures both renderer-reported errors and startup/runtime crashes
         * can be captured consistently.
         */
        registerErrorLoggingIpc();
        registerProcessLevelErrorHandlers();

        process.stderr.write("[Local Notes] Initializing config directory...\n");
        const configDirectoryPath = await ensureConfigDirectory();
        process.stderr.write(
            `[Local Notes] Config directory ready at: ${configDirectoryPath}\n`
        );

        /**
         * Load global settings before creating the main window so the initial
         * UI and menu state reflect the saved configuration.
         */
        const globalSettings = await settingsManager.loadGlobal();

  const mainWindow = createWindow("main", {
    width: 1000,
    height: 600,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), "app", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // Keep custom titlebar behavior only on macOS. On Windows, use native frame/titlebar
    // so the menu bar is visible and follows platform conventions.
    ...(process.platform === "darwin" ? { titleBarStyle: "hidden" as const } : {}),
  });

        mainWindowRef = mainWindow;

        /**
         * Register settings IPC handlers after the window reference exists.
         * This preserves the current app architecture and avoids unnecessary changes.
         */
        registerSettingsIpc(settingsManager, () => mainWindowRef);
        registerQuizIpc(quizSessionManager, quizWebSocketServer, () => mainWindowRef);

        try {
          await quizWebSocketServer.start();
          console.log("✓ Quiz session server ready");
        } catch (error) {
          logMainError(error, "quiz.server.start");
          console.error("✗ Failed to start quiz session server:", error);
        }

        /**
         * Context menu definition for standard text actions.
         */
        const contextTemplate: any = [
            { role: "copy" },
            { role: "cut" },
            { role: "paste" },
            { role: "selectall" },
        ];

  // Build menu from settings (keybindings-driven instead of hardcoded)
  const menuTemplate = buildMenuTemplate(globalSettings, mainWindow);
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  if (process.platform === "win32") {
    const keepMenuBarVisible = () => {
      if (mainWindow.isDestroyed() || mainWindow.isMenuBarAutoHide()) {
        return;
      }

      mainWindow.setMenuBarVisibility(true);
    };

    keepMenuBarVisible();
    mainWindow.on("restore", keepMenuBarVisible);
    mainWindow.on("maximize", keepMenuBarVisible);
    mainWindow.on("unmaximize", keepMenuBarVisible);
  }

        const contextMenu = Menu.buildFromTemplate(contextTemplate);

        mainWindow.webContents.on("context-menu", (_event, _params) => {
            contextMenu.popup();
        });

        /**
         * Load the correct renderer entry depending on environment.
         */
        if (isProd) {
            await mainWindow.loadURL("app://./home");
        } else {
            const port = process.argv[2];
            await mainWindow.loadURL(`http://localhost:${port}/home`);
        }

        /**
         * Initialize the database after the app window is ready.
         * If this fails, log through the central logger and then exit cleanly.
         */
        try {
            initializeDB();
            console.log("✓ Database ready");
        } catch (error) {
            logMainError(error, "database.initialize");
            console.error("✗ Failed to initialize database:", error);
            app.quit();
            return;
        }
    } catch (error) {
        /**
         * Final startup safety net.
         * Any failure during bootstrap gets logged to the same central system.
         */
        logMainError(error, "background.bootstrap");
        console.error("✗ Fatal startup error:", error);
        app.quit();
    }

    try {
        const { registerRagIpc } = require("./rag/ragService");
        registerRagIpc();
        console.log("✓ RAG service ready");
    } catch (error) {
        console.error("✗ Failed to load RAG service:", error);
    }
})();


app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
  quizWebSocketServer.stop();
  quizSessionManager.shutdown();
    void stopAllWatchers();
        closeDB();
        app.quit();
    }
});

app.on("will-quit", () => {
  quizWebSocketServer.stop();
  quizSessionManager.shutdown();
  void stopAllWatchers();
    closeDB();
});

let isFlushingWritesOnQuit = false;

app.on("before-quit", (event) => {
    if (isFlushingWritesOnQuit || !debouncedWriter.hasPending()) {
        closeDB();
        return;
    }

    event.preventDefault();
    isFlushingWritesOnQuit = true;

    void debouncedWriter
      .flushAll()
      .catch((error) => {
        console.error("Failed to flush pending writes before quit:", error);
      })
      .finally(() => {
        closeDB();
        app.quit();
      });
});

ipcMain.on("message", async (event, arg) => {
  event.reply("message", `${arg} World!`);
});

// File System Operations
ipcMain.handle("fs:readDirectory", async (event, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);
        return {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
        };
      })
    );
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:createFolder", async (event, folderPath: string) => {
  try {
    await fs.mkdir(folderPath, { recursive: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
    "fs:createFile",
    async (_event, filePath: string, content: string = "") => {
        const start = Date.now();

        try {
            const normalized = path.normalize(filePath);
            const parentDir = path.dirname(normalized);

            // Queue per directory (simple, low overhead)
            const queue = getQueue(parentDir);

            const out = await queue.enqueue(async () => {
                const { retriesUsed } = await withRetry(async () => {
                    await fs.mkdir(parentDir, { recursive: true });

                    // Atomic create: fails if exists
                    const handle = await fs.open(normalized, "wx");
                    try {
                        await handle.writeFile(content, { encoding: "utf-8" });
                    } finally {
                        await handle.close();
                    }
                });

                return { retriesUsed };
            });

            return {
                success: true,
                data: {
                    path: normalized,
                    ms: Date.now() - start,
                    retries: out.retriesUsed,
                },
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                code: error.code,
                ms: Date.now() - start,
            };
        }
    }
);

ipcMain.handle("fs:deleteItem", async (_event, itemPath: string, projectRoot?: string) => {
    const start = Date.now();
    try {
        const p = path.normalize(itemPath);
        const resolvedProjectRoot = await resolveProjectRoot(p, projectRoot);
        const trashRoot = await ensureTrashDirectory(resolvedProjectRoot);
        const queue = getQueue(path.dirname(p));

        await queue.enqueue(async () => {
            const stats = await fs.stat(p);
            await applyTrashAutoPurge(resolvedProjectRoot);

            if (isWithinPath(p, trashRoot)) {
                await withRetry(async () => {
                    if (stats.isDirectory()) await fs.rm(p, { recursive: true, force: true });
                    else await fs.unlink(p);
                });
                return;
            }

            const id = randomUUID();
            const trashedPath = path.join(trashRoot, `${id}__${path.basename(p)}`);

            await withRetry(async () => {
                await fs.rename(p, trashedPath);
            });

            const index = await readTrashIndex(resolvedProjectRoot);
            index.push({
              id,
              name: path.basename(p),
              originalPath: p,
              trashedPath,
              isDirectory: stats.isDirectory(),
              deletedAt: new Date().toISOString(),
            });
            await writeTrashIndex(resolvedProjectRoot, index);
        });

        return { success: true, data: { ms: Date.now() - start } };
    } catch (error: any) {
        return { success: false, error: error.message, code: error.code, ms: Date.now() - start };
    }
});

ipcMain.handle("fs:listTrash", async (_event, projectRoot: string) => {
  try {
    const resolvedProjectRoot = path.normalize(projectRoot);
    await ensureTrashDirectory(resolvedProjectRoot);
    await applyTrashAutoPurge(resolvedProjectRoot);

    const index = await readTrashIndex(resolvedProjectRoot);
    const existing: TrashIndexEntry[] = [];
    for (const entry of index) {
      if (fsSync.existsSync(entry.trashedPath)) {
        existing.push(entry);
      }
    }

    if (existing.length !== index.length) {
      await writeTrashIndex(resolvedProjectRoot, existing);
    }

    existing.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
    return { success: true, data: existing };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:restoreTrashItem", async (_event, projectRoot: string, itemId: string) => {
  try {
    const resolvedProjectRoot = path.normalize(projectRoot);
    const index = await readTrashIndex(resolvedProjectRoot);
    const item = index.find((entry) => entry.id === itemId);
    if (!item) {
      return { success: false, error: "Trash item not found." };
    }

    const itemExists = fsSync.existsSync(item.trashedPath);
    if (!itemExists) {
      await writeTrashIndex(resolvedProjectRoot, index.filter((entry) => entry.id !== itemId));
      return { success: false, error: "Trashed file no longer exists." };
    }

    let restorePath = item.originalPath;
    if (fsSync.existsSync(restorePath)) {
      restorePath = buildNonConflictingRestorePath(restorePath);
    }

    await fs.mkdir(path.dirname(restorePath), { recursive: true });
    await withRetry(async () => {
      await fs.rename(item.trashedPath, restorePath);
    });

    await writeTrashIndex(
      resolvedProjectRoot,
      index.filter((entry) => entry.id !== itemId)
    );

    return { success: true, data: { restoredPath: restorePath } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:deleteTrashItem", async (_event, projectRoot: string, itemId: string) => {
  try {
    const resolvedProjectRoot = path.normalize(projectRoot);
    const index = await readTrashIndex(resolvedProjectRoot);
    const item = index.find((entry) => entry.id === itemId);
    if (!item) {
      return { success: false, error: "Trash item not found." };
    }

    if (fsSync.existsSync(item.trashedPath)) {
      const stats = await fs.stat(item.trashedPath);
      if (stats.isDirectory()) await fs.rm(item.trashedPath, { recursive: true, force: true });
      else await fs.unlink(item.trashedPath);
    }

    await writeTrashIndex(
      resolvedProjectRoot,
      index.filter((entry) => entry.id !== itemId)
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle("fs:renameItem", async (_event, oldPath: string, newPath: string) => {
    const start = Date.now();
    try {
        const oldN = path.normalize(oldPath);
        const newN = path.normalize(newPath);
        const queue = getQueue(path.dirname(oldN));

        await queue.enqueue(async () => {
            await withRetry(() => fs.rename(oldN, newN));
        });

        return { success: true, data: { ms: Date.now() - start } };
    } catch (error: any) {
        return { success: false, error: error.message, code: error.code, ms: Date.now() - start };
    }
});


ipcMain.handle("fs:readFile", async (event, filePath: string) => {
  try {
        const ext = path.extname(filePath).toLowerCase();
        const baseName = path.basename(filePath).toLowerCase();

        // Define file types
        const textExtensions = ['.md', '.txt', '.tex', '.json', '.js', '.ts', '.css', '.html', '.canvas', '.xml', '.yaml', '.yml'];
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico'];

        // Read as text
        if (textExtensions.includes(ext) || baseName === '.env') {
    const content = await fs.readFile(filePath, "utf-8");
            return { success: true, data: content, type: 'text' };
        }

        // Read as binary (base64) for images
        if (imageExtensions.includes(ext)) {
            // Map extensions to proper MIME types
            const mimeTypes: { [key: string]: string } = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.bmp': 'image/bmp',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp',
                '.ico': 'image/x-icon'
            };
            const mime = mimeTypes[ext] || 'image/png';

            let buffer = await fs.readFile(filePath);

            // Self-heal: if the file was corrupted by a previous autosave writing a
            // data URL as text, decode it back to the original binary and restore the file.
            const asText = buffer.toString('utf-8');
            const dataUrlPrefix = asText.match(/^data:([^;]+);base64,/);
            if (dataUrlPrefix) {
                const cleanBase64 = asText.slice(dataUrlPrefix[0].length).trim();
                const restored = Buffer.from(cleanBase64, 'base64');
                await fs.writeFile(filePath, restored);
                return {
                    success: true,
                    data: cleanBase64,
                    type: 'binary',
                    mimeType: dataUrlPrefix[1] || mime,
                };
            }

            const base64 = buffer.toString('base64');
            return {
                success: true,
                data: base64,
                type: 'binary',
                mimeType: mime,
            };
        }

        // Unsupported file type
        return {
            success: false,
            error: `Unsupported file type: ${ext}`
        };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:writeFile", async (event, filePath: string, content: string) => {
  try {
    await debouncedWriter.enqueue(filePath, content, {
      debounceMs: 250,
      maxWaitMs: 1200,
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:openFolderDialog", async () => {
  try {
    console.log(getConfigDirectoryPath())
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    return { success: true, data: result.filePaths[0] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

//Save note content to file
ipcMain.handle("autosave:save", async (_event, { filePath, content }) => {
  try {
    if (!filePath) throw new Error("Missing file path");
    await debouncedWriter.enqueue(filePath, content, {
      debounceMs: 600,
      maxWaitMs: 2000,
    });
    return { success: true };
  } catch (error) {
    console.error("Autosave error:", error);
    return { success: false, error: String(error) };
  }
});

//Load note content from file
ipcMain.handle("autosave:load", async (_event, filePath: string) => {
  try {
    if (!filePath || !fsSync.existsSync(filePath)) return ""; // use fsSync for existsSync
    const data = await fs.readFile(filePath, "utf-8"); // no .promises
    return data;
  } catch (error) {
    console.error("Load error:", error);
    return "";
  }
});

ipcMain.handle("fs:exists", async (_event, targetPath: string) => {
  try {
    const exists = fsSync.existsSync(targetPath);
    return { success: true, data: exists };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("fs:isDirectory", async (_, path: string) => {
  try {
    const stat = await fs.stat(path);
    return { success: true, data: stat.isDirectory() };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle("fs:selectImportFiles", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openFile", "multiSelections"],
        filters: [
            {
                name: "Notes & Images",
                extensions: ["md", "docx", "txt", "pdf", "canvas", "png", "jpg", "jpeg", "gif", "webp"],
            },
        ],
    });
    if (result.canceled) return { success: false };
    return { success: true, paths: result.filePaths };
});


ipcMain.handle("tags:load", (event, projectRoot: string) => {
  return loadTags(projectRoot);
});

ipcMain.handle("tags:update", (event, projectRoot: string, itemPath: string, tags: any[]) => {
  updateTags(projectRoot, itemPath, tags);
  return { success: true };
});

ipcMain.handle("tags:remove", (event, projectRoot: string, itemPath: string) => {
  removeTags(projectRoot, itemPath);
  return { success: true };
});
ipcMain.handle("fs:mergeFiles", async (event, fileNames: string[], targetNotePath: string) => {
    try {
        let targetContent = await fs.readFile(targetNotePath, "utf-8");

        for (const fileName of fileNames) {
            const ext = path.extname(fileName).toLowerCase();

            // Check if it's an image
            if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'].includes(ext)) {
                // Append markdown image syntax with just the filename
                targetContent += `\n\n![${fileName}](${fileName})\n`;
            } else {
                // For text files, read and append content
                const fullPath = path.join(path.dirname(targetNotePath), fileName);
                const content = await fs.readFile(fullPath, "utf-8");
                targetContent += `\n\n${content}\n`;
            }
        }

        await fs.writeFile(targetNotePath, targetContent, "utf-8");
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

// Change copyFile to async
ipcMain.handle("fs:copyFile", async (event, src, dest) => {
    try {
        await fs.copyFile(src, dest);  // Add await and use fs.copyFile
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle("fs:importFolder", async (event, sourcePath: string, targetPath: string) => {
    try {
        // Get the folder name from the source path
        const folderName = path.basename(sourcePath);

        // Create the destination path with the folder name
        const destPath = path.join(targetPath, folderName);

        // Prevent copying into itself or subdirectory
        const relative = path.relative(sourcePath, destPath);
        if (sourcePath === destPath || (relative && !relative.startsWith('..') && !path.isAbsolute(relative))) {
             throw new Error("Cannot copy a folder into itself or its subdirectory.");
        }

        // Recursively copy folder contents
        const copyFolderRecursive = async (src: string, dest: string) => {
            // Create destination directory if it doesn't exist
            if (!fsSync.existsSync(dest)) {
                await fs.mkdir(dest, { recursive: true });
            }

            const entries = await fs.readdir(src, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                // Skip if the entry is the destination folder itself (just in case)
                if (srcPath === destPath) continue;

                if (entry.isDirectory()) {
                    await copyFolderRecursive(srcPath, destPath);
                } else {
                    await fs.copyFile(srcPath, destPath);
                }
            }
        };

        // Start copying from source to the new folder in target
        await copyFolderRecursive(sourcePath, destPath);

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("fs:selectExportDestination", async () => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ["openDirectory"]
        });
        if (result.canceled) return { success: false, canceled: true };
        return { success: true, folder: result.filePaths[0] };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("fs:exportFile", async (_, sourceFile, destFolder) => {
    try {
        const fileName = path.basename(sourceFile);
        const destPath = path.join(destFolder, fileName);

        fs.copyFile(sourceFile, destPath);

        return { success: true, exportedTo: destPath };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});


ipcMain.handle("fs:exportFolder", async (_, sourceFolder: string, targetFolder: string) => {
    try {
        const folderName = path.basename(sourceFolder);
        const destination = path.join(targetFolder, folderName);

        const copyFolderRecursiveSync = (src: string, dest: string) => {
            // Create destination folder if missing
            if (!fsSync.existsSync(dest)) {
                fsSync.mkdirSync(dest, { recursive: true });
            }

            // Read items inside source folder
            const items = fsSync.readdirSync(src, { withFileTypes: true });

            for (const item of items) {
                const srcPath = path.join(src, item.name);
                const destPath = path.join(dest, item.name);

                if (item.isDirectory()) {
                    // Recursively copy subfolders
                    copyFolderRecursiveSync(srcPath, destPath);
                } else {
                    // Copy files directly
                    fsSync.copyFileSync(srcPath, destPath);
                }
            }
        }
        copyFolderRecursiveSync(sourceFolder, destination);

        return { success: true, importedTo: destination };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle("db:addDirectory", async (_, uuid: string, path: string) => {
    try {
        const result = addDirectory(uuid, path);
    startWatching(uuid, path);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:updateDirectory", async (_, id: UUID, name?: string, path?: string) => {
    try {
        const result = updateDirectory(id, path);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:deleteDirectory", async (_, id: UUID) => {
    try {
    await stopWatching(id);
        deleteDirectory(id);
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:getDirectory", async (_, id: UUID) => {
    try {
        const data = getDirectory(id);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:getAllDirectories", async () => {
    try {
        const data = getAllDirectories();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:getDirectoryIdByPath", async (_, path: string) => {
    try {
        const { getDirectoryIdByPath } = require("./database/documentRepository");
        const id = getDirectoryIdByPath(path);
        return { success: true, data: id };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// ========== FILES ==========
ipcMain.handle("db:addFile", async (_, directoryId: UUID, filePath: string, fileHash: string, lastModified: number) => {
    try {
        const result = addFile(directoryId, filePath, fileHash, lastModified);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:updateFileHash", async (_, fileId: UUID, fileHash: string, lastModified: number) => {
    try {
        const result = updateFileHash(fileId, fileHash, lastModified);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:deleteFile", async (_, fileId: UUID) => {
    try {
        deleteFile(fileId);
        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:getFilesByDirectory", async (_, directoryId: UUID) => {
    try {
        const data = getFilesByDirectory(directoryId);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

// ========== CHUNKS ==========
ipcMain.handle("db:addChunk", async (_, fileId: UUID, contentHash: string, content: string) => {
    try {
        const result = addChunk(fileId, contentHash, content);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:addEmbedding", async (_, embedding: Float32Array | number[]) => {
    try {
        const result = addEmbedding(embedding);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:addEmbeddings", async (_, embeddings: Array<{
    embedding: Float32Array | number[];
}>) => {
    try {
        // Use existing addChunk in a loop
        const results = [];
        for (const embedding of embeddings) {
            const result = addEmbedding(
                embedding.embedding
            );
            results.push(result);
        }
        return { success: true, data: results };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});


ipcMain.handle("db:addChunks", async (_, chunks: Array<{
    fileId: UUID;
    directoryId: UUID;
    contentHash: string;
    content: string;
}>) => {
    try {
        // Use existing addChunk in a loop
        const results = [];
        for (const chunk of chunks) {
            const result = addChunk(
                chunk.fileId,
                chunk.contentHash,
                chunk.content,
            );
            results.push(result);
        }
        return { success: true, data: results };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:deleteChunksByFile", async (_, fileId: UUID) => {
    try {
        const result = deleteChunksByFile(fileId);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:getChunksByDirectory", async (_, directoryId: UUID) => {
    try {
        const data = getChunksByDirectory(directoryId);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("db:getChunksByFile", async (_, fileId: UUID) => {
    try {
        const data = getChunksByFile(fileId);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("chunker:chunkDirectory", async (_, directoryPath: string, config?: DirectoryChunkerConfig) => {
    try {
        const result = await chunkDirectory(directoryPath, config);
        return { success: true, data: result };
    } catch (error) {
        console.error("Failed to chunk directory:", error);
        return { success: false, error: (error as Error).message };
    }
});

ipcMain.handle("chunker:chunkFile", async (_, filePath: string, config?: DirectoryChunkerConfig["chunkingConfig"]) => {
    try {
        const chunks = await chunkSingleFile(filePath, config);
        return { success: true, data: chunks };
    } catch (error) {
        console.error("Failed to chunk file:", error);
        return { success: false, error: (error as Error).message };
    }
});

// ========== DATABASE INDEXING (chunk + embed + store) ==========

/**
 * Index a directory: chunk files, generate placeholder embeddings, and store in database
 */
ipcMain.handle("indexer:indexDirectory", async (_, directoryId: string, directoryPath: string, config?: DirectoryChunkerConfig) => {
    try {
        console.log(`Starting indexing for directory: ${directoryPath}`);
        console.log("Using placeholder embeddings (384-dimensional vectors)");

    if (!isWatching(directoryId)) {
      startWatching(directoryId, directoryPath);
    }
        
        const stats = await chunkAndStoreDirectory(directoryId, directoryPath, config);
        return { success: true, data: stats };
    } catch (error) {
        console.error("Failed to index directory:", error);
        return { success: false, error: (error as Error).message };
    }
});

/**
 * Index a single file to database with placeholder embeddings
 */
ipcMain.handle("indexer:indexFile", async (_, directoryId: string, filePath: string, config?: any) => {
    try {
        console.log(`Indexing file: ${filePath}`);
        console.log("Using placeholder embeddings (384-dimensional vectors)");

        const result = await chunkAndStoreFile(directoryId, filePath, config);
        return { success: true, data: result };
    } catch (error) {
        console.error("Failed to index file:", error);
        return { success: false, error: (error as Error).message };
    }
});

    ipcMain.handle("watcher:start", async (_, directoryId: UUID, directoryPath: string) => {
      try {
        startWatching(directoryId, directoryPath);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("watcher:stop", async (_, directoryId: UUID) => {
      try {
        await stopWatching(directoryId);
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("watcher:stopAll", async () => {
      try {
        await stopAllWatchers();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("watcher:getActive", async () => {
      try {
        return { success: true, data: getActiveWatchers() };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle("watcher:isWatching", async (_, directoryId: UUID) => {
      try {
        return { success: true, data: isWatching(directoryId) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });
