import fs from 'fs';
import path from 'path';
import { app } from 'electron';


//Path to local autosave file.

const autosavePath = path.join(app.getPath('userData'), 'autosave.json');


//Save the note content to a local file.

export function saveNoteLocally(content: string) {
  try {
    const payload = {
      content,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(autosavePath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log('[Autosave] Note saved to', autosavePath);
  } catch (error) {
    console.error('[Autosave] Error saving note:', error);
  }
}


//Load the most recently autosaved note.
 
export function loadSavedNote(): string | null {
  try {
    if (fs.existsSync(autosavePath)) {
      const raw = fs.readFileSync(autosavePath, 'utf-8');
      const data = JSON.parse(raw);
      return data.content || '';
    }
    return null;
  } catch (error) {
    console.error('[Autosave] Error loading note:', error);
    return null;
  }
}