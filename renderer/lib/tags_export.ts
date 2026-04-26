/**
 * Name of code artifact: renderer/lib/tags_export.ts
 * Brief description: Provides renderer utility logic shared by LocalNotes components.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: m518n748
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

/**
 * Functionality: loadTagMap performs the load tag map workflow used by renderer/lib/tags_export.ts.
 * Parameters: projectRoot (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call loadTagMap from the owning module or component when this behavior is required.
 */
export async function loadTagMap(projectRoot: string) {
  return await (window as any).electron.invoke("tags:load", projectRoot);
}

/**
 * Functionality: updateTag performs the update tag workflow used by renderer/lib/tags_export.ts.
 * Parameters: itemPath (string); projectRoot (string); tags (any[]).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call updateTag from the owning module or component when this behavior is required.
 */
export async function updateTag(itemPath: string, projectRoot: string, tags: any[]) {
  return await (window as any).electron.invoke("tags:update", projectRoot, itemPath, tags);
}

/**
 * Functionality: removeTag performs the remove tag workflow used by renderer/lib/tags_export.ts.
 * Parameters: itemPath (string); projectRoot (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call removeTag from the owning module or component when this behavior is required.
 */
export async function removeTag(itemPath: string, projectRoot: string) {
  return await (window as any).electron.invoke("tags:remove", projectRoot, itemPath);
}