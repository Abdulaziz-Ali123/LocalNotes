/**
 * SettingsManager
 *
 * Central class that handles loading, saving, getting, setting, and resetting
 * settings for both global and project scopes. It deep-merges user overrides
 * on top of defaults and writes the full resolved settings (including all
 * defaults) to disk so the JSON file is always complete and visible — even
 * before the user changes anything.
 *
 * Path resolution is delegated to utility functions provided by teammates
 * (Tickets 1 & 2). During development, stub fallbacks are used.
 * Git-history contributors: Shaun
 */

import path from "path";
import fs from "fs/promises";
import * as fsSync from "fs";
import { resolveConfigDirectoryPath } from "../helpers/config-dir";
import {
  GlobalSettings,
  ProjectSettings,
  SettingsFile,
  GlobalPathResolver,
  ProjectPathResolver,
} from "./schema";
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PROJECT_SETTINGS,
  LATEST_SCHEMA_VERSION,
} from "./defaults";
import { migrateSettings } from "./migrations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deep-merge source into target (target values are overridden). */
/**
 * Functionality: deepMerge performs the deep merge workflow used by main/settings/settings-manager.ts.
 * Parameters: target (T); source (Partial<T>).
 * Returns: Returns T.
 * Usage: Call deepMerge from the owning module or component when this behavior is required.
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const srcVal = source[key];
    if (
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, any>,
        srcVal as Record<string, any>
      ) as T[keyof T];
    } else if (srcVal !== undefined) {
      result[key] = srcVal as T[keyof T];
    }
  }
  return result;
}

/**
 * Resolve a nested property via a dot-path string.
 * e.g. getByPath(obj, "appearance.theme") -> obj.appearance.theme
 */
/**
 * Functionality: getByPath performs the get by path workflow used by main/settings/settings-manager.ts.
 * Parameters: obj (Record<string, any>); dotPath (string).
 * Returns: Returns any.
 * Usage: Call getByPath from the owning module or component when this behavior is required.
 */
function getByPath(obj: Record<string, any>, dotPath: string): any {
  return dotPath.split(".").reduce((acc, part) => acc?.[part], obj);
}

/**
 * Set a nested property via a dot-path string (immutable, returns new object).
 * e.g. setByPath(obj, "appearance.theme", "dark")
 */
/**
 * Functionality: setByPath performs the set by path workflow used by main/settings/settings-manager.ts.
 * Parameters: obj (Record<string, any>); dotPath (string); value (any).
 * Returns: Returns Record<string, any>.
 * Usage: Call setByPath from the owning module or component when this behavior is required.
 */
function setByPath(obj: Record<string, any>, dotPath: string, value: any): Record<string, any> {
  const parts = dotPath.split(".");
  const clone = structuredClone(obj);
  let current: any = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
  return clone;
}

/**
 * Delete a nested property via a dot-path string (resets to default).
 */
/**
 * Functionality: deleteByPath performs the delete by path workflow used by main/settings/settings-manager.ts.
 * Parameters: obj (Record<string, any>); dotPath (string).
 * Returns: Returns Record<string, any>.
 * Usage: Call deleteByPath from the owning module or component when this behavior is required.
 */
function deleteByPath(obj: Record<string, any>, dotPath: string): Record<string, any> {
  const parts = dotPath.split(".");
  const clone = structuredClone(obj);
  let current: any = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) return clone;
    current = current[parts[i]];
  }
  delete current[parts[parts.length - 1]];
  return clone;
}

// ---------------------------------------------------------------------------
// Path resolvers
// ---------------------------------------------------------------------------

/** Global settings dir -- uses Wesley's cross-platform config directory (Ticket 1). */
/**
 * Functionality: globalPath performs the global path workflow used by main/settings/settings-manager.ts.
 * Parameters: None.
 * Returns: Returns string.
 * Usage: Call globalPath from the owning module or component when this behavior is required.
 */
function globalPath(): string {
  return resolveConfigDirectoryPath();
}

/** Project settings dir -- stub until Atharva's Ticket 2 is merged. */
/**
 * Functionality: projectPath performs the project path workflow used by main/settings/settings-manager.ts.
 * Parameters: projectRoot (string).
 * Returns: Returns string.
 * Usage: Call projectPath from the owning module or component when this behavior is required.
 */
function projectPath(projectRoot: string): string {
  return path.join(projectRoot, ".Local Notes");
}

// ---------------------------------------------------------------------------
// SettingsManager
// ---------------------------------------------------------------------------

const SETTINGS_FILENAME = "settings.json";

