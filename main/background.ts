import path from "path";
import { app, ipcMain, Menu, dialog, shell } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers";
import fs from "fs/promises";
import * as fsSync from "fs";

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
          ? [{ type: "separator" }, { role: "front" }, { type: "separator" }, { role: "window" }]
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

ipcMain.handle("fs:createFile", async (event, filePath: string, content: string = "") => {
  try {
    await fs.writeFile(filePath, content, "utf-8");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

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

ipcMain.handle("fs:renameItem", async (event, oldPath: string, newPath: string) => {
  try {
    const exists = await fs.stat(oldPath).catch(() => null);
    if (!exists) {
      throw new Error("Source not found: ${oldPath}");
    }
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("fs:readFile", async (event, filePath: string) => {
    try {
        const ext = path.extname(filePath).toLowerCase();

        // Define file types
        const textExtensions = ['.md', '.txt', '.json', '.js', '.ts', '.css', '.html', '.canvas', '.xml', '.yaml', '.yml'];
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico'];

        // Read as text
        if (textExtensions.includes(ext)) {
            const content = await fs.readFile(filePath, "utf-8");
            return { success: true, data: content, type: 'text' };
        }

        // Read as binary (base64) for images
        if (imageExtensions.includes(ext)) {
            const buffer = await fs.readFile(filePath);
            const base64 = buffer.toString('base64');

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

            return {
                success: true,
                data: base64,
                type: 'binary',
                mimeType: mimeTypes[ext] || 'image/png'
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
    await fs.writeFile(filePath, content, "utf-8");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

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


