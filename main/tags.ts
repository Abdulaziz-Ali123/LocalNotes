/**
 * Name of code artifact: main/tags.ts
 * Brief description: Provides source code for the LocalNotes Electron and Next.js application.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: m518n748
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import fs from "fs";
import path from "path";

/**
 * Functionality: getTagFilePath performs the get tag file path workflow used by main/tags.ts.
 * Parameters: projectRoot (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call getTagFilePath from the owning module or component when this behavior is required.
 */
export function getTagFilePath(projectRoot: string) {
  return path.join(projectRoot, ".notepad-tags.json");
}

/**
 * Functionality: loadTags performs the load tags workflow used by main/tags.ts.
 * Parameters: projectRoot (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call loadTags from the owning module or component when this behavior is required.
 */
export function loadTags(projectRoot: string) {
  const tagFile = getTagFilePath(projectRoot);

  if (!fs.existsSync(tagFile)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(tagFile, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Functionality: saveTags performs the save tags workflow used by main/tags.ts.
 * Parameters: projectRoot (string); data (any).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call saveTags from the owning module or component when this behavior is required.
 */
export function saveTags(projectRoot: string, data: any) {
  const tagFile = getTagFilePath(projectRoot);
  fs.writeFileSync(tagFile, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Functionality: updateTags performs the update tags workflow used by main/tags.ts.
 * Parameters: projectRoot (string); itemPath (string); tags (any[]).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call updateTags from the owning module or component when this behavior is required.
 */
export function updateTags(projectRoot: string, itemPath: string, tags: any[]) {
  const allTags = loadTags(projectRoot);
  allTags[itemPath] = { tags };
  saveTags(projectRoot, allTags);
}

/**
 * Functionality: removeTags performs the remove tags workflow used by main/tags.ts.
 * Parameters: projectRoot (string); itemPath (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call removeTags from the owning module or component when this behavior is required.
 */
export function removeTags(projectRoot: string, itemPath: string) {
  const allTags = loadTags(projectRoot);
  delete allTags[itemPath];
  saveTags(projectRoot, allTags);
}
