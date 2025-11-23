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