import path from "path";
import { app, ipcMain, Menu, dialog } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers";
import fs from "fs/promises";
import fsSync from "fs";

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
    private tabs: TabData[] = [{
        id: 0,
        filePath: null,
        content: ''
    }];
    private selectedTabId: number = 0;
    private nextTabId: number = 1;

    getAllTabIds(): number[] {
        return this.tabs.map(tab => tab.id);
    }

    getSelectedTabId(): number {
        return this.selectedTabId;
    }

    getTabContent(id: number): string {
        const tab = this.tabs.find(t => t.id === id);
        return tab ? tab.content : '';
    }

    getTabFilePath(id: number): string | null {
        const tab = this.tabs.find(t => t.id === id);
        return tab ? tab.filePath : null;
    }

    setTabContent(id: number, content: string): void {
        const tab = this.tabs.find(t => t.id === id);
        if (tab) {
            tab.content = content;
        }
    }

    setTabFilePath(id: number, filePath: string | null): void {
        const tab = this.tabs.find(t => t.id === id);
        if (tab) {
            tab.filePath = filePath;
        }
    }

    select(id: number): void {
        if (this.tabs.some(tab => tab.id === id)) {
            this.selectedTabId = id;
        }
    }

    close(id: number): void {
        const index = this.tabs.findIndex(tab => tab.id === id);
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
                    content: ''
                });
            }
        }
    }

    new(): number {
        const newId = this.nextTabId++;
        this.tabs.push({
            id: newId,
            filePath: null,
            content: ''
        });
        this.selectedTabId = newId;
        return newId;
    }

    reorder(ids: number[]): void {
        if (ids.length === this.tabs.length && ids.every(id => this.tabs.some(tab => tab.id === id))) {
            this.tabs = ids.map(id => this.tabs.find(tab => tab.id === id)!);
        }
    }
}

const tabManager = new TabManager();

// IPC handlers for tab management
ipcMain.handle('tabs:getAllTabIds', () => tabManager.getAllTabIds());
ipcMain.handle('tabs:getSelectedTabId', () => tabManager.getSelectedTabId());
ipcMain.handle('tabs:select', (_, id: number) => tabManager.select(id));
ipcMain.handle('tabs:close', (_, id: number) => tabManager.close(id));
ipcMain.handle('tabs:new', () => tabManager.new());
ipcMain.handle('tabs:reorder', (_, ids: number[]) => tabManager.reorder(ids));
ipcMain.handle('tabs:getContent', (_, id: number) => tabManager.getTabContent(id));
ipcMain.handle('tabs:setContent', (_, { id, content }: { id: number; content: string }) => tabManager.setTabContent(id, content));
ipcMain.handle('tabs:getFilePath', (_, id: number) => tabManager.getTabFilePath(id));
ipcMain.handle('tabs:setFilePath', (_, { id, filePath }: { id: number; filePath: string | null }) => tabManager.setTabFilePath(id, filePath));

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

(async () => {
  await app.whenReady();

  const mainWindow = createWindow("main", {
    width: 1000,
    height: 600,
    webPreferences: {
        preload: path.join(app.getAppPath(), "app", "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, 
    },
    // remove the default titlebar
    titleBarStyle: "hidden",
    // expose window controls in Windows/Linux
    ...(process.platform !== "darwin" ? { titleBarOverlay: true } : {}),
  });

  // for context menu the one that pops up when you right click
  const contextTemplate: any = [
    { role: "copy" },
    { role: "cut" },
    { role: "paste" },
    { role: "selectall" },
  ];

  //for menubar
  const template: any = [
    // { role: 'appMenu' }
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    // { role: 'fileMenu' }
    {
      label: "File",
      submenu: [
        isMac ? { role: "close" } : { role: "quit" },
        {
          //open files
          label: "Open File...",
          click: () => dialog.showMessageBox({ message: "Opening file..." }),
          accelerator: "CommandOrControl+O",
        },
        {
          //open folder
          label: "Open Folder...",
        },
      ],
    },
    // { role: 'editMenu' }
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
              { type: "separator" },
              {
                label: "Speech",
                submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
              },
            ]
          : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
      ],
    },
    // { role: 'viewMenu' }
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    // { role: 'windowMenu' }
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
    {
      // Open/Close developer tools
      label: "Toggle Developer Tools",
      click: () => mainWindow.webContents.toggleDevTools(),
      accelerater: isMac ? "Command+Option+I" : "Control+Shift+I",
    },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://electronjs.org");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  const contextMenu = Menu.buildFromTemplate(contextTemplate);

  mainWindow.webContents.on("context-menu", (_event, params) => {
    contextMenu.popup();
  });

  if (isProd) {
    await mainWindow.loadURL("app://./home");
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/home`);
  }
})();

app.on("window-all-closed", () => {
  app.quit();
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
  async (event, filePath: string, content: string = "") => {
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("fs:deleteItem", async (event, itemPath: string) => {
  try {
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await fs.rm(itemPath, { recursive: true, force: true });
    } else {
      await fs.unlink(itemPath);
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "fs:renameItem",
  async (event, oldPath: string, newPath: string) => {
      try {
          const exists = await fs.stat(oldPath).catch(() => null);
          if (!exists) {
              throw new Error('Source not found: ${oldPath}');
          }
          await fs.rename(oldPath, newPath);
          return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("fs:readFile", async (event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { success: true, data: content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "fs:writeFile",
  async (event, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle("fs:openFolderDialog", async () => {
  try {
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
    await fs.writeFile(filePath, content, "utf-8"); // no .promises
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