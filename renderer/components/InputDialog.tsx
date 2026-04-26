/**
 * Name of code artifact: renderer/components/InputDialog.tsx
 * Brief description: Defines a renderer component that implements part of the LocalNotes user interface.
 * Programmer's name: LocalNotes development team
 * Git-history contributors: Wesley McDougal; Shaun
 * Date created: See repository history.
 * Dates revised: 2026-04-27
 * Revision history: Codex - 2026-04-27 - Added sprint-required prolog documentation and function comments.
 * Implementation notes: Keep this artifact aligned with the surrounding LocalNotes IPC, renderer, persistence, or styling contracts.
 */

import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Functionality: InputDialog performs the input dialog workflow used by renderer/components/InputDialog.tsx.
 * Parameters: { isOpen, title, placeholder = "", defaultValue = "", onConfirm, onCancel, } (InputDialogProps).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call InputDialog from the owning module or component when this behavior is required.
 */
export default function InputDialog({
  isOpen,
  title,
  placeholder = "",
  defaultValue = "",
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Focus input after a small delay to ensure it's rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

    /**
   * Functionality: handleSubmit performs the handle submit workflow used by renderer/components/InputDialog.tsx.
   * Parameters: e (React.FormEvent).
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call handleSubmit from the owning module or component when this behavior is required.
   */
const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

    /**
   * Functionality: handleKeyDown performs the handle key down workflow used by renderer/components/InputDialog.tsx.
   * Parameters: e (React.KeyboardEvent).
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call handleKeyDown from the owning module or component when this behavior is required.
   */
const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-background border rounded-lg shadow-lg p-6 w-96 max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 py-2 border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              OK
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
