/**
 * Manages the hidden ".Local Notes" folder within each notes directory.
 * This folder stores per-project settings and metadata.
 * They should not appear in the normal user workflow but remain accessible to the app.
 */

import path from "path";
import fs from "fs/promises";
import * as fsSync from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Constants
export const LOCAL_NOTES_FOLDER = ".Local Notes";
export const PROJECT_SETTINGS_FILE = "project-settings.json";

//Default project settings structure
export interface ProjectSettings {
  version: string;
  createdAt: string;
  lastModified: string;
  preferences: {
    defaultView?: "preview" | "edit" | "split";
    sortBy?: "name" | "modified" | "created";
    sortOrder?: "asc" | "desc";
  };
  recentFiles: string[];
  pinnedFiles: string[];
}

const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  version: "1.0.0",
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  preferences: {
    defaultView: "split",
    sortBy: "name",
    sortOrder: "asc",
  },
  recentFiles: [],
  pinnedFiles: [],
};

//Get the path to the .Local Notes folder for a given project root
export function getLocalNotesFolderPath(projectRoot: string): string {
  return path.join(projectRoot, LOCAL_NOTES_FOLDER);
}

//Get the path to the project settings file
export function getProjectSettingsFilePath(projectRoot: string): string {
  const localNotesPath = getLocalNotesFolderPath(projectRoot);
  return path.join(localNotesPath, PROJECT_SETTINGS_FILE);
}

//Check if a path is the .Local Notes folder or inside it
export function isLocalNotesPath(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  const parts = normalized.split(path.sep);
  return parts.includes(LOCAL_NOTES_FOLDER);
}

//Hide a folder on Windows by setting the hidden attribute. On Unix systems, folders starting with '.' are already hidden
async function hideFolderOnWindows(folderPath: string): Promise<void> {
  if (process.platform === "win32") {
    try {
      await execAsync(`attrib +h "${folderPath}"`);
    } catch (error) {
      console.warn("Failed to set hidden attribute on Windows:", error);
      // Non-critical error, continue anyway
    }
  }
}

//Initialize the .Local Notes folder for a project. Creates the folder if it doesn't exist and ensures it's hidden
export async function ensureLocalNotesFolder(projectRoot: string): Promise<string> {
  const localNotesPath = getLocalNotesFolderPath(projectRoot);

  try {
    // Check if folder exists
    const exists = fsSync.existsSync(localNotesPath);
    
    if (!exists) {
      // Create the folder
      await fs.mkdir(localNotesPath, { recursive: true });
      console.log(`[Project Settings] Created .Local Notes folder at: ${localNotesPath}`);
      
      // Hide the folder on Windows
      await hideFolderOnWindows(localNotesPath);
    }

    // Ensure project settings file exists
    const settingsFilePath = getProjectSettingsFilePath(projectRoot);
    const settingsExists = fsSync.existsSync(settingsFilePath);
    
    if (!settingsExists) {
      await saveProjectSettings(projectRoot, DEFAULT_PROJECT_SETTINGS);
      console.log(`[Project Settings] Created project-settings.json`);
    }

    return localNotesPath;
  } catch (error) {
    console.error("[Project Settings] Failed to ensure .Local Notes folder:", error);
    throw error;
  }
}

//Load project settings from the .Local Notes folder. Returns default settings if file doesn't exist or on error
export async function loadProjectSettings(projectRoot: string): Promise<ProjectSettings> {
  const settingsFilePath = getProjectSettingsFilePath(projectRoot);

  try {
    if (!fsSync.existsSync(settingsFilePath)) {
      console.log("[Project Settings] Settings file not found, using defaults");
      return { ...DEFAULT_PROJECT_SETTINGS };
    }

    const content = await fs.readFile(settingsFilePath, "utf-8");
    const settings = JSON.parse(content);

    // Merge with defaults to ensure all fields exist (for backwards compatibility)
    return {
      ...DEFAULT_PROJECT_SETTINGS,
      ...settings,
      preferences: {
        ...DEFAULT_PROJECT_SETTINGS.preferences,
        ...settings.preferences,
      },
    };
  } catch (error) {
    console.error("[Project Settings] Failed to load project settings:", error);
    return { ...DEFAULT_PROJECT_SETTINGS };
  }
}

//Save project settings to the .Local Notes folder
export async function saveProjectSettings(
  projectRoot: string,
  settings: ProjectSettings
): Promise<void> {
  const settingsFilePath = getProjectSettingsFilePath(projectRoot);

  try {
    // Ensure .Local Notes folder exists
    await ensureLocalNotesFolder(projectRoot);

    // Update lastModified timestamp
    const updatedSettings = {
      ...settings,
      lastModified: new Date().toISOString(),
    };

    // Write settings to file
    await fs.writeFile(
      settingsFilePath,
      JSON.stringify(updatedSettings, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("[Project Settings] Failed to save project settings:", error);
    throw error;
  }
}

//Update specific project setting values
export async function updateProjectSettings(
  projectRoot: string,
  updates: Partial<ProjectSettings>
): Promise<ProjectSettings> {
  const currentSettings = await loadProjectSettings(projectRoot);
  
  const newSettings: ProjectSettings = {
    ...currentSettings,
    ...updates,
    preferences: {
      ...currentSettings.preferences,
      ...(updates.preferences || {}),
    },
  };

  await saveProjectSettings(projectRoot, newSettings);
  return newSettings;
}

//Add a file to recent files list (max 20 entries)
export async function addRecentFile(projectRoot: string, filePath: string): Promise<void> {
  const settings = await loadProjectSettings(projectRoot);
  
  // Remove if already exists
  const recentFiles = settings.recentFiles.filter(f => f !== filePath);
  
  // Add to front
  recentFiles.unshift(filePath);
  
  // Keep only last 20
  const trimmedRecent = recentFiles.slice(0, 20);
  
  await updateProjectSettings(projectRoot, { recentFiles: trimmedRecent });
}

//Toggle a file in the pinned files list
export async function togglePinnedFile(projectRoot: string, filePath: string): Promise<boolean> {
  const settings = await loadProjectSettings(projectRoot);
  
  const isPinned = settings.pinnedFiles.includes(filePath);
  
  let newPinnedFiles: string[];
  if (isPinned) {
    // Remove from pinned
    newPinnedFiles = settings.pinnedFiles.filter(f => f !== filePath);
  } else {
    // Add to pinned
    newPinnedFiles = [...settings.pinnedFiles, filePath];
  }
  
  await updateProjectSettings(projectRoot, { pinnedFiles: newPinnedFiles });
  
  return !isPinned; // Return new pinned state
}
