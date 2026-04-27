/**
 * Settings migration pipeline.
 *
 * Each entry in `migrations` is keyed by the TARGET version and receives the
 * raw settings object (the `settings` field from the on-disk JSON, NOT the
 * wrapper). It must return the transformed settings for that version.
 *
 * Migrations run sequentially: if the file is at version 1 and LATEST is 3,
 * we run migration[2] then migration[3].
 *
 * When adding a new migration:
 *   1. Bump LATEST_SCHEMA_VERSION in defaults.ts
 *   2. Add a new entry here with the target version as key
 *   3. Update the TypeScript interfaces in schema.ts if the shape changed
 */

import { DEFAULT_TRASH, LATEST_SCHEMA_VERSION } from "./defaults";

type MigrationFn = (settings: Record<string, any>) => Record<string, any>;

/**
 * Registry of migration functions.
 * Key = the version the settings will be AFTER this migration runs.
 *
 * Example (currently empty for v1 — nothing to migrate yet):
 *
 *   const migrations: Record<number, MigrationFn> = {
 *     2: (settings) => {
 *       // v1 -> v2: Added spellcheck
 *       settings.editor = settings.editor ?? {};
 *       settings.editor.spellcheck = true;
 *       return settings;
 *     },
 *   };
 */
const migrations: Record<number, MigrationFn> = {
  6: (settings) => {
    const next = { ...settings };
    next.trash = {
      autoPurgeDays:
        typeof settings?.trash?.autoPurgeDays === "number"
          ? settings.trash.autoPurgeDays
          : DEFAULT_TRASH.autoPurgeDays,
    };
    return next;
  },
  // No migrations needed yet — we're starting at version 1.
  // Future example:
  // 2: (settings) => {
  //   settings.editor.spellcheck = settings.editor?.spellcheck ?? false;
  //   return settings;
  // },
};

/**
 * Run all necessary migrations on a settings object.
 *
 * @param settings  The raw settings object (without the version wrapper)
 * @param fromVersion  The version the settings are currently at
 * @returns The migrated settings object, now at LATEST_SCHEMA_VERSION
 */
export function migrateSettings(
  settings: Record<string, any>,
  fromVersion: number
): Record<string, any> {
  let current = structuredClone(settings);

  for (let v = fromVersion + 1; v <= LATEST_SCHEMA_VERSION; v++) {
    const migrationFn = migrations[v];
    if (migrationFn) {
      current = migrationFn(current);
    }
    // If no migration function exists for a version step, it means the
    // schema change was purely additive and defaults handle it.
  }

  return current;
}