export interface SettingsManagerOptions {
  getGlobalDir?: GlobalPathResolver;
  getProjectDir?: ProjectPathResolver;
}

/**
 * Class functionality: Defines the SettingsManager class used by main/settings/settings-manager.ts.
 * Parameters: Constructor parameters are documented on the constructor when applicable.
 * Returns: Returns the class constructor for creating or organizing related behavior.
 * Usage: Instantiate or reference SettingsManager from modules that need this grouped behavior.
 */
export class SettingsManager {
  private getGlobalDir: GlobalPathResolver;
  private getProjectDir: ProjectPathResolver;

  /** In-memory cache of the user's global overrides (sparse — NOT merged with defaults). */
  private globalOverrides: Partial<GlobalSettings> = {};

  /** In-memory cache of project overrides, keyed by project root. */
  private projectOverrides: Map<string, Partial<ProjectSettings>> = new Map();

    /**
   * Constructor functionality: Initializes constructor state and dependencies for its class.
   * Parameters: options (SettingsManagerOptions).
   * Returns: Returns a configured class instance through normal construction.
   * Usage: Call constructor from the owning module or component when this behavior is required.
   */
constructor(options: SettingsManagerOptions = {}) {
    this.getGlobalDir = options.getGlobalDir ?? globalPath;
    this.getProjectDir = options.getProjectDir ?? projectPath;
  }

  // -------------------------------------------------------------------------
  // Global settings
  // -------------------------------------------------------------------------

  /** Full path to the global settings JSON file. */
    /**
   * Functionality: globalFilePath performs the global file path workflow used by main/settings/settings-manager.ts.
   * Parameters: None.
   * Returns: Returns string.
   * Usage: Call globalFilePath from the owning module or component when this behavior is required.
   */
private get globalFilePath(): string {
    return path.join(this.getGlobalDir(), SETTINGS_FILENAME);
  }

  /** Load global settings from disk, run migrations, cache overrides. */
    /**
   * Functionality: loadGlobal performs the load global workflow used by main/settings/settings-manager.ts.
   * Parameters: None.
   * Returns: Returns Promise<GlobalSettings>.
   * Usage: Call loadGlobal from the owning module or component when this behavior is required.
   */
async loadGlobal(): Promise<GlobalSettings> {
    const filePath = this.globalFilePath;
    console.log("[Settings] Loading global settings from:", filePath);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const file: SettingsFile<Partial<GlobalSettings>> = JSON.parse(raw);

      let overrides = file.settings ?? {};

      // Migrate if needed
      if (file.version < LATEST_SCHEMA_VERSION) {
        overrides = migrateSettings(
          overrides as Record<string, any>,
          file.version
        ) as Partial<GlobalSettings>;
      }

      this.globalOverrides = overrides;
      console.log("[Settings] Loaded settings:", JSON.stringify(overrides));
    } catch (err) {
      // File doesn't exist or is corrupt — start fresh
      console.log("[Settings] No existing settings file, starting fresh:", (err as Error).message);
      this.globalOverrides = {};
    }

    // Always persist the full resolved settings (including defaults) to disk
    // so the JSON file is visible and complete from the very first launch.
    await this.saveGlobal();

    return this.getResolvedGlobal();
  }

  /** Get the fully resolved global settings (defaults + overrides). */
    /**
   * Functionality: getResolvedGlobal performs the get resolved global workflow used by main/settings/settings-manager.ts.
   * Parameters: None.
   * Returns: Returns GlobalSettings.
   * Usage: Call getResolvedGlobal from the owning module or component when this behavior is required.
   */
getResolvedGlobal(): GlobalSettings {
    return deepMerge(DEFAULT_GLOBAL_SETTINGS, this.globalOverrides);
  }

  /** Get a single global setting by dot-path (e.g. "appearance.theme"). */
    /**
   * Functionality: getGlobal performs the get global workflow used by main/settings/settings-manager.ts.
   * Parameters: dotPath (string).
   * Returns: Returns any.
   * Usage: Call getGlobal from the owning module or component when this behavior is required.
   */
getGlobal(dotPath: string): any {
    const resolved = this.getResolvedGlobal();
    return getByPath(resolved as unknown as Record<string, any>, dotPath);
  }

  /** Set a single global setting by dot-path. Persists to disk. */
    /**
   * Functionality: setGlobal performs the set global workflow used by main/settings/settings-manager.ts.
   * Parameters: dotPath (string); value (any).
   * Returns: Returns Promise<GlobalSettings>.
   * Usage: Call setGlobal from the owning module or component when this behavior is required.
   */
