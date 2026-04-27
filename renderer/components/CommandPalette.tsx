import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AppCommand } from "@/renderer/commands/command-registry";

interface CommandPaletteProps {
  isOpen: boolean;
  commands: AppCommand[];
  onClose: () => void;
}

const RECENT_COMMANDS_KEY = "commandPalette.recentCommandIds";
const MAX_RECENT_COMMANDS = 12;

function readRecentCommandIds(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_COMMANDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeRecentCommandId(commandId: string) {
  if (typeof window === "undefined") return;

  const next = [
    commandId,
    ...readRecentCommandIds().filter((id) => id !== commandId),
  ].slice(0, MAX_RECENT_COMMANDS);

  window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next));
}

function commandMatches(command: AppCommand, query: string): boolean {
  if (!query) return true;

  const haystack = [
    command.title,
    command.category,
    command.subtitle,
    ...(command.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

export default function CommandPalette({
  isOpen,
  commands,
  onClose,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setQuery("");
    setActiveIndex(0);
    setRecentCommandIds(readRecentCommandIds());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    const recentRank = new Map(
      recentCommandIds.map((commandId, index) => [commandId, index])
    );

    return commands
      .filter((command) => commandMatches(command, query))
      .sort((a, b) => {
        const aRecent = recentRank.get(a.id);
        const bRecent = recentRank.get(b.id);

        if (aRecent !== undefined || bRecent !== undefined) {
          if (aRecent === undefined) return 1;
          if (bRecent === undefined) return -1;
          return aRecent - bRecent;
        }

        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });
  }, [commands, query, recentCommandIds]);

  useEffect(() => {
    setActiveIndex((index) => {
      if (filteredCommands.length === 0) return 0;
      return Math.min(index, filteredCommands.length - 1);
    });
  }, [filteredCommands.length]);

  if (!isOpen) return null;

  const selectableCommands = filteredCommands.filter((command) => !command.disabled);
  const activeCommand = filteredCommands[activeIndex];

  const runCommand = async (command: AppCommand) => {
    if (command.disabled) return;

    writeRecentCommandId(command.id);
    setRecentCommandIds(readRecentCommandIds());
    onClose();
    await command.action();
  };

  const moveActive = (direction: 1 | -1) => {
    if (filteredCommands.length === 0) return;

    let nextIndex = activeIndex;
    for (let i = 0; i < filteredCommands.length; i += 1) {
      nextIndex =
        (nextIndex + direction + filteredCommands.length) % filteredCommands.length;
      if (!filteredCommands[nextIndex].disabled) {
        setActiveIndex(nextIndex);
        return;
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const commandToRun =
        activeCommand && !activeCommand.disabled ? activeCommand : selectableCommands[0];
      if (commandToRun) {
        void runCommand(commandToRun);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className="app-nodrag-region w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, files, settings, themes..."
            className="w-full rounded-lg bg-muted px-4 py-3 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No commands found.
            </div>
          ) : (
            filteredCommands.map((command, index) => {
              const isActive = index === activeIndex;
              const isRecent = recentCommandIds.includes(command.id);

              return (
                <button
                  key={command.id}
                  type="button"
                  disabled={command.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void runCommand(command)}
                  className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                  } ${command.disabled ? "cursor-not-allowed opacity-45" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{command.title}</span>
                    {command.subtitle && (
                      <span className="block truncate text-xs opacity-70">
                        {command.subtitle}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs opacity-70">
                    {isRecent && <span>Recent</span>}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {command.category}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
