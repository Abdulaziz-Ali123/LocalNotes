/**
 * SettingsDialog
 *
 * Full-screen modal dialog for managing global settings.
 * Contains tabs for Appearance, Editor, Keybindings, and LLM.
 */

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { useTheme, type ThemeType } from "@/renderer/lib/theme";
import { X } from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { Checkbox } from "@/renderer/components/ui/checkbox";
import { Label } from "@/renderer/components/ui/label";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which tab to show when the dialog opens (defaults to "appearance"). */
  defaultTab?: "appearance" | "editor" | "keybindings" | "llm";
}

interface LLMModelSpec {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  capabilities: {
    text: boolean;
    vision: boolean;
    voice: boolean;
  };
}

const EMPTY_MODEL_FORM: LLMModelSpec = {
  id: "",
  name: "",
  baseUrl: "",
  apiKey: "",
  model: "",
  capabilities: {
    text: true,
    vision: false,
    voice: false,
  },
};

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
            <TabTrigger value="llm">LLM</TabTrigger>
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
            <Tabs.Content value="llm" className="outline-none">
              <LLMTab />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LLM tab
// ---------------------------------------------------------------------------

function LLMTab() {
  const globalSettings = useBoundStore((s) => s.settings.global);
  const [models, setModels] = useState<LLMModelSpec[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(
    globalSettings.llm.defaultModelId ?? null
  );
  const [form, setForm] = useState<LLMModelSpec>(EMPTY_MODEL_FORM);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // refresh both model list and default selection together so badges and actions stay in sync
  const loadModels = useCallback(async () => {
    if (typeof window === "undefined" || !window.settings) return;

    try {
      setErrorMessage(null);
      const [loadedModels, defaultModel] = await Promise.all([
        window.settings.llmListModels(),
        window.settings.llmGetDefaultModel(),
      ]);

      setModels((loadedModels ?? []) as LLMModelSpec[]);
      setDefaultModelId((defaultModel?.id as string | undefined) ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load LLM models.";
      setErrorMessage(message);
    }
  }, []);

  useEffect(() => {
    // initial load when tab mounts
    loadModels();
  }, [loadModels]);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const resetForm = () => {
    setForm(EMPTY_MODEL_FORM);
    setSelectedModelId(null);
  };

  // local guardrails before sending model config to main process
  const validateForm = (): string | null => {
    if (!form.id.trim()) return "Model ID is required.";
    if (!form.name.trim()) return "Display name is required.";
    if (!form.baseUrl.trim()) return "Base URL is required.";
    if (!form.model.trim()) return "Model name is required.";
    return null;
  };

  const saveModel = async (setAsDefault: boolean) => {
    if (typeof window === "undefined" || !window.settings) return;

    clearMessages();
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    try {
      // upsert by id: create new model or update existing one
      await window.settings.llmUpsertModel(
        {
          ...form,
          id: form.id.trim(),
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim(),
          apiKey: form.apiKey?.trim() ?? "",
          model: form.model.trim(),
        },
        setAsDefault
      );

      await loadModels();
      setSuccessMessage(setAsDefault ? "Model saved and set as default." : "Model saved.");
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save model.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (modelId: string) => {
    if (typeof window === "undefined" || !window.settings) return;

    clearMessages();
    setIsDeleting(true);
    try {
      await window.settings.llmDeleteModel(modelId);
      await loadModels();

      // if deleted row was being edited, clear form back to add mode
      if (selectedModelId === modelId) {
        resetForm();
      }

      setSuccessMessage("Model deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete model.";
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async (model: LLMModelSpec) => {
    if (typeof window === "undefined" || !window.settings) return;

    clearMessages();
    setIsSaving(true);
    try {
      // main process sets default via upsert with setAsDefault=true
      await window.settings.llmUpsertModel(model, true);
      await loadModels();
      setSuccessMessage(`Default model set to ${model.name}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set default model.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const editModel = (model: LLMModelSpec) => {
    clearMessages();
    // pre-fill form from selected row so save updates this model id
    setSelectedModelId(model.id);
    setForm({
      id: model.id,
      name: model.name,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey ?? "",
      model: model.model,
      capabilities: {
        text: !!model.capabilities?.text,
        vision: !!model.capabilities?.vision,
        voice: !!model.capabilities?.voice,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">LLM Models</h3>
        <p className="text-xs text-muted-foreground">
          Add your own OpenAI-compatible endpoints, choose a default model, and manage credentials.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="space-y-4 rounded-md border border-border p-4">
        <h4 className="text-sm font-medium">{selectedModelId ? "Edit Model" : "Add Model"}</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={form.id}
            onChange={(e) => setForm((prev) => ({ ...prev, id: e.target.value }))}
            placeholder="Model ID (e.g. local-ollama)"
            className="w-full p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Display Name"
            className="w-full p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <input
            value={form.baseUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
            placeholder="Base URL (e.g. http://localhost:11434/v1)"
            className="w-full p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm sm:col-span-2"
          />
          <input
            value={form.model}
            onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="Model name (e.g. llama3.2)"
            className="w-full p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <input
            type="password"
            value={form.apiKey ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="API key (optional)"
            className="w-full p-2 rounded-md bg-secondary text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <Checkbox
              checked={form.capabilities.text}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  capabilities: { ...prev.capabilities, text: !!checked },
                }))
              }
            />
            Text
          </label>
          <label className="inline-flex items-center gap-2">
            <Checkbox
              checked={form.capabilities.vision}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  capabilities: { ...prev.capabilities, vision: !!checked },
                }))
              }
            />
            Vision
          </label>
          <label className="inline-flex items-center gap-2">
            <Checkbox
              checked={form.capabilities.voice}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  capabilities: { ...prev.capabilities, voice: !!checked },
                }))
              }
            />
            Voice
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => saveModel(false)} disabled={isSaving || isDeleting}>
            Save Model
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveModel(true)}
            disabled={isSaving || isDeleting}
          >
            Save and Set Default
          </Button>
          {selectedModelId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={resetForm}
              disabled={isSaving || isDeleting}
            >
              Cancel Edit
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Configured Models</h4>
        {models.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No models configured yet. Add one above to start using LLM features.
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            {models.map((model, idx) => (
              <div
                key={model.id}
                className={`flex items-start justify-between gap-4 px-4 py-3 ${idx > 0 ? "border-t border-border" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{model.name}</span>
                    {defaultModelId === model.id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">ID: {model.id}</p>
                  <p className="text-xs text-muted-foreground">Endpoint: {model.baseUrl}</p>
                  <p className="text-xs text-muted-foreground">Model: {model.model}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editModel(model)}
                    disabled={isSaving || isDeleting}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetDefault(model)}
                    disabled={isSaving || isDeleting || defaultModelId === model.id}
                  >
                    Set Default
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(model.id)}
                    disabled={isSaving || isDeleting}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab trigger helper
// ---------------------------------------------------------------------------

function TabTrigger({ value, children }: { value: string; children: ReactNode }) {
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
  const accelToActions = useMemo(() => {
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
// Shared layout helper
// ---------------------------------------------------------------------------

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
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