async setGlobal(dotPath: string, value: any): Promise<GlobalSettings> {
    this.globalOverrides = setByPath(
      this.globalOverrides as Record<string, any>,
      dotPath,
      value
    ) as Partial<GlobalSettings>;

    await this.saveGlobal();
    return this.getResolvedGlobal();
  }

  /** Reset a single global setting to its default (removes the override). */
    /**
   * Functionality: resetGlobal performs the reset global workflow used by main/settings/settings-manager.ts.
   * Parameters: dotPath (string).
   * Returns: Returns Promise<GlobalSettings>.
   * Usage: Call resetGlobal from the owning module or component when this behavior is required.
   */
async resetGlobal(dotPath: string): Promise<GlobalSettings> {
    this.globalOverrides = deleteByPath(
      this.globalOverrides as Record<string, any>,
      dotPath
    ) as Partial<GlobalSettings>;

    await this.saveGlobal();
    return this.getResolvedGlobal();
  }

  /** Reset ALL global settings to defaults. */
    /**
   * Functionality: resetAllGlobal performs the reset all global workflow used by main/settings/settings-manager.ts.
   * Parameters: None.
   * Returns: Returns Promise<GlobalSettings>.
   * Usage: Call resetAllGlobal from the owning module or component when this behavior is required.
   */
async resetAllGlobal(): Promise<GlobalSettings> {
    this.globalOverrides = {};
    await this.saveGlobal();
    return this.getResolvedGlobal();
  }

  /** Persist the full resolved global settings to disk (defaults + overrides). */
    /**
   * Functionality: saveGlobal performs the save global workflow used by main/settings/settings-manager.ts.
   * Parameters: None.
   * Returns: Returns Promise<void>.
   * Usage: Call saveGlobal from the owning module or component when this behavior is required.
   */
async saveGlobal(): Promise<void> {
    try {
      const dir = this.getGlobalDir();
      const filePath = this.globalFilePath;
      console.log("[Settings] Saving global settings to:", filePath);
      await this.ensureDir(dir);
      const resolved = this.getResolvedGlobal();
      await this.writeFile(filePath, {
        version: LATEST_SCHEMA_VERSION,
        settings: resolved,
      });
      console.log(
        "[Settings] Saved successfully. Full settings written to disk."
      );
    } catch (err) {
      console.error("[Settings] Failed to save global settings:", err);
    }
  }

  // -------------------------------------------------------------------------
  // Project settings
  // -------------------------------------------------------------------------

  /** Full path to a project's settings JSON file. */
    /**
   * Functionality: projectFilePath performs the project file path workflow used by main/settings/settings-manager.ts.
   * Parameters: projectRoot (string).
   * Returns: Returns string.
   * Usage: Call projectFilePath from the owning module or component when this behavior is required.
   */
private projectFilePath(projectRoot: string): string {
    return path.join(this.getProjectDir(projectRoot), SETTINGS_FILENAME);
  }

  /** Load project settings from disk, run migrations, cache overrides. */
    /**
   * Functionality: loadProject performs the load project workflow used by main/settings/settings-manager.ts.
   * Parameters: projectRoot (string).
   * Returns: Returns Promise<ProjectSettings>.
   * Usage: Call loadProject from the owning module or component when this behavior is required.
   */
async loadProject(projectRoot: string): Promise<ProjectSettings> {
    try {
      const filePath = this.projectFilePath(projectRoot);
      const raw = await fs.readFile(filePath, "utf-8");
      const file: SettingsFile<Partial<ProjectSettings>> = JSON.parse(raw);

      let overrides = file.settings ?? {};

      if (file.version < LATEST_SCHEMA_VERSION) {
        overrides = migrateSettings(
          overrides as Record<string, any>,
          file.version
        ) as Partial<ProjectSettings>;
      }

      this.projectOverrides.set(projectRoot, overrides);
    } catch {
      this.projectOverrides.set(projectRoot, {});
    }

    // Always persist the full resolved settings to disk so the JSON file
    // is visible and complete from the very first launch.
    await this.saveProject(projectRoot);

    return this.getResolvedProject(projectRoot);
  }

  /** Get fully resolved project settings for a given root. */
    /**
   * Functionality: getResolvedProject performs the get resolved project workflow used by main/settings/settings-manager.ts.
   * Parameters: projectRoot (string).
   * Returns: Returns ProjectSettings.
   * Usage: Call getResolvedProject from the owning module or component when this behavior is required.
   */
