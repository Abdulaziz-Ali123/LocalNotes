/**
 * Name of code artifact: main/helpers/autosave.ts
 * Brief description: Provides main-process helper utilities shared across Electron startup and file operations.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; m518n748
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import fs from "fs";
import path from "path";
import { app } from "electron";

//Path to local autosave file.

const autosavePath = path.join(app.getPath("userData"), "autosave.json");

//Save the note content to a local file.

/**
 * Functionality: saveNoteLocally performs the save note locally workflow used by main/helpers/autosave.ts.
 * Parameters: content (string).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call saveNoteLocally from the owning module or component when this behavior is required.
 */
export function saveNoteLocally(content: string) {
  try {
    const payload = {
      content,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(autosavePath, JSON.stringify(payload, null, 2), "utf-8");
    console.log("[Autosave] Note saved to", autosavePath);
  } catch (error) {
    console.error("[Autosave] Error saving note:", error);
  }
}

//Load the most recently autosaved note.

/**
 * Functionality: loadSavedNote performs the load saved note workflow used by main/helpers/autosave.ts.
 * Parameters: None.
 * Returns: Returns string | null.
 * Usage: Call loadSavedNote from the owning module or component when this behavior is required.
 */
export function loadSavedNote(): string | null {
  try {
    if (fs.existsSync(autosavePath)) {
      const raw = fs.readFileSync(autosavePath, "utf-8");
      const data = JSON.parse(raw);
      return data.content || "";
    }
    return null;
  } catch (error) {
    console.error("[Autosave] Error loading note:", error);
    return null;
  }
}
