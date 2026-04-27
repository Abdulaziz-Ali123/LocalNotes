/**
 * SettingsDialog
 *
 * Full-screen modal dialog for managing global settings.
 * Contains three tabs: Appearance, Editor, and Keybindings.
 *
 * Revision History:
 *  • Wesley McDougal - 29 MAR 2026 - Updated Appearance tab to include custom themes in dropdown
 *  • Wesley McDougal - 05APR2026 - Added Sidebar tab controls for layout scope, panel position, and layout reset
 *  • Wesley McDougal - 07APR2026 - AI tab overhaul: clickable model rows with green active state,
 *    inline Yes/No delete confirmation (replaces window.confirm to prevent Electron focus loss),
 *    handleEnableModel writing to ai.defaultModelId, and red warning text when the active model
 *    is deleted (model selection; UX polish).
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { useTheme, type ThemeType } from "@/renderer/lib/theme";
import { X, Eye, EyeOff } from "lucide-react";
import { RiAddLine, RiDeleteBinLine } from "react-icons/ri";
import { Button } from "@/renderer/components/ui/button";
import { Checkbox } from "@/renderer/components/ui/checkbox";
import { Label } from "@/renderer/components/ui/label";
import AddModelsModal from "@/renderer/components/AddModelsModal";
import {
  type ModelCapabilities,
  type SidebarLayoutScope,
  type SidebarLayoutSettings,
  type SidebarPosition,
} from "@/renderer/store/settings-slice";

const MAX_AUTO_PURGE_DAYS = 3650;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which tab to show when the dialog opens (defaults to "appearance"). */
  defaultTab?: "appearance" | "editor" | "keybindings" | "ai" | "sidebar" | "help";
  /** Called when the user clicks the Replay Tutorial button in the Help tab. */
  onStartTutorial: () => void;
  sidebarLayout: SidebarLayoutSettings;
  layoutScope: SidebarLayoutScope;
  isProjectScopeAvailable: boolean;
  onSidebarPositionChange: (position: SidebarPosition) => void;
  onSidebarScopeChange: (scope: SidebarLayoutScope) => void;
  onResetSidebarLayout: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsDialog({
  isOpen,
  onClose,
  defaultTab = "appearance",
  sidebarLayout,
  layoutScope,
  isProjectScopeAvailable,
  onSidebarPositionChange,
  onSidebarScopeChange,
  onResetSidebarLayout,
  onStartTutorial,
}: SettingsDialogProps) {
  // Hooks must run before any early return (Rules of Hooks)
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      // Node.contains() is a pure DOM check — reliable regardless of what
      // Radix UI or any other library does with synthetic events internally.
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use mousedown (not click) so we intercept before Radix processes the event.
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="bg-background border border-border rounded-lg shadow-lg w-[680px] h-[500px] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs.Root defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <Tabs.List className="flex border-b border-border px-6 gap-1 flex-shrink-0">
            <TabTrigger value="appearance">Appearance</TabTrigger>
            <TabTrigger value="sidebar">Sidebar</TabTrigger>
            <TabTrigger value="editor">Editor</TabTrigger>
            <TabTrigger value="keybindings">Keybindings</TabTrigger>
            <TabTrigger value="ai">AI</TabTrigger>
            <TabTrigger value="help">Help</TabTrigger>
          </Tabs.List>

          <div className="flex-1 min-h-0 overflow-y-auto p-6">
            <Tabs.Content value="appearance" className="outline-none">
              <AppearanceTab />
            </Tabs.Content>
            <Tabs.Content value="sidebar" className="outline-none">
              <SidebarTab
                sidebarLayout={sidebarLayout}
                layoutScope={layoutScope}
                isProjectScopeAvailable={isProjectScopeAvailable}
                onSidebarPositionChange={onSidebarPositionChange}
                onSidebarScopeChange={onSidebarScopeChange}
                onResetSidebarLayout={onResetSidebarLayout}
              />
            </Tabs.Content>
            <Tabs.Content value="editor" className="outline-none">
              <EditorTab />
            </Tabs.Content>
            <Tabs.Content value="keybindings" className="outline-none">
              <KeybindingsTab />
            </Tabs.Content>
            <Tabs.Content value="ai" className="outline-none">
              <AiTab />
            </Tabs.Content>
            <Tabs.Content value="help" className="outline-none">
              <HelpTab onStartTutorial={onStartTutorial} />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>
    </div>
  );
}