getResolvedProject(projectRoot: string): ProjectSettings {
    const overrides = this.projectOverrides.get(projectRoot) ?? {};
    return deepMerge(DEFAULT_PROJECT_SETTINGS, overrides);
  }

  /** Get a single project setting by dot-path. */
    /**
   * Functionality: getProject performs the get project workflow used by main/settings/settings-manager.ts.
   * Parameters: projectRoot (string); dotPath (string).
   * Returns: Returns any.
   * Usage: Call getProject from the owning module or component when this behavior is required.
   */
getProject(projectRoot: string, dotPath: string): any {
    const resolved = this.getResolvedProject(projectRoot);
    return getByPath(resolved as unknown as Record<string, any>, dotPath);
  }

  /** Set a single project setting by dot-path. Persists to disk. */
    /**
   * Functionality: setProject performs the set project workflow used by main/settings/settings-manager.ts.
   * Parameters: projectRoot (string); dotPath (string); value (any).
   * Returns: Returns Promise<ProjectSettings>.
   * Usage: Call setProject from the owning module or component when this behavior is required.
   */
async setProject(projectRoot: string, dotPath: string, value: any): Promise<ProjectSettings> {
    const current = this.projectOverrides.get(projectRoot) ?? {};
    this.projectOverrides.set(
      projectRoot,
      setByPath(current as Record<string, any>, dotPath, value) as Partial<ProjectSettings>
    );

    await this.saveProject(projectRoot);
    return this.getResolvedProject(projectRoot);
  }

  /** Reset a single project setting to its default. */
    /**
   * Functionality: resetProject performs the reset project workflow used by main/settings/settings-manager.ts.
   * Parameters: projectRoot (string); dotPath (string).
   * Returns: Returns Promise<ProjectSettings>.
   * Usage: Call resetProject from the owning module or component when this behavior is required.
   */
async resetProject(projectRoot: string, dotPath: string): Promise<ProjectSettings> {
    const current = this.projectOverrides.get(projectRoot) ?? {};
    this.projectOverrides.set(
      projectRoot,
      deleteByPath(current as Record<string, any>, dotPath) as Partial<ProjectSettings>
    );

    await this.saveProject(projectRoot);
    return this.getResolvedProject(projectRoot);
  }

  /** Reset ALL project settings for a given root. */
    /**
   * Functionality: resetAllProject performs the reset all project workflow used by main/settings/settings-manager.ts.
   * Parameters: projectRoot (string).
   * Returns: Returns Promise<ProjectSettings>.
   * Usage: Call resetAllProject from the owning module or component when this behavior is required.
   */
async resetAllProject(projectRoot: string): Promise<ProjectSettings> {
    this.projectOverrides.set(projectRoot, {});
    await this.saveProject(projectRoot);
    return this.getResolvedProject(projectRoot);
  }

  /** Persist the full resolved project settings to disk (defaults + overrides). */
    /**
   * Functionality: saveProject performs the save project workflow used by main/settings/settings-manager.ts.
   * Parameters: projectRoot (string).
   * Returns: Returns Promise<void>.
   * Usage: Call saveProject from the owning module or component when this behavior is required.
   */
async saveProject(projectRoot: string): Promise<void> {
    const dir = this.getProjectDir(projectRoot);
    await this.ensureDir(dir);
    const resolved = this.getResolvedProject(projectRoot);
    await this.writeFile(this.projectFilePath(projectRoot), {
      version: LATEST_SCHEMA_VERSION,
      settings: resolved,
    });
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /** Get the default values (useful for the renderer to know what defaults are). */
    /**
   * Functionality: getDefaults performs the get defaults workflow used by main/settings/settings-manager.ts.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call getDefaults from the owning module or component when this behavior is required.
   */
getDefaults() {
    return {
      global: DEFAULT_GLOBAL_SETTINGS,
      project: DEFAULT_PROJECT_SETTINGS,
    };
  }

    /**
   * Functionality: ensureDir performs the ensure dir workflow used by main/settings/settings-manager.ts.
   * Parameters: dir (string).
   * Returns: Returns Promise<void>.
   * Usage: Call ensureDir from the owning module or component when this behavior is required.
   */
private async ensureDir(dir: string): Promise<void> {
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

    /**
   * Functionality: writeFile performs the write file workflow used by main/settings/settings-manager.ts.
   * Parameters: filePath (string); data (object).
   * Returns: Returns Promise<void>.
   * Usage: Call writeFile from the owning module or component when this behavior is required.
   */
private async writeFile(filePath: string, data: object): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
