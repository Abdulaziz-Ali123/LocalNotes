/**
 * Name of code artifact: renderer/components/AddModelsModal.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Shaun
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import React, { useState } from "react";
import { X } from "lucide-react";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";

const PROVIDERS = [
  "Anthropic",
  "xAI",
  "Google",
  "OpenRouter",
  "OpenAI",
  "Ollama",
  "Azure",
];

interface AddModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProvider?: string;
}

/**
 * Functionality: AddModelsModal performs the add models modal workflow used by renderer/components/AddModelsModal.tsx.
 * Parameters: { isOpen, onClose, defaultProvider = "OpenAI" } (AddModelsModalProps).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call AddModelsModal from the owning module or component when this behavior is required.
 */
export default function AddModelsModal({ isOpen, onClose, defaultProvider = "OpenAI" }: AddModelsModalProps) {
  const [provider, setProvider] = useState(defaultProvider);
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const aiSettings = useBoundStore((s) => s.settings.global?.ai);
  const setGlobal = useBoundStore((s) => s.settings.setGlobal);

  if (!isOpen) return null;

    /**
   * Functionality: handleSave performs the handle save workflow used by renderer/components/AddModelsModal.tsx.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call handleSave from the owning module or component when this behavior is required.
   */
const handleSave = () => {
    if (!modelName.trim()) return;

    const newModel = {
      id: `${provider.toLowerCase()}-${modelName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
      name: modelName.trim(),
      provider,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      capabilities: { fileUpload: true, voice: true, thinking: false }, // Default capabilities
    };

    const updatedCustomModels = [...(aiSettings?.customModels || []), newModel];
    setGlobal("ai.customModels", updatedCustomModels);

    // Reset form
    setModelName("");
    setApiKey("");
    setBaseUrl("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-lg w-[480px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add Custom Model</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="flex h-9 text-sm w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-sm transition-colors outline-none focus:ring-1 focus:ring-accent"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p} className="bg-background text-foreground text-sm">
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Model Name</Label>
            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. claude-3-5-sonnet-20240620"
            />
          </div>

          <div className="space-y-2">
            <Label>API Key {provider === "Ollama" && "(Optional)"}</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>

          <div className="space-y-2">
            <Label>Base URL (Optional)</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="Leave blank for default provider URL"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-muted/40">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!modelName.trim()}>
            Add Model
          </Button>
        </div>
      </div>
    </div>
  );
}