function SidebarTab({
  sidebarLayout,
  layoutScope,
  isProjectScopeAvailable,
  onSidebarPositionChange,
  onSidebarScopeChange,
  onResetSidebarLayout,
}: {
  sidebarLayout: SidebarLayoutSettings;
  layoutScope: SidebarLayoutScope;
  isProjectScopeAvailable: boolean;
  onSidebarPositionChange: (position: SidebarPosition) => void;
  onSidebarScopeChange: (scope: SidebarLayoutScope) => void;
  onResetSidebarLayout: () => void;
}) {


  return (
    <div className="space-y-6">
      <SettingRow
        label="Persistence Scope"
        description="Choose whether sidebar layout is shared globally or saved per notes directory"
      >
        <select
          value={layoutScope}
          onChange={(e) => onSidebarScopeChange(e.target.value as SidebarLayoutScope)}
          className="w-56 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        >
          <option value="global">Global (all folders)</option>
          <option value="project" disabled={!isProjectScopeAvailable}>
            Per Notes Directory
          </option>
        </select>
      </SettingRow>

      {!isProjectScopeAvailable && (
        <p className="text-xs text-muted-foreground">
          Open a notes directory to enable per-directory sidebar persistence.
        </p>
      )}

      <SettingRow
        label="Content Panel Side"
        description="Choose where the expandable sidebar content panel opens"
      >
        <div className="grid grid-cols-2 gap-2 w-56">
          <Button
            variant={sidebarLayout.panelPosition === "left" ? "default" : "outline"}
            size="sm"
            onClick={() => onSidebarPositionChange("left")}
          >
            Left
          </Button>
          <Button
            variant={sidebarLayout.panelPosition === "right" ? "default" : "outline"}
            size="sm"
            onClick={() => onSidebarPositionChange("right")}
          >
            Right
          </Button>
        </div>
      </SettingRow>

      <SettingRow
        label="Icon Order"
        description="Drag icons between left/right/top/bottom rails to reorder and move them. Right-click any rail to set alignment."
      >
        <div className="text-xs text-muted-foreground text-right max-w-56 space-y-1">
          <div>Changes save automatically.</div>
          <div>
            Left: {sidebarLayout.rails.left.length} | Right: {sidebarLayout.rails.right.length}
          </div>
          <div>
            Bottom: {sidebarLayout.rails.bottom.length}
          </div>
        </div>
      </SettingRow>

      <div className="flex justify-end pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onResetSidebarLayout}>
          Reset Sidebar Layout
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab trigger helper
// ---------------------------------------------------------------------------

function TabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-foreground -mb-px transition-colors"
    >
      {children}
    </Tabs.Trigger>
  );
}

