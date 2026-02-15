/**
 * SettingsManager
 *
 * Central class that handles loading, saving, getting, setting, and resetting
 * settings for both global and project scopes. It deep-merges user overrides
 * on top of defaults so the JSON file on disk only stores explicit changes
 * (sparse storage pattern).
 *
 * Path resolution is delegated to utility functions provided by teammates
 * (Tickets 1 & 2). During development, stub fallbacks are used.
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
function getByPath(obj: Record<string, any>, dotPath: string): any {
  return dotPath.split(".").reduce((acc, part) => acc?.[part], obj);
}

/**
 * Set a nested property via a dot-path string (immutable, returns new object).
 * e.g. setByPath(obj, "appearance.theme", "dark")
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
function globalPath(): string {
  return resolveConfigDirectoryPath();
}

/** Project settings dir -- stub until Atharva's Ticket 2 is merged. */
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

export class SettingsManager {
  private getGlobalDir: GlobalPathResolver;
  private getProjectDir: ProjectPathResolver;

  /** In-memory cache of the user's global overrides (sparse — NOT merged with defaults). */
  private globalOverrides: Partial<GlobalSettings> = {};

  /** In-memory cache of project overrides, keyed by project root. */
  private projectOverrides: Map<string, Partial<ProjectSettings>> = new Map();

  constructor(options: SettingsManagerOptions = {}) {
    this.getGlobalDir = options.getGlobalDir ?? globalPath;
    this.getProjectDir = options.getProjectDir ?? projectPath;
  }

  // -------------------------------------------------------------------------
  // Global settings
  // -------------------------------------------------------------------------

  /** Full path to the global settings JSON file. */
  private get globalFilePath(): string {
    return path.join(this.getGlobalDir(), SETTINGS_FILENAME);
  }

  /** Load global settings from disk, run migrations, cache overrides. */
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
        // Persist the migrated version
        await this.writeFile(filePath, {
          version: LATEST_SCHEMA_VERSION,
          settings: overrides,
        });
      }

      this.globalOverrides = overrides;
      console.log("[Settings] Loaded overrides:", JSON.stringify(overrides));
    } catch (err) {
      // File doesn't exist or is corrupt — start fresh
      console.log("[Settings] No existing settings file, starting fresh:", (err as Error).message);
      this.globalOverrides = {};
    }

    return this.getResolvedGlobal();
  }

  /** Get the fully resolved global settings (defaults + overrides). */
  getResolvedGlobal(): GlobalSettings {
    return deepMerge(DEFAULT_GLOBAL_SETTINGS, this.globalOverrides);
  }

  /** Get a single global setting by dot-path (e.g. "appearance.theme"). */
  getGlobal(dotPath: string): any {
    const resolved = this.getResolvedGlobal();
    return getByPath(resolved as unknown as Record<string, any>, dotPath);
  }

  /** Set a single global setting by dot-path. Persists to disk. */
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
  async resetGlobal(dotPath: string): Promise<GlobalSettings> {
    this.globalOverrides = deleteByPath(
      this.globalOverrides as Record<string, any>,
      dotPath
    ) as Partial<GlobalSettings>;

    await this.saveGlobal();
    return this.getResolvedGlobal();
  }

  /** Reset ALL global settings to defaults. */
  async resetAllGlobal(): Promise<GlobalSettings> {
    this.globalOverrides = {};
    await this.saveGlobal();
    return this.getResolvedGlobal();
  }

  /** Persist the current global overrides to disk. */
  async saveGlobal(): Promise<void> {
    try {
      const dir = this.getGlobalDir();
      const filePath = this.globalFilePath;
      console.log("[Settings] Saving global settings to:", filePath);
      await this.ensureDir(dir);
      await this.writeFile(filePath, {
        version: LATEST_SCHEMA_VERSION,
        settings: this.globalOverrides,
      });
      console.log(
        "[Settings] Saved successfully. Overrides:",
        JSON.stringify(this.globalOverrides)
      );
    } catch (err) {
      console.error("[Settings] Failed to save global settings:", err);
    }
  }

  // -------------------------------------------------------------------------
  // Project settings
  // -------------------------------------------------------------------------

  /** Full path to a project's settings JSON file. */
  private projectFilePath(projectRoot: string): string {
    return path.join(this.getProjectDir(projectRoot), SETTINGS_FILENAME);
  }

  /** Load project settings from disk, run migrations, cache overrides. */
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
        await this.writeFile(filePath, {
          version: LATEST_SCHEMA_VERSION,
          settings: overrides,
        });
      }

      this.projectOverrides.set(projectRoot, overrides);
    } catch {
      this.projectOverrides.set(projectRoot, {});
    }

    return this.getResolvedProject(projectRoot);
  }

  /** Get fully resolved project settings for a given root. */
  getResolvedProject(projectRoot: string): ProjectSettings {
    const overrides = this.projectOverrides.get(projectRoot) ?? {};
    return deepMerge(DEFAULT_PROJECT_SETTINGS, overrides);
  }

  /** Get a single project setting by dot-path. */
  getProject(projectRoot: string, dotPath: string): any {
    const resolved = this.getResolvedProject(projectRoot);
    return getByPath(resolved as unknown as Record<string, any>, dotPath);
  }

  /** Set a single project setting by dot-path. Persists to disk. */
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
  async resetAllProject(projectRoot: string): Promise<ProjectSettings> {
    this.projectOverrides.set(projectRoot, {});
    await this.saveProject(projectRoot);
    return this.getResolvedProject(projectRoot);
  }

  /** Persist project overrides to disk. */
  async saveProject(projectRoot: string): Promise<void> {
    const dir = this.getProjectDir(projectRoot);
    await this.ensureDir(dir);
    const overrides = this.projectOverrides.get(projectRoot) ?? {};
    await this.writeFile(this.projectFilePath(projectRoot), {
      version: LATEST_SCHEMA_VERSION,
      settings: overrides,
    });
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /** Get the default values (useful for the renderer to know what defaults are). */
  getDefaults() {
    return {
      global: DEFAULT_GLOBAL_SETTINGS,
      project: DEFAULT_PROJECT_SETTINGS,
    };
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async writeFile(filePath: string, data: object): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
