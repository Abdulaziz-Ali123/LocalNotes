/**
 * SettingsDialog
 *
 * Full-screen modal dialog for managing global settings.
 * Contains three tabs: Appearance, Editor, and Keybindings.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { useTheme, type ThemeType } from "@/renderer/lib/theme";
import { X, Eye, EyeOff } from "lucide-react";
import { RiAddLine } from "react-icons/ri";
import { Button } from "@/renderer/components/ui/button";
import { Checkbox } from "@/renderer/components/ui/checkbox";
import { Label } from "@/renderer/components/ui/label";
import AddModelsModal from "@/renderer/components/AddModelsModal";
import { type ModelCapabilities } from "@/renderer/store/settings-slice";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which tab to show when the dialog opens (defaults to "appearance"). */
  defaultTab?: "appearance" | "editor" | "keybindings" | "ai";
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsDialog({ isOpen, onClose, defaultTab = "appearance" }: SettingsDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-lg w-[680px] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs.Root defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
          <Tabs.List className="flex border-b border-border px-6 gap-1">
            <TabTrigger value="appearance">Appearance</TabTrigger>
            <TabTrigger value="editor">Editor</TabTrigger>
            <TabTrigger value="keybindings">Keybindings</TabTrigger>
            <TabTrigger value="ai">AI</TabTrigger>
          </Tabs.List>

          <div className="flex-1 overflow-y-auto p-6">
            <Tabs.Content value="appearance" className="outline-none">
              <AppearanceTab />
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
          </div>
        </Tabs.Root>
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

  const fontSize = globalSettings.appearance.fontSize;
  const fontFamily = globalSettings.appearance.fontFamily;

  return (
    <div className="space-y-6">
      {/* Theme */}
      <SettingRow label="Theme" description="Choose the color theme for the app">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeType)}
          className="w-48 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        >
          <option value="nord">Nord (Default)</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="cozy">Cozy</option>
          <option value="darker">Darker</option>
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
                    className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                      idx > 0 ? "border-t border-border" : ""
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
                        className={`px-3 py-1 rounded-md text-xs font-mono min-w-[120px] text-center transition-colors ${
                          isRebinding
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
  const setGlobal   = useBoundStore((s) => s.settings.setGlobal);
  const [showKey, setShowKey] = useState(false);

  // Add Models UI state
  const [isAddModelsOpen, setIsAddModelsOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Endpoint */}
      <SettingRow label="Endpoint URL" description="Base URL for your LLM server (e.g. Ollama)">
        <input
          type="text"
          value={aiSettings?.endpointUrl ?? "http://localhost:11434"}
          onChange={(e) => setGlobal("ai.endpointUrl", e.target.value)}
          className="w-64 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
          placeholder="http://localhost:11434"
        />
      </SettingRow>

      {/* API Key */}
      <SettingRow label="API Key" description="Leave blank for local / unauthenticated servers">
        <div className="flex items-center gap-1.5">
          <input
            type={showKey ? "text" : "password"}
            value={aiSettings?.apiKey ?? ""}
            onChange={(e) => setGlobal("ai.apiKey", e.target.value)}
            className="w-56 p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
            placeholder="sk-..."
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </SettingRow>

      {/* Per-model capabilities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium mb-1">Model Capabilities</div>
            <div className="text-xs text-muted-foreground">
              Enable or disable UI features for each model.
            </div>
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
          </div>
          {modelIds.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center justify-center text-center text-sm text-muted-foreground bg-muted/10">
              <p>No models configured yet.</p>
              <p className="mt-1 opacity-70">Click &quot;Add Models...&quot; to get started.</p>
            </div>
          ) : (
            modelIds.map((id, idx) => {
              const caps = getCaps(id);
              return (
                <div
                  key={id}
                  className={`flex items-center px-4 py-2.5 text-sm ${
                    idx > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <span className="flex-1 font-medium truncate">
                    {aiSettings?.customModels?.find(m => m.id === id)?.name ?? id}
                  </span>
                  {(["fileUpload", "voice", "thinking"] as const).map((cap) => (
                    <div key={cap} className="w-24 flex justify-center">
                      <Checkbox
                        checked={caps[cap]}
                        onCheckedChange={(checked) => toggleCap(id, cap, !!checked)}
                      />
                    </div>
                  ))}
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
