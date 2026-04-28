/**
 * Name of code artifact: main/helpers/create-window.ts
 * Brief description: Provides main-process helper utilities shared across Electron startup and file operations.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Abdulaziz-Ali123
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { screen, BrowserWindow, BrowserWindowConstructorOptions, Rectangle } from "electron";
import ElectronStore from "electron-store";

/**
 * Functionality: createWindow performs the create window workflow used by main/helpers/create-window.ts.
 * Parameters: windowName (string); options (BrowserWindowConstructorOptions).
 * Returns: Returns BrowserWindow.
 * Usage: Call createWindow from the owning module or component when this behavior is required.
 */
export const createWindow = (
  windowName: string,
  options: BrowserWindowConstructorOptions
): BrowserWindow => {
  const key = "window-state";
  const name = `window-state-${windowName}`;
  const store = new ElectronStore<{ [key: string]: Rectangle }>({ name }) as any;
  const defaultSize = {
    width: options.width,
    height: options.height,
  };
  let state = {};

    /**
   * Functionality: restore performs the restore workflow used by main/helpers/create-window.ts.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call restore from the owning module or component when this behavior is required.
   */
const restore = () => store.get(key, defaultSize);

    /**
   * Functionality: getCurrentPosition performs the get current position workflow used by main/helpers/create-window.ts.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call getCurrentPosition from the owning module or component when this behavior is required.
   */
const getCurrentPosition = () => {
    const position = win.getPosition();
    const size = win.getSize();
    return {
      x: position[0],
      y: position[1],
      width: size[0],
      height: size[1],
    };
  };

    /**
   * Functionality: windowWithinBounds performs the window within bounds workflow used by main/helpers/create-window.ts.
   * Parameters: windowState (inferred); bounds (inferred).
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call windowWithinBounds from the owning module or component when this behavior is required.
   */
const windowWithinBounds = (windowState, bounds) => {
    return (
      windowState.x >= bounds.x &&
      windowState.y >= bounds.y &&
      windowState.x + windowState.width <= bounds.x + bounds.width &&
      windowState.y + windowState.height <= bounds.y + bounds.height
    );
  };

    /**
   * Functionality: resetToDefaults performs the reset to defaults workflow used by main/helpers/create-window.ts.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call resetToDefaults from the owning module or component when this behavior is required.
   */
const resetToDefaults = () => {
    const bounds = screen.getPrimaryDisplay().bounds;
    return Object.assign({}, defaultSize, {
      x: (bounds.width - defaultSize.width) / 2,
      y: (bounds.height - defaultSize.height) / 2,
    });
  };

    /**
   * Functionality: ensureVisibleOnSomeDisplay performs the ensure visible on some display workflow used by main/helpers/create-window.ts.
   * Parameters: windowState (inferred).
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call ensureVisibleOnSomeDisplay from the owning module or component when this behavior is required.
   */
const ensureVisibleOnSomeDisplay = (windowState) => {
    const visible = screen.getAllDisplays().some((display) => {
      return windowWithinBounds(windowState, display.bounds);
    });
    if (!visible) {
      // Window is partially or fully not visible now.
      // Reset it to safe defaults.
      return resetToDefaults();
    }
    return windowState;
  };

    /**
   * Functionality: saveState performs the save state workflow used by main/helpers/create-window.ts.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call saveState from the owning module or component when this behavior is required.
   */
const saveState = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      Object.assign(state, getCurrentPosition());
    }
    store.set(key, state);
  };

  state = ensureVisibleOnSomeDisplay(restore());

  const win = new BrowserWindow({
    ...state,
    ...options,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      ...options.webPreferences,
    },
  });

  win.setMinimumSize(600, 600);
  win.on("close", saveState);

  return win;
};