// ---------------------------------------------------------------------------
// Appearance tab
// ---------------------------------------------------------------------------

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const globalSettings = useBoundStore((s) => s.settings.global);
  const setGlobal = useBoundStore((s) => s.settings.setGlobal);
  const customThemes = globalSettings.appearance.customThemes ?? {};
  const customThemeList = Object.values(customThemes).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  const fontSize = globalSettings.appearance.fontSize;
  const fontFamily = globalSettings.appearance.fontFamily;

  return (
    <div className="space-y-6">
      {/* Theme */}
      <SettingRow label="Theme" description="Choose the color theme for the app">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="w-48 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        >
          <optgroup label="Built-in">
            <option value="nord">Nord (Default)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="cozy">Cozy</option>
            <option value="darker">Darker</option>
          </optgroup>
          {customThemeList.length > 0 && (
            <optgroup label="Custom">
              {customThemeList.map((custom) => (
                <option key={custom.id} value={custom.id}>
                  {custom.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </SettingRow>

      {/* Font Size */}
      <SettingRow label="Font Size" description="Editor font size in pixels">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={8}
            max={32}
            value={fontSize}
            onChange={(e) =>
              setGlobal("appearance.fontSize", Number(e.target.value))
            }
            className="w-20 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <span className="text-sm text-muted-foreground">px</span>
        </div>
      </SettingRow>

      {/* Font Family */}
      <SettingRow label="Font Family" description="Editor font family">
        <input
          type="text"
          value={fontFamily}
          onChange={(e) =>
            setGlobal("appearance.fontFamily", e.target.value)
          }
          className="w-48 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
      </SettingRow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor tab
// ---------------------------------------------------------------------------

function EditorTab() {
  const globalSettings = useBoundStore((s) => s.settings.global);
  const setGlobal = useBoundStore((s) => s.settings.setGlobal);

  const { autosaveEnabled, autosaveIntervalMs, wordWrap, showLineNumbers } =
    globalSettings.editor;
  const autoPurgeDays = Number(globalSettings.trash?.autoPurgeDays ?? 30);

  return (
    <div className="space-y-6">
      {/* Autosave */}
      <SettingRow label="Autosave" description="Automatically save files periodically">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={autosaveEnabled}
            onCheckedChange={(checked) =>
              setGlobal("editor.autosaveEnabled", !!checked)
            }
          />
          <Label className="text-sm">Enabled</Label>
        </div>
      </SettingRow>

      {/* Autosave Interval */}
      <SettingRow
        label="Autosave Interval"
        description="How often to autosave (in seconds)"
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={300}
            value={Math.round(autosaveIntervalMs / 1000)}
            onChange={(e) =>
              setGlobal(
                "editor.autosaveIntervalMs",
                Number(e.target.value) * 1000
              )
            }
            disabled={!autosaveEnabled}
            className="w-20 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm disabled:opacity-50"
          />
          <span className="text-sm text-muted-foreground">seconds</span>
        </div>
      </SettingRow>

      {/* Word Wrap */}
      <SettingRow label="Word Wrap" description="Wrap long lines in the editor">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={wordWrap}
            onCheckedChange={(checked) =>
              setGlobal("editor.wordWrap", !!checked)
            }
          />
          <Label className="text-sm">Enabled</Label>
        </div>
      </SettingRow>

      {/* Line Numbers */}
      <SettingRow
        label="Line Numbers"
        description="Show line numbers in the editor"
      >
        <div className="flex items-center gap-3">
          <Checkbox
            checked={showLineNumbers}
            onCheckedChange={(checked) =>
              setGlobal("editor.showLineNumbers", !!checked)
            }
          />
          <Label className="text-sm">Show</Label>
        </div>
      </SettingRow>

      <SettingRow
        label="Trash Auto-Purge"
        description="Automatically permanently delete trashed items older than this many days (0 disables auto-purge)"
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={MAX_AUTO_PURGE_DAYS}
            value={autoPurgeDays}
            onChange={(e) =>
              setGlobal(
                "trash.autoPurgeDays",
                Math.max(0, Math.min(MAX_AUTO_PURGE_DAYS, Number(e.target.value) || 0))
              )
            }
            className="w-24 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <span className="text-sm text-muted-foreground">days</span>
        </div>
      </SettingRow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keybindings tab
// ---------------------------------------------------------------------------

function KeybindingsTab() {
  const keybindingActions = useBoundStore((s) => s.settings.keybindingActions);
  const keybindings = useBoundStore((s) => s.settings.global.keybindings);
  const setGlobal = useBoundStore((s) => s.settings.setGlobal);
  const resetGlobal = useBoundStore((s) => s.settings.resetGlobal);
  const resetAllGlobal = useBoundStore((s) => s.settings.resetAllGlobal);

  /** Which action ID is currently being rebound (user is pressing keys). */
  const [rebindingId, setRebindingId] = useState<string | null>(null);

  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().includes("MAC");

  // ----- Conflict detection ------------------------------------------------

  /** Build a map of accelerator → action IDs for quick conflict lookup. */
  const accelToActions = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const action of keybindingActions) {
      const accel = (keybindings[action.id] ?? action.defaultAccelerator).toLowerCase();
      if (!accel) continue;
      if (!map[accel]) map[accel] = [];
      map[accel].push(action.id);
    }
    return map;
  }, [keybindingActions, keybindings]);

  /** Return the label of the OTHER action that conflicts, or null. */
  const getConflict = (actionId: string): string | null => {
    const accel = (keybindings[actionId] ?? keybindingActions.find((a) => a.id === actionId)?.defaultAccelerator ?? "").toLowerCase();
    if (!accel) return null;
    const siblings = accelToActions[accel];
    if (!siblings || siblings.length <= 1) return null;
    const other = siblings.find((id) => id !== actionId);
    if (!other) return null;
    return keybindingActions.find((a) => a.id === other)?.label ?? other;
  };

  // ----- Key capture -------------------------------------------------------

  /**
   * Convert a keyboard event into an Electron accelerator string.
   */
  const eventToAccelerator = useCallback(
    (e: KeyboardEvent): string | null => {
      // Ignore bare modifier presses
      if (
        ["Control", "Shift", "Alt", "Meta"].includes(e.key)
      )
        return null;

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");

      // Normalise key names to Electron format
      let key = e.key;
      if (key === " ") key = "Space";
      else if (key.length === 1) key = key.toUpperCase();
      else if (key === "ArrowUp") key = "Up";
      else if (key === "ArrowDown") key = "Down";
      else if (key === "ArrowLeft") key = "Left";
      else if (key === "ArrowRight") key = "Right";
      else if (key === "Escape") {
        // Escape cancels the rebind
        setRebindingId(null);
        return null;
      }

      parts.push(key);
      return parts.join("+");
    },
    []
  );

  // Capture keydown while rebinding
  useEffect(() => {
    if (!rebindingId) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const accel = eventToAccelerator(e);
      if (accel) {
        setGlobal(`keybindings.${rebindingId}`, accel);
        setRebindingId(null);
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [rebindingId, eventToAccelerator, setGlobal]);

  /** Format accelerator for display. */
  const displayAccelerator = (accel: unknown): string => {
    if (!accel || typeof accel !== "string") return "—";
    return accel
      .replace(/CommandOrControl/g, isMac ? "Cmd" : "Ctrl")
      .replace(/Command/g, "Cmd")
      .replace(/Control/g, "Ctrl");
  };

  // Check if any keybinding differs from its default
  const hasCustomBindings = keybindingActions.some(
    (a) => keybindings[a.id] && keybindings[a.id] !== a.defaultAccelerator
  );

  // Group actions by category
  const categories = ["File", "Edit", "View"] as const;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Click on a shortcut to rebind it. Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Escape</kbd> to cancel.
      </p>

      {categories.map((cat) => {
        const actions = keybindingActions.filter((a) => a.category === cat);
        if (actions.length === 0) return null;

        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              {cat}
            </h3>
            <div className="border border-border rounded-md overflow-hidden">
              {actions.map((action, idx) => {
                const currentAccel =
                  keybindings[action.id] ?? action.defaultAccelerator;
                const isRebinding = rebindingId === action.id;
                const conflict = getConflict(action.id);

                return (
                  <div
                    key={action.id}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm ${idx > 0 ? "border-t border-border" : ""
                      } ${conflict ? "bg-destructive/5" : ""}`}
                  >
                    <div className="flex flex-col">
                      <span>{action.label}</span>
                      {conflict && (
                        <span className="text-xs text-destructive mt-0.5">
                          ⚠ Conflicts with &ldquo;{conflict}&rdquo;
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setRebindingId(isRebinding ? null : action.id)
                        }
                        className={`px-3 py-1 rounded-md text-xs font-mono min-w-[120px] text-center transition-colors ${isRebinding
                          ? "bg-accent text-accent-foreground ring-2 ring-ring animate-pulse"
                          : conflict
                            ? "bg-destructive/10 hover:bg-accent"
                            : "bg-muted hover:bg-accent"
                          }`}
                      >
                        {isRebinding
                          ? "Press keys..."
                          : displayAccelerator(currentAccel)}
                      </button>
                      {keybindings[action.id] &&
                        keybindings[action.id] !== action.defaultAccelerator && (
                          <button
                            onClick={() =>
                              resetGlobal(`keybindings.${action.id}`)
                            }
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            title="Reset to default"
                          >
                            Reset
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Restore All Defaults */}
      <div className="flex justify-end pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasCustomBindings}
          onClick={() => resetAllGlobal()}
          className="text-xs"
        >
          Restore All Defaults
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI tab
// ---------------------------------------------------------------------------

function AiTab() {
  const aiSettings = useBoundStore((s) => s.settings.global.ai);
  const setGlobal = useBoundStore((s) => s.settings.setGlobal);
  const [showKey, setShowKey] = useState(false);
  /** Shown below the capabilities description when the active model is deleted.
   *  Cleared as soon as the user selects a new active model row. */
  const [deletedActiveModelWarning, setDeletedActiveModelWarning] = useState(false);

  // Add Models UI state
  const [isAddModelsOpen, setIsAddModelsOpen] = useState(false);
  /** True while the inline Yes/No delete confirmation is showing for a row.
   *  Prevents Electron focus-loss that window.confirm() causes. */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const modelIds = aiSettings?.customModels?.map(m => m.id) || [];

  const getCaps = (modelId: string): ModelCapabilities => {
    return (
      aiSettings?.modelConfigs?.[modelId]?.capabilities ??
      aiSettings?.customModels?.find(m => m.id === modelId)?.capabilities ??
      { fileUpload: false, voice: true, thinking: false }
    );
  };

  const toggleCap = (modelId: string, cap: keyof ModelCapabilities, val: boolean) => {
    const currentCaps = getCaps(modelId);
    const updatedConfigs = {
      ...(aiSettings?.modelConfigs ?? {}),
      [modelId]: { capabilities: { ...currentCaps, [cap]: val } },
    };
    setGlobal("ai.modelConfigs", updatedConfigs);
  };

  /** Sets ai.defaultModelId to the clicked model, syncing the AI
   *  chat dropdown selection. Also clears the deleted-model warning if present. */
  const handleEnableModel = (modelId: string) => {
    setDeletedActiveModelWarning(false);
    setGlobal("ai.defaultModelId", modelId);
  };

  /** Deletes a model from ai.customModels and clears related config entries.
   *  Uses inline confirmation instead of window.confirm() to avoid Electron
   *  stealing focus from subsequent inputs (e.g. AddModelsModal text fields). */
  const handleDeleteModel = (modelId: string) => {
    const isDeletedModelActive = aiSettings?.defaultModelId === modelId;
    const updatedModels = aiSettings?.customModels?.filter(m => m.id !== modelId) ?? [];
    setGlobal("ai.customModels", updatedModels);
    if (isDeletedModelActive) {
      setGlobal("ai.defaultModelId", undefined);
      setDeletedActiveModelWarning(true);
    }
    const updatedConfigs = { ...(aiSettings?.modelConfigs ?? {}) };
    delete updatedConfigs[modelId];
    setGlobal("ai.modelConfigs", updatedConfigs);
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {/* RAG settings */}
      <SettingRow label="Default RAG" description="Enable local indexing for Retrieval-Augmented Generation when creating or opening new note directories.">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={aiSettings?.defaultRagEnabled ?? false}
            onCheckedChange={(checked) =>
              setGlobal("ai.defaultRagEnabled", !!checked)
            }
          />
          <Label className="text-sm">Enabled</Label>
        </div>
      </SettingRow>

      {/* Per-model capabilities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium mb-1">Model Capabilities</div>
            <div className="text-xs text-muted-foreground">
              Enable or disable UI features for each model and select a default model to use in AI chat.
            </div>
            {deletedActiveModelWarning && (
              <div className="text-xs text-destructive mt-1">
                The active model was deleted. Select another model to keep AI chat enabled.
              </div>
            )}
          </div>

          {/* Add Models Button */}
          <button
            onClick={() => setIsAddModelsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <RiAddLine className="w-4 h-4" />
            <span className="hidden sm:inline">Add Models...</span>
          </button>
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          {/* Header row */}
          <div className="flex items-center px-4 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground border-b border-border">
            <span className="flex-1">Model</span>
            <span className="w-24 text-center">File Upload</span>
            <span className="w-24 text-center">Voice</span>
            <span className="w-24 text-center">Thinking</span>
            <span className="w-16"></span>
          </div>
          {modelIds.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center justify-center text-center text-sm text-muted-foreground bg-muted/10">
              <p>No models configured yet.</p>
              <p className="mt-1 opacity-70">Click &quot;Add Models...&quot; to get started.</p>
            </div>
          ) : (
            modelIds.map((id, idx) => {
              const caps = getCaps(id);
              const isActiveModel = aiSettings?.defaultModelId === id;
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEnableModel(id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleEnableModel(id);
                    }
                  }}
                  className={`flex items-center px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                    idx > 0 ? "border-t border-border" : ""
                  } ${
                    isActiveModel
                      ? "bg-emerald-50 dark:bg-emerald-950/20"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <span className={`flex-1 font-medium truncate ${isActiveModel ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                    {aiSettings?.customModels?.find(m => m.id === id)?.name ?? id}
                  </span>
                  {(["fileUpload", "voice", "thinking"] as const).map((cap) => (
                    <div key={cap} className="w-24 flex justify-center">
                      <Checkbox
                        onClick={(event) => event.stopPropagation()}
                        checked={caps[cap]}
                        onCheckedChange={(checked) => toggleCap(id, cap, !!checked)}
                      />
                    </div>
                  ))}
                  <div className="w-16 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {confirmDeleteId === id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteModel(id)}
                          className="px-1.5 py-0.5 rounded text-xs font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-0.5 rounded text-xs font-medium bg-muted hover:bg-muted/80 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(id)}
                        className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete model"
                      >
                        <RiDeleteBinLine className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AddModelsModal
        isOpen={isAddModelsOpen}
        onClose={() => setIsAddModelsOpen(false)}
        defaultProvider="OpenAI"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Help tab
// ---------------------------------------------------------------------------

function HelpTab({ onStartTutorial }: { onStartTutorial: () => void }) {
  return (
    <div className="space-y-6">
      <SettingRow
        label="App Tour"
        description="Replay the guided first-time tutorial that highlights the main features of LocalNotes."
      >
        <Button variant="outline" size="sm" onClick={onStartTutorial}>
          Replay Tutorial
        </Button>
      </SettingRow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared layout helper
// ---------------------------------------------------------------------------

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-8">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {description}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
