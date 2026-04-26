/**
 * Name of code artifact: renderer/components/hooks/keyboardshortcuts.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import { useEffect } from 'react';

interface KeyboardShortcutsConfig {
  onSave?: () => void;
  onTogglePreview?: () => void;
  onToggleLivePreview?: () => void;
  onToggleSidebar?: () => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onSearch?: () => void;
  onOpenFolder?: () => void;
  enabled?: boolean;
}

/**
 * Custom hook to handle keyboard shortcuts
 * Usage: useKeyboardShortcuts({ onSave: handleSave, onTogglePreview: () => setPreviewMode(prev => !prev) })
 */
/**
 * Functionality: useKeyboardShortcuts performs the use keyboard shortcuts workflow used by renderer/components/hooks/keyboardshortcuts.tsx.
 * Parameters: { onSave, onTogglePreview, onToggleLivePreview, onToggleSidebar, onNewFile, onNewFolder, onSearch, onOpenFolder, enabled = true, } (KeyboardShortcutsConfig).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call useKeyboardShortcuts from the owning module or component when this behavior is required.
 */
export const useKeyboardShortcuts = ({
  onSave,
  onTogglePreview,
  onToggleLivePreview,
  onToggleSidebar,
  onNewFile,
  onNewFolder,
  onSearch,
  onOpenFolder,
  enabled = true,
}: KeyboardShortcutsConfig) => {
  useEffect(() => {
    if (!enabled) return;

        /**
     * Functionality: handleKeyDown performs the handle key down workflow used by renderer/components/hooks/keyboardshortcuts.tsx.
     * Parameters: e (KeyboardEvent).
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call handleKeyDown from the owning module or component when this behavior is required.
     */
const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + S: Save
      if (modKey && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl/Cmd + P: Toggle Preview
      if (modKey && e.key === 'p') {
        e.preventDefault();
        onTogglePreview?.();
        return;
      }

      // Ctrl/Cmd + Shift + P: Toggle Live Preview
      if (modKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        onToggleLivePreview?.();
        return;
      }

       // Ctrl/Cmd + O: Open Folder
      if (modKey && e.key === 'o') {
        e.preventDefault();
        onOpenFolder?.();
        return;
      }

      // Ctrl/Cmd + B: Toggle Sidebar
      if (modKey && e.key === 'b') {
        e.preventDefault();
        onToggleSidebar?.();
        return;
      }

      // Ctrl/Cmd + N: New File
      if (modKey && e.key === 'n') {
        e.preventDefault();
        onNewFile?.();
        return;
      }

      // Ctrl/Cmd + Shift + N: New Folder
      if (modKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        onNewFolder?.();
        return;
      }

      // Ctrl/Cmd + F: Focus Search
      if (modKey && e.key === 'f') {
        e.preventDefault();
        onSearch?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onTogglePreview, onToggleLivePreview, onToggleSidebar, onNewFile, onNewFolder, onSearch, onOpenFolder, enabled]);
};