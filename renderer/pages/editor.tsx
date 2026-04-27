/**
 * Main Editor Page (editor.tsx)
 *
 * The primary UI component for the application. Responsibilities include:
 * - Managing tab state (create, select, close, reorder)
 * - File selection and content editing with live preview
 * - Handling autosave with configurable intervals
 * - Sidebar management with file tree, search, theme customization, and tag filtering
 * - Built-in and custom theme selection with live preview
 * - Settings dialog (Appearance, Editor, Keybindings tabs)
 * - Keyboard shortcut binding and menu command dispatch
 * - File operations: new file/folder, save, open folder
 * - Import/export workflows for files and folders
 * - Markdown preview and live preview modes
 * - AI chat panel for assistant interactions
 * - Status bar showing file info and autosave status
 * - Responsive sidebar collapse/expand with active panel tracking
 * - Persistence of sidebar and editor state during session
 * Revision History:
 *  • Wesley McDougal - 29MAR2026 - Menu command handler and sidebar toggle fixes
 *  • Wesley McDougal - 05APR2026 - Added draggable sidebar rails, context-menu alignment, and bottom-rail layout updates
 *  • Wesley McDougal - 07APR2026 - Added "ai" to settingsDefaultTab union and handleOpenAiSettings
 *    callback so AIChatPanel can deep-link directly into the AI settings tab.
 */

import { SidebarProvider, Sidebar, SidebarContent } from "../components/ui/sidebar";
import ThemeSelector from "@/renderer/components/ui/ThemeSelector";
import TagFilterPanel from "@/renderer/components/TagFilterPanel";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import FileSystemTree from "@/renderer/components/FileSystemTree";
import { Button } from "@/renderer/components/ui/button";
import SearchComponent from "@/renderer/components/SearchComponent";
import { produce } from "immer";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { TabsSlice } from "@/renderer/types/tab-slice";
import { useKeybindings, KeybindingHandlers } from "@/renderer/hooks/useKeybindings";
import SettingsDialog from "@/renderer/components/SettingsDialog";
import CommandPalette from "@/renderer/components/CommandPalette";
import {
  buildCommandRegistry,
  type SettingsTab,
  type WorkspaceCommandFile,
} from "@/renderer/commands/command-registry";
import { useTheme } from "@/renderer/lib/theme";
import { CiFileOn, CiSearch, CiExport, CiShare2, CiSettings } from "react-icons/ci";
import {
  RiRobot2Line,
  RiFileHistoryLine,
  RiPaletteLine,
  RiFolderAddLine,
  RiFileAddLine,
  RiFileEditLine,
  RiFolderUploadLine,
  RiFileUploadLine,
} from "react-icons/ri";
import { Tag } from "lucide-react";
import EditorSpace from "@/renderer/pages/editorSpace";
import TabBar from "../components/TabBar";
import AIChatPanel from "@/renderer/components/AIChatPanel";
import { Popover, PopoverContent, PopoverTrigger } from "@/renderer/components/ui/popover";
import Link from "next/link";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  pointerWithin,
  rectIntersection,
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  SidebarEdge,
  SidebarLayoutScope,
  SidebarLayoutSettings,
  SidebarPosition,
  SidebarRailAlignment,
} from "@/renderer/store/settings-slice";

// Autosave interval in milliseconds -> 10 seconds
const AUTOSAVE_INTERVAL = 10000;

type SidebarPanel = "file" | "search" | "theme" | "tags";

interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

type SidebarIconId =
  | "file"
  | "search"
  | "import"
  | "ai"
  | "theme"
  | "tags"
  | "share"
  | "settings"
  | "history";

const DEFAULT_SIDEBAR_ICON_ORDER: SidebarIconId[] = [
  "file",
  "search",
  "import",
  "ai",
  "theme",
  "tags",
  "share",
  "settings",
  "history",
];

const SIDEBAR_EDGES: SidebarEdge[] = ["left", "right", "bottom"];

const DEFAULT_SIDEBAR_RAILS: Record<SidebarEdge, SidebarIconId[]> = {
  left: [...DEFAULT_SIDEBAR_ICON_ORDER],
  right: [],
  bottom: [],
};

const DEFAULT_SIDEBAR_RAIL_ALIGNMENT: Record<SidebarEdge, SidebarRailAlignment> = {
  left: "start",
  right: "start",
  bottom: "center",
};

const DEFAULT_SIDEBAR_LAYOUT: SidebarLayoutSettings = {
  panelPosition: "left",
  rails: {
    left: [...DEFAULT_SIDEBAR_RAILS.left],
    right: [...DEFAULT_SIDEBAR_RAILS.right],
    bottom: [...DEFAULT_SIDEBAR_RAILS.bottom],
  },
  railAlignment: {
    left: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.left,
    right: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.right,
    bottom: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.bottom,
  },
};

function sanitizeSidebarLayout(raw: unknown): SidebarLayoutSettings {
  const input = (raw ?? {}) as {
    panelPosition?: SidebarPosition;
    position?: SidebarPosition;
    rails?: Partial<Record<SidebarEdge, unknown>>;
    railAlignment?: Partial<Record<SidebarEdge, unknown>>;
    iconOrder?: unknown;
  };

  const panelPosition: SidebarPosition =
    input.panelPosition === "right" || input.position === "right"
      ? "right"
      : "left";

  const seen = new Set<SidebarIconId>();
  const rails: Record<SidebarEdge, SidebarIconId[]> = {
    left: [],
    right: [],
    bottom: [],
  };

  for (const edge of SIDEBAR_EDGES) {
    const rawEdge = input.rails?.[edge];
    const incoming = Array.isArray(rawEdge) ? rawEdge : [];
    for (const icon of incoming) {
      if (
        typeof icon === "string" &&
        DEFAULT_SIDEBAR_ICON_ORDER.includes(icon as SidebarIconId) &&
        !seen.has(icon as SidebarIconId)
      ) {
        rails[edge].push(icon as SidebarIconId);
        seen.add(icon as SidebarIconId);
      }
    }
  }

  // Backward compatibility with the previous single-rail layout shape.
  if (Array.isArray(input.iconOrder)) {
    for (const icon of input.iconOrder) {
      if (
        typeof icon === "string" &&
        DEFAULT_SIDEBAR_ICON_ORDER.includes(icon as SidebarIconId) &&
        !seen.has(icon as SidebarIconId)
      ) {
        rails.left.push(icon as SidebarIconId);
        seen.add(icon as SidebarIconId);
      }
    }
  }

  for (const icon of DEFAULT_SIDEBAR_ICON_ORDER) {
    if (!seen.has(icon)) {
      rails.left.push(icon);
    }
  }

  const railAlignment: Record<SidebarEdge, SidebarRailAlignment> = {
    left: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.left,
    right: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.right,
    bottom: DEFAULT_SIDEBAR_RAIL_ALIGNMENT.bottom,
  };

  for (const edge of SIDEBAR_EDGES) {
    const value = input.railAlignment?.[edge];
    if (value === "start" || value === "center" || value === "end") {
      railAlignment[edge] = value;
    }
  }

  return { panelPosition, rails, railAlignment };
}

function getIconLocation(
  rails: Record<SidebarEdge, SidebarIconId[]>,
  iconId: SidebarIconId
): { edge: SidebarEdge; index: number } | null {
  for (const edge of SIDEBAR_EDGES) {
    const index = rails[edge].indexOf(iconId);
    if (index >= 0) {
      return { edge, index };
    }
  }
  return null;
}

function SortableIcon({
  iconId,
  edge,
  className,
  onContextMenu,
  children,
}: {
  iconId: SidebarIconId;
  edge: SidebarEdge;
  className?: string;
  onContextMenu?: (edge: SidebarEdge, event: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: iconId });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${className ?? ""} app-nodrag-region ${isDragging ? "opacity-50" : ""}`.trim()}
      onContextMenuCapture={onContextMenu ? (event) => onContextMenu(edge, event) : undefined}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function EdgeRail({
  edge,
  items,
  alignment,
  isDragActive,
  onContextMenu,
  children,
}: {
  edge: SidebarEdge;
  items: SidebarIconId[];
  alignment: SidebarRailAlignment;
  isDragActive: boolean;
  onContextMenu: (edge: SidebarEdge, event: React.MouseEvent) => void;
  children: (iconId: SidebarIconId, edge: SidebarEdge) => React.ReactNode;
}) {
  const isHorizontal = edge === "bottom";
  const { setNodeRef, isOver } = useDroppable({ id: `rail:${edge}` });
  const shouldShowRail = isDragActive || items.length > 0;

  if (!shouldShowRail) {
    return null;
  }

  if (isHorizontal) {
    const borderClass = "border-t";
    const justifyClass =
      alignment === "start"
        ? "justify-start"
        : alignment === "end"
          ? "justify-end"
          : "justify-center";
    return (
      <div
        ref={setNodeRef}
        onContextMenuCapture={(event) => onContextMenu(edge, event)}
        className={`app-nodrag-region w-full min-h-[44px] ${borderClass} ${isOver ? "border-ring" : "border-border"} px-2 py-2 flex items-center ${justifyClass} gap-2 transition-all ${
          isOver ? "ring-4 ring-ring bg-accent/20 shadow-inner" : "bg-secondary"
        }`}
      >
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          {items.map((iconId) => (
            <SortableIcon key={iconId} iconId={iconId} edge={edge} onContextMenu={onContextMenu}>
              {children(iconId, edge)}
            </SortableIcon>
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="text-xs text-muted-foreground px-2 text-center">Drop icons here</div>
        )}
      </div>
    );
  }

  const borderClass = edge === "left" ? "border-r" : "border-l";
  const justifyClass =
    alignment === "start"
      ? "justify-start"
      : alignment === "end"
        ? "justify-end"
        : "justify-center";
  return (
    <div className="flex flex-col">
      <div className="app-drag-region h-[41px] bg-background"></div>
      <div
        ref={setNodeRef}
        onContextMenuCapture={(event) => onContextMenu(edge, event)}
        className={`app-nodrag-region w-14 h-full ${borderClass} ${isOver ? "border-ring" : "border-border"} px-2 py-4 flex flex-col items-center ${justifyClass} gap-2 transition-all ${
          isOver ? "ring-4 ring-ring bg-accent/20 shadow-inner" : "bg-secondary"
        }`}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((iconId) => (
            <SortableIcon
              key={iconId}
              iconId={iconId}
              edge={edge}
              className="rounded-md"
              onContextMenu={onContextMenu}
            >
              {children(iconId, edge)}
            </SortableIcon>
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="text-[10px] text-muted-foreground text-center">Drop icons here</div>
        )}
      </div>
    </div>
  );
}

const sidebarCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    return pointerHits;
  }

  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) {
    return rectHits;
  }

  return closestCenter(args);
};

export default function Editor() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<boolean>(true);
  const [livePreview, setLivePreview] = useState<boolean>(false);
  // (removed fileTreeRef used for selectPath)
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const fileTreeRef = useRef<any>(null);
  const initializeTabs = useBoundStore((state) => state.tabs.initialize);
  // Which tab the settings dialog should open to ("ai" added for deep-link)
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<"appearance" | "sidebar" | "editor" | "keybindings" | "ai">("appearance");

  // Callback passed down to AIChatPanel so the empty-state "Add AI Model"
  // button and the removed-model warning can navigate the user directly to the
  // AI tab of the Settings dialog without exposing dialog state to child components.
  const handleOpenAiSettings = React.useCallback(() => {
    setSettingsDefaultTab("ai");
    setSettingsOpen(true);
  }, []);

  // Autosave states
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [justAutosaved, setJustAutosaved] = useState(false);
  const [lastAutosaveTime, setLastAutosaveTime] = useState<Date | null>(null);

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Main view: editor (file tabs) vs AI chat
  const [activeMainView, setActiveMainView] = useState<"editor" | "ai">("editor");

  // Tag filter states
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceCommandFile[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const globalSettings = useBoundStore((s) => s.settings.global);
  const setGlobalSetting = useBoundStore((s) => s.settings.setGlobal);
  const { theme, customThemes, setTheme } = useTheme();

  const [layoutScope, setLayoutScope] = useState<SidebarLayoutScope>("global");
  const [sidebarLayout, setSidebarLayout] = useState<SidebarLayoutSettings>(
    DEFAULT_SIDEBAR_LAYOUT
  );
  const [activeDragIconId, setActiveDragIconId] = useState<SidebarIconId | null>(null);
  const [railContextMenu, setRailContextMenu] = useState<{
    edge: SidebarEdge;
    x: number;
    y: number;
  } | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const savedPath = localStorage.getItem("currentFolderPath");
    setRootPath(savedPath);
  }, []);

  useEffect(() => {
    if (!rootPath) {
      setWorkspaceFiles([]);
      return;
    }

    let cancelled = false;
    const skippedDirectories = new Set([".git", ".localnotes", "node_modules"]);
    const maxFiles = 500;

    const relativePathFor = (filePath: string) => {
      const prefix = rootPath.endsWith(window.fs.sep)
        ? rootPath
        : `${rootPath}${window.fs.sep}`;

      return filePath.startsWith(prefix)
        ? filePath.slice(prefix.length)
        : window.fs.basename(filePath);
    };

    const collectFiles = async () => {
      const files: WorkspaceCommandFile[] = [];
      const visitedDirectories = new Set<string>();

      const walk = async (dirPath: string) => {
        if (cancelled || files.length >= maxFiles || visitedDirectories.has(dirPath)) {
          return;
        }

        visitedDirectories.add(dirPath);
        const result = await window.fs.readDirectory(dirPath);
        if (!result.success || !Array.isArray(result.data)) {
          return;
        }

        const items = result.data as FileSystemItem[];
        for (const item of items) {
          if (cancelled || files.length >= maxFiles) {
            return;
          }

          if (item.isDirectory) {
            if (!skippedDirectories.has(item.name)) {
              await walk(item.path);
            }
            continue;
          }

          files.push({
            path: item.path,
            name: item.name,
            relativePath: relativePathFor(item.path),
          });
        }
      };

      await walk(rootPath);
      if (!cancelled) {
        setWorkspaceFiles(
          files.sort((a, b) =>
            a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: "base" })
          )
        );
      }
    };

    void collectFiles();

    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  // keep a ref to the latest content so the interval callback doesn't need fileContent as a dep
  const contentRef = useRef<string>(fileContent);
  useEffect(() => {
    contentRef.current = fileContent;
  }, [fileContent]);

  // Track unsaved changes
  useEffect(() => {
    if (selectedFile && fileContent !== "") {
      setHasUnsavedChanges(true);
    }
  }, [fileContent, selectedFile]);

  useEffect(() => {
    document.title = "LocalNotes";
  }, []);
  useEffect(() => {
    initializeTabs();
  }, [initializeTabs]);

  /**
   * Reads file content from disk and loads into currently selected tab.
   * Updates Zustand store with new filePath, content, and filename.
   * Called when user clicks file in FileSystemTree.
   */
  const handleFileSelect = useCallback(async (filePath: string) => {
    const result = await window.fs.readFile(filePath);
    if (!result.success) {
      console.error("Failed to read file:", result.error);
      return;
    }

    const selectedTabId = useBoundStore.getState().tabs.selectedTabId;

    // Update tab state directly
    useBoundStore.setState(
      produce((state: TabsSlice) => {
        const tab = state.tabs.items.find((t: any) => t.id === selectedTabId);
        if (tab) {
          tab.content = result.data;
          tab.filePath = filePath;
          tab.name = window.fs.basename(filePath);
        }
        return state;
      })
    );

    setSelectedFile(filePath);
    setFileContent(result.data);
  }, []);

  // Load content when selected tab changes
  const selectedTabId = useBoundStore((state) => state.tabs.selectedTabId);
  const selectedTab = useBoundStore((state) =>
    state.tabs.items.find((tab) => tab.id === state.tabs.selectedTabId)
  );

  useEffect(() => {
    if (selectedTab) {
      setSelectedFile(selectedTab.filePath);
      setFileContent(selectedTab.content);
    }
  }, [selectedTabId, selectedTab]);

  /**
   * Writes fileContent to disk, updates tab store, resets autosave flags.
   * Shows save confirmation message and updates lastAutosaveTime.
   * Called by Ctrl+S keybinding and File > Save menu.
   */
  const handleSave = async () => {
    const selectedTabId = useBoundStore.getState().tabs.selectedTabId;
    const tabState = useBoundStore.getState().tabs;
    const filePath = selectedTab?.filePath || null;

    if (!filePath) return;

    setIsSaving(true);
    const result = await window.fs.writeFile(filePath, fileContent);
    setIsSaving(false);

    if (result.success) {
      // Persist content to the tab store and native tab API so switching tabs reflects the saved content
      useBoundStore.setState(
        produce((state: TabsSlice) => {
          const tab = state.tabs.items.find((t) => t.id === selectedTabId);
          if (tab) {
            tab.content = fileContent;
          }
          return state;
        })
      );
      const fileName = window.fs.basename(filePath);
      const now = new Date();
      setSaveMessage(`Saved "${fileName}"`);

      // Reset autosave flags
      setHasUnsavedChanges(false);
      setJustAutosaved(true);
      setLastAutosaveTime(now);
      setTimeout(() => setJustAutosaved(false), 3000);
      setTimeout(() => setSaveMessage(""), 2000);
    } else {
      setSaveMessage(`Failed to save: ${result.error}`);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  // Sidebar state management for search/file panels
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<SidebarPanel | null>("file");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /**
   * Toggles sidebar open/close and switches active panel (file/search/theme/tags).
   * If sidebar is collapsed: opens sidebar and shows requested panel.
   * If same panel is active: closes sidebar. If different panel: switches to it.
   */
  const handleSidebarButtonClick = (panel: SidebarPanel) => {
    if (sidebarCollapsed) {
      // If sidebar is collapsed, open and show the panel
      setSidebarCollapsed(false);
      setActiveSidebarPanel(panel);
    } else {
      if (activeSidebarPanel === panel) {
        // Same panel is already active, close sidebar
        setSidebarCollapsed(true);
        setActiveSidebarPanel(null);
      } else {
        // Different panel clicked, switch active panel
        setActiveSidebarPanel(panel);
      }
    }
  };

  /**
   * Toggles sidebar collapsed/expanded state.
   * When opening: defaults to 'file' panel if no active panel was set.
   * Connected to ResizablePanel callbacks for visual sync.
   */
  const toggleSidebar = () => {
    setSidebarCollapsed((isCollapsed) => {
      if (isCollapsed && activeSidebarPanel === null) {
        setActiveSidebarPanel("file");
      }
      return !isCollapsed;
    });
  };

  useEffect(() => {
    const scope =
      globalSettings.appearance.sidebarLayoutScope === "project"
        ? "project"
        : "global";
    setLayoutScope(scope);
  }, [globalSettings.appearance.sidebarLayoutScope]);

  useEffect(() => {
    let cancelled = false;

    const loadLayout = async () => {
      if (layoutScope === "project" && rootPath) {
        try {
          const projectSettings = await window.settings.loadProject(rootPath);
          if (cancelled) return;
          const projectLayout = sanitizeSidebarLayout(
            projectSettings?.appearance?.sidebarLayout
          );
          setSidebarLayout(projectLayout);
          return;
        } catch (err) {
          console.error("Failed to load project sidebar layout:", err);
        }
      }

      const globalLayout = sanitizeSidebarLayout(
        globalSettings.appearance.sidebarLayout
      );
      if (!cancelled) {
        setSidebarLayout(globalLayout);
      }
    };

    void loadLayout();

    return () => {
      cancelled = true;
    };
  }, [layoutScope, rootPath, globalSettings.appearance.sidebarLayout]);

  const persistSidebarLayout = useCallback(
    (nextLayout: SidebarLayoutSettings, scopeOverride?: SidebarLayoutScope) => {
      const targetScope = scopeOverride ?? layoutScope;

      if (targetScope === "project" && rootPath) {
        void window.settings
          .setProject(rootPath, "appearance.sidebarLayout", nextLayout)
          .catch((err) => {
            console.error("Failed to persist project sidebar layout:", err);
          });
        return;
      }

      void setGlobalSetting("appearance.sidebarLayout", nextLayout);
    },
    [layoutScope, rootPath, setGlobalSetting]
  );

  const handleSidebarPositionChange = (position: SidebarPosition) => {
    setSidebarLayout((prev) => {
      if (prev.panelPosition === position) return prev;
      const next = { ...prev, panelPosition: position };
      persistSidebarLayout(next);
      return next;
    });
  };

  const handleSidebarScopeChange = (scope: SidebarLayoutScope) => {
    if (scope === "project" && !rootPath) {
      return;
    }

    setLayoutScope(scope);
    void setGlobalSetting("appearance.sidebarLayoutScope", scope);
  };

  const handleResetSidebarLayout = () => {
    const next = sanitizeSidebarLayout(DEFAULT_SIDEBAR_LAYOUT);
    setSidebarLayout(next);
    persistSidebarLayout(next);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setRailContextMenu(null);
    const iconId = event.active.id as SidebarIconId;
    if (DEFAULT_SIDEBAR_ICON_ORDER.includes(iconId)) {
      setActiveDragIconId(iconId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragIconId(null);

    const activeId = event.active.id as SidebarIconId;
    const overIdRaw = event.over?.id;
    if (!overIdRaw || !DEFAULT_SIDEBAR_ICON_ORDER.includes(activeId)) return;

    const overId = String(overIdRaw);

    setSidebarLayout((prev) => {
      const source = getIconLocation(prev.rails as Record<SidebarEdge, SidebarIconId[]>, activeId);
      if (!source) return prev;

      let targetEdge: SidebarEdge = source.edge;
      let targetIndex = source.index;

      if (overId.startsWith("rail:")) {
        targetEdge = overId.slice(5) as SidebarEdge;
        if (!SIDEBAR_EDGES.includes(targetEdge)) return prev;
        targetIndex = prev.rails[targetEdge].length;
      } else if (DEFAULT_SIDEBAR_ICON_ORDER.includes(overId as SidebarIconId)) {
        const target = getIconLocation(prev.rails as Record<SidebarEdge, SidebarIconId[]>, overId as SidebarIconId);
        if (!target) return prev;
        targetEdge = target.edge;
        targetIndex = target.index;
      } else {
        return prev;
      }

      const nextRails: Record<SidebarEdge, SidebarIconId[]> = {
        left: [...(prev.rails.left as SidebarIconId[])],
        right: [...(prev.rails.right as SidebarIconId[])],
        bottom: [...(prev.rails.bottom as SidebarIconId[])],
      };

      nextRails[source.edge].splice(source.index, 1);

      let insertionIndex = targetIndex;
      if (source.edge === targetEdge && source.index < targetIndex) {
        insertionIndex -= 1;
      }

      nextRails[targetEdge].splice(insertionIndex, 0, activeId);

      const nextLayout: SidebarLayoutSettings = {
        ...prev,
        rails: nextRails,
      };

      persistSidebarLayout(nextLayout);
      return nextLayout;
    });
  };

  const handleRailContextMenu = (edge: SidebarEdge, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setRailContextMenu({ edge, x: event.clientX, y: event.clientY });
  };

  const handleRailAlignmentChange = (edge: SidebarEdge, alignment: SidebarRailAlignment) => {
    setRailContextMenu(null);
    setSidebarLayout((prev) => {
      if (prev.railAlignment[edge] === alignment) {
        return prev;
      }

      const nextLayout: SidebarLayoutSettings = {
        ...prev,
        railAlignment: {
          ...prev.railAlignment,
          [edge]: alignment,
        },
      };

      persistSidebarLayout(nextLayout);
      return nextLayout;
    });
  };

  // Sync sidebar state with panel
  useEffect(() => {
    const panel = sidebarPanelRef.current;
    if (panel) {
      if (sidebarCollapsed) {
        panel.collapse();
      } else {
        panel.expand();
      }
    }
  }, [sidebarCollapsed]);

  // Autosave periodically
  useEffect(() => {
    if (!selectedFile) return;

    const interval = setInterval(async () => {
      if (!hasUnsavedChanges) return; // Don't save if no changes

      try {
        const result = await window.autosaveAPI.save(selectedFile, contentRef.current);
        if (result && result.success) {
          const now = new Date();

          // Mark as saved
          setHasUnsavedChanges(false);
          setJustAutosaved(true);
          setLastAutosaveTime(now);

          // Show success for 3 seconds
          setTimeout(() => {
            setJustAutosaved(false);
          }, 3000);
        }
      } catch (e) {
        console.error("Autosave failed:", e);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [selectedFile, hasUnsavedChanges]);

  /**
   * Dispatcher for menu commands and keybindings.
   * Routes command string (e.g., 'file.save', 'view.toggleSidebar') to appropriate handler.
   * Opened file sidebar automatically before file operations if collapsed.
   * Called by both keybindings and native menu via IPC.
   */
  const executeCommand = React.useCallback(
    async (command: string) => {
      switch (command) {
        case "app.openCommandPalette":
          setCommandPaletteOpen(true);
          break;
        case "file.save":
          await handleSave();
          break;
        case "file.open": {
          if (sidebarCollapsed) {
            setSidebarCollapsed(false);
            setActiveSidebarPanel("file");
          }
          const result = await window.fs.openFolderDialog();
          if (result.success && result.data) {
            const folderPath = result.data;
            localStorage.setItem("currentFolderPath", folderPath);
            
            // Check if folder is already in database
            const idRes = await window.db.getDirectoryIdByPath(folderPath);
            let uuid = idRes.success && idRes.data ? idRes.data : crypto.randomUUID();
            
            // Register if not found
            if (!idRes.data) {
                await window.db.addDirectory(uuid, folderPath);
            }
            
            // Initialize .localnotes/.env for compatibility
            const localNotesDir = window.fs.join(folderPath, ".localnotes");
            await window.fs.createFolder(localNotesDir);
            await window.fs.writeFile(window.fs.join(localNotesDir, ".env"), `DIRECTORY_ID=${uuid}`);
            
            // Reload to re-initialize tree etc.
            window.location.reload();
          }
          break;
        }
        case "file.newFile": {
          if (sidebarCollapsed) {
            setSidebarCollapsed(false);
            setActiveSidebarPanel("file");
          }
          if (fileTreeRef.current) {
            const targetPath = selectedFile ? window.fs.dirname(selectedFile) : "";
            if (targetPath) {
              fileTreeRef.current.createNewFile(targetPath);
            }
          }
          break;
        }
        case "file.newFolder": {
          if (sidebarCollapsed) {
            setSidebarCollapsed(false);
            setActiveSidebarPanel("file");
          }
          if (fileTreeRef.current) {
            const targetPath = selectedFile ? window.fs.dirname(selectedFile) : "";
            if (targetPath) {
              fileTreeRef.current.createNewFolder(targetPath);
            }
          }
          break;
        }
        case "view.togglePreview":
          if (selectedFile?.toLowerCase().endsWith(".md")) {
            setPreviewMode((prev) => !prev);
            setLivePreview(false);
          }
          break;
        case "view.toggleLivePreview":
          if (selectedFile?.toLowerCase().endsWith(".md")) {
            setLivePreview((prev) => !prev);
            setPreviewMode(true);
          }
          break;
        case "view.toggleSidebar":
          toggleSidebar();
          break;
        case "view.search":
          setSidebarCollapsed(false);
          setActiveSidebarPanel("search");
          break;
        default:
          break;
      }
    },
    [handleSave, selectedFile, sidebarCollapsed]
  );

  const keybindingHandlers: KeybindingHandlers = {
    "app.openCommandPalette": () => {
      void executeCommand("app.openCommandPalette");
    },
    "file.save": () => {
      void executeCommand("file.save");
    },
    "file.open": () => {
      void executeCommand("file.open");
    },
    "file.newFile": () => {
      void executeCommand("file.newFile");
    },
    "file.newFolder": () => {
      void executeCommand("file.newFolder");
    },
    "view.togglePreview": () => {
      void executeCommand("view.togglePreview");
    },
    "view.toggleLivePreview": () => {
      void executeCommand("view.toggleLivePreview");
    },
    "view.toggleSidebar": () => {
      void executeCommand("view.toggleSidebar");
    },
    "view.search": () => {
      void executeCommand("view.search");
    },
  };

  // Settings-driven keybindings (reads shortcuts from the settings store)
  useKeybindings({
    handlers: keybindingHandlers,
    enabled: true,
  });

  // Native menu actions arrive from the main process and execute the same commands as keybindings.
  useEffect(() => {
    const dispose = window.ipc.on("menu:command", (command: string) => {
      void executeCommand(command);
    });

    return () => {
      dispose();
    };
  }, [executeCommand]);

  /**
   * Shows file picker, copies selected files to current folder, reloads folder view.
   * Called by Import > Import File(s) button.
   */
  const handleImportFiles = async () => {
    const currentFolder = localStorage.getItem("currentFolderPath");
    if (!currentFolder) {
      alert("Please open a folder first.");
      return;
    }

    try {
      const result = await window.fs.selectImportFiles();
      if (result.success && result.paths) {
        for (const srcPath of result.paths) {
          const fileName = window.fs.basename(srcPath);
          const destPath = window.fs.join(currentFolder, fileName);
          await window.fs.copyFile(srcPath, destPath);
        }
        // Reload folder to show new files
        window.location.reload();
      }
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import files.");
    }
  };

  /**
   * Shows folder picker, recursively imports entire folder to current location, reloads view.
   * Called by Import > Import Folder button.
   */
  const handleImportFolder = async () => {
    const currentFolder = localStorage.getItem("currentFolderPath");
    if (!currentFolder) {
      alert("Please open a folder first.");
      return;
    }

    try {
      const result = await window.fs.openFolderDialog();
      if (result.success && result.data) {
        const sourceFolder = result.data;
        await window.fs.importFolder(sourceFolder, currentFolder);
        // Reload folder to show new folder
        window.location.reload();
      }
    } catch (error) {
      console.error("Folder import failed:", error);
      alert("Failed to import folder.");
    }
  };

  /**
   * Shows file picker, merges content of selected files into currently open note.
   * Refreshes editor with merged content.
   * Called by Import > Import into Note button (disabled if no file selected).
   */
  const handleImportIntoNote = async () => {
    if (!selectedFile) {
      alert("Please select a note first.");
      return;
    }

    try {
      const result = await window.fs.selectImportFiles();
      if (result.success && result.paths) {
        await window.fs.mergeFiles(result.paths, selectedFile);

        // Refresh content
        const readResult = await window.fs.readFile(selectedFile);
        if (readResult.success) {
          setFileContent(readResult.data);
          // Update tab content as well
          useBoundStore.setState(
            produce((state: TabsSlice) => {
              const tab = state.tabs.items.find((t: any) => t.id === selectedTabId);
              if (tab) {
                tab.content = readResult.data;
              }
              return state;
            })
          );
        }
      }
    } catch (error) {
      console.error("Import into note failed:", error);
      alert("Failed to import into note.");
    }
  };

  /**
   * Shows destination picker, exports currently selected file, shows confirmation.
   * Called by Share > Export Current File button.
   */
  const handleExportCurrentFile = async () => {
    if (!selectedFile) {
      alert("No file selected to export.");
      return;
    }

    const result = await window.fs.selectExportDestination();
    if (!result.success) return;

    const exportResult = await window.fs.exportFile(selectedFile, result.folder);

    if (exportResult.success) {
      refreshTree();
      const exportedTo = (exportResult as { exportedTo?: string }).exportedTo ?? result.folder;
      alert(`File exported to ${exportedTo}`);
    } else {
      alert("Export failed: " + exportResult.error);
    }
  };

  /**
   * Shows destination picker, exports entire workspace folder, shows confirmation.
   * Called by Share > Export Workspace button.
   */
  const handleExportFolder = async () => {
    const root = localStorage.getItem("currentFolderPath");
    if (!root) return;

    const dest = await window.fs.selectExportDestination();
    if (!dest.success) return;

    const result = await window.fs.exportFolder(root, dest.folder);

    if (result.success) {
      refreshTree();
      alert("Folder exported successfully!");
    } else {
      alert("Export failed: " + result.error);
    }
  };

  /**
   * Refreshes FileSystemTree display by calling reloadRoot on ref.
   * Called after import/export operations to show new files.
   */
  const refreshTree = () => {
    if (fileTreeRef.current && fileTreeRef.current.reloadRoot) {
      fileTreeRef.current.reloadRoot();
    }
  };

  const openSettingsTab = useCallback((tab: SettingsTab) => {
    setSettingsDefaultTab(tab);
    setSettingsOpen(true);
  }, []);

  const openSidebarPanel = useCallback((panel: SidebarPanel) => {
    setSidebarCollapsed(false);
    setActiveSidebarPanel(panel);
  }, []);

  const commandPaletteCommands = React.useMemo(
    () =>
      buildCommandRegistry({
        selectedFile,
        rootPath,
        workspaceFiles,
        currentTheme: theme,
        customThemes,
        settings: globalSettings,
        executeAction: executeCommand,
        openSettings: openSettingsTab,
        openSidebarPanel,
        setMainView: setActiveMainView,
        openWorkspaceFile: handleFileSelect,
        setTheme,
        setGlobalSetting,
      }),
    [
      selectedFile,
      rootPath,
      workspaceFiles,
      theme,
      customThemes,
      globalSettings,
      executeCommand,
      openSettingsTab,
      openSidebarPanel,
      handleFileSelect,
      setTheme,
      setGlobalSetting,
    ]
  );

  const popoverSideForEdge = (edge: SidebarEdge): "left" | "right" | "top" | "bottom" => {
    if (edge === "left") return "right";
    if (edge === "right") return "left";
    if (edge === "bottom") return "left";
    return "top";
  };

  const isProjectScopeAvailable = Boolean(rootPath);

  const renderSidebarIcon = (iconId: SidebarIconId, edge: SidebarEdge) => {
    const popoverSide = popoverSideForEdge(edge);
    const handleSidebarIconMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.button === 0) {
        event.preventDefault();
      }
    };

    switch (iconId) {
      case "file":
        return (
          <button
            type="button"
            onMouseDown={handleSidebarIconMouseDown}
            onClick={() => handleSidebarButtonClick("file")}
            className="app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
            title="Files"
          >
            <CiFileOn className="w-14 h-14 stroke-1" />
          </button>
        );

      case "search":
        return (
          <button
            type="button"
            onMouseDown={handleSidebarIconMouseDown}
            onClick={() => handleSidebarButtonClick("search")}
            className="app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
            title="Search"
          >
            <CiSearch className="w-14 h-14 stroke-1" />
          </button>
        );

      case "import":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                title="Import/Export"
              >
                <CiExport className="w-14 h-14 stroke-1" />
              </button>
            </PopoverTrigger>
            <PopoverContent side={popoverSide} align="start" className="w-56 p-2">
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleImportFiles}
                  className="flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-left w-full"
                >
                  <RiFileAddLine className="w-4 h-4" />
                  <span>Import File(s)</span>
                </button>
                <button
                  onClick={handleImportFolder}
                  className="flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-left w-full"
                >
                  <RiFolderAddLine className="w-4 h-4" />
                  <span>Import Folder</span>
                </button>
                <button
                  onClick={handleImportIntoNote}
                  className="flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-left w-full"
                  disabled={!selectedFile}
                >
                  <RiFileEditLine className="w-4 h-4" />
                  <span className={!selectedFile ? "text-muted-foreground" : ""}>
                    Import into Note
                  </span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        );

      case "ai":
        return (
          <button
            type="button"
            onMouseDown={handleSidebarIconMouseDown}
            onClick={() => setActiveMainView((v) => (v === "ai" ? "editor" : "ai"))}
            className={`app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center transition-colors ${
              activeMainView === "ai" ? "bg-accent/20 text-accent" : ""
            }`}
            title="AI Assistant"
          >
            <RiRobot2Line className="w-14 h-14" />
          </button>
        );

      case "theme":
        return (
          <button
            type="button"
            onMouseDown={handleSidebarIconMouseDown}
            onClick={() => handleSidebarButtonClick("theme")}
            className="app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
            title="Themes"
          >
            <RiPaletteLine className="w-14 h-14" />
          </button>
        );

      case "tags":
        return (
          <button
            type="button"
            onMouseDown={handleSidebarIconMouseDown}
            onClick={() => handleSidebarButtonClick("tags")}
            className="app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
            title="Filter by Tags"
          >
            <Tag className="stroke-2 w-10 h-10" />
          </button>
        );

      case "share":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onMouseDown={handleSidebarIconMouseDown}
                className="app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                title="Share with Friends"
              >
                <CiShare2 className="w-14 h-14 stroke-1" />
              </button>
            </PopoverTrigger>
            <PopoverContent side={popoverSide} align="start" className="w-56 p-2">
              <button
                onClick={handleExportCurrentFile}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-left w-full"
              >
                <RiFileUploadLine className="w-4 h-4" />
                <span>Export Current File</span>
              </button>
              <button
                onClick={handleExportFolder}
                className="flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent text-left w-full"
              >
                <RiFolderUploadLine className="w-4 h-4" />
                <span>Export Workspace</span>
              </button>
            </PopoverContent>
          </Popover>
        );

      case "settings":
        return (
          <button
            type="button"
            onClick={() => {
              setSettingsDefaultTab("sidebar");
              setSettingsOpen(true);
            }}
            className="app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
            title="Settings"
          >
            <CiSettings className="w-14 h-14 stroke-1" />
          </button>
        );

      case "history":
        return (
          <button
            type="button"
            className="app-nodrag-region size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
            title="File Change History"
          >
            <RiFileHistoryLine className="w-14 h-14" />
          </button>
        );

      default:
        return null;
    }
  };

  const leftRailIcons = sidebarLayout.rails.left as SidebarIconId[];
  const rightRailIcons = sidebarLayout.rails.right as SidebarIconId[];
  const bottomRailIcons = sidebarLayout.rails.bottom as SidebarIconId[];

  return (
    <React.Fragment>
      <DndContext
        sensors={dndSensors}
        collisionDetection={sidebarCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col h-screen">

          {/* Main Content Area */}
          <div className="flex flex-row flex-1 overflow-hidden">
            <EdgeRail
              edge="left"
              items={leftRailIcons}
              alignment={sidebarLayout.railAlignment.left}
              isDragActive={Boolean(activeDragIconId)}
              onContextMenu={handleRailContextMenu}
            >
              {renderSidebarIcon}
            </EdgeRail>

            <ResizablePanelGroup
              direction="horizontal"
              className="min-h-screen w-full bg-primary-foreground"
            >
              {sidebarLayout.panelPosition === "left" ? (
              <>
                <ResizablePanel
                  ref={sidebarPanelRef}
                  defaultSize={20}
                  minSize={12}
                  maxSize={40}
                  collapsible={true}
                  collapsedSize={0}
                  onCollapse={() => setSidebarCollapsed(true)}
                  onExpand={() => setSidebarCollapsed(false)}
                >
                  <div className="app-drag-region h-10 bg-background"></div>

                  <SidebarProvider>
                    <Sidebar collapsible="none" className="!static w-full">
                      <SidebarContent className="h-full p-0">
                        {!sidebarCollapsed && (
                          <>
                            {activeSidebarPanel === "file" && (
                              <FileSystemTree
                                ref={fileTreeRef}
                                onFileSelect={handleFileSelect}
                                isVisible={!sidebarCollapsed}
                                autoOpen={true}
                              />
                            )}
                            {activeSidebarPanel === "search" && (
                              <SearchComponent onFileSelect={handleFileSelect} />
                            )}
                            {activeSidebarPanel === "theme" && <ThemeSelector />}
                            {activeSidebarPanel === "tags" && (
                              <TagFilterPanel
                                rootPath={rootPath}
                                onFiltersChange={setSelectedTagFilters}
                              />
                            )}
                          </>
                        )}
                      </SidebarContent>
                    </Sidebar>
                  </SidebarProvider>
                </ResizablePanel>
                <ResizableHandle className="w-0 hover:bg-accent hover:w-1 z-50 cursor-col-resize" />
                <ResizablePanel defaultSize={75} minSize={60}>
                  {activeMainView === "ai" ? (
                    <div className="flex flex-col h-full overflow-hidden">
                      <div className="flex-shrink-0 flex items-center bg-background h-10 px-4 app-drag-region">
                                          <div className="app-nodrag-region flex items-center gap-2 mt-2">
                                              <button
                                                  onClick={() => setActiveMainView("editor")}
                                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                              >
                                                  <CiFileOn className="w-4 h-4" />
                                                  Back to Files
                                              </button>
    
                                          <span className="text-xs text-muted-foreground/50">|</span>
    
                                          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                                  <RiRobot2Line className="w-3.5 h-3.5" />
                                                  AI Chat
                                              </span>
    
                                          <Link href="/quiz">
                                              <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="h-7 px-2 text-xs"
                                              >
                                                  Open Quiz Preview
                                              </Button>
                                          </Link>
                                      </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        <AIChatPanel onOpenAiSettings={handleOpenAiSettings} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <TabBar />
                      <EditorSpace
                        selectedFile={selectedFile}
                        previewMode={previewMode}
                        livePreview={livePreview}
                        fileContent={fileContent}
                        isSaving={isSaving}
                        handleSave={handleSave}
                        setPreviewMode={setPreviewMode}
                        setLivePreview={setLivePreview}
                        setFileContent={setFileContent}
                        saveMessage={saveMessage}
                      />
                    </>
                  )}
                </ResizablePanel>
              </>
            ) : (
              <>
                <ResizablePanel defaultSize={75} minSize={60}>
                  {activeMainView === "ai" ? (
                    <div className="flex flex-col h-full overflow-hidden">
                      <div className="flex-shrink-0 flex items-center bg-background h-10 px-4 app-drag-region">
                        <div className="app-nodrag-region flex items-center gap-2 mt-2">
                          <button
                            onClick={() => setActiveMainView("editor")}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <CiFileOn className="w-4 h-4" />
                            Back to Files
                          </button>
                          <span className="text-xs text-muted-foreground/50">|</span>
                          <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                            <RiRobot2Line className="w-3.5 h-3.5" />
                            AI Chat
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        <AIChatPanel onOpenAiSettings={handleOpenAiSettings} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <TabBar />
                      <EditorSpace
                        selectedFile={selectedFile}
                        previewMode={previewMode}
                        livePreview={livePreview}
                        fileContent={fileContent}
                        isSaving={isSaving}
                        handleSave={handleSave}
                        setPreviewMode={setPreviewMode}
                        setLivePreview={setLivePreview}
                        setFileContent={setFileContent}
                        saveMessage={saveMessage}
                      />
                    </>
                  )}
                </ResizablePanel>
                <ResizableHandle className="w-0 hover:bg-accent hover:w-1 z-50 cursor-col-resize" />
                <ResizablePanel
                  ref={sidebarPanelRef}
                  defaultSize={20}
                  minSize={12}
                  maxSize={40}
                  collapsible={true}
                  collapsedSize={0}
                  onCollapse={() => setSidebarCollapsed(true)}
                  onExpand={() => setSidebarCollapsed(false)}
                >
                  <div className="app-drag-region h-10 bg-background"></div>

                  <SidebarProvider>
                    <Sidebar collapsible="none" className="!static w-full">
                      <SidebarContent className="h-full p-0">
                        {!sidebarCollapsed && (
                          <>
                            {activeSidebarPanel === "file" && (
                              <FileSystemTree
                                ref={fileTreeRef}
                                onFileSelect={handleFileSelect}
                                isVisible={!sidebarCollapsed}
                                autoOpen={true}
                              />
                            )}
                            {activeSidebarPanel === "search" && (
                              <SearchComponent onFileSelect={handleFileSelect} />
                            )}
                            {activeSidebarPanel === "theme" && <ThemeSelector />}
                            {activeSidebarPanel === "tags" && (
                              <TagFilterPanel
                                rootPath={rootPath}
                                onFiltersChange={setSelectedTagFilters}
                              />
                            )}
                          </>
                        )}
                      </SidebarContent>
                    </Sidebar>
                  </SidebarProvider>
                </ResizablePanel>
              </>
              )}
            </ResizablePanelGroup>

            <EdgeRail
              edge="right"
              items={rightRailIcons}
              alignment={sidebarLayout.railAlignment.right}
              isDragActive={Boolean(activeDragIconId)}
              onContextMenu={handleRailContextMenu}
            >
              {renderSidebarIcon}
            </EdgeRail>
          </div>

          <EdgeRail
            edge="bottom"
            items={bottomRailIcons}
            alignment={sidebarLayout.railAlignment.bottom}
            isDragActive={Boolean(activeDragIconId)}
            onContextMenu={handleRailContextMenu}
          >
            {renderSidebarIcon}
          </EdgeRail>

          <DropdownMenuPrimitive.Root
            open={Boolean(railContextMenu)}
            modal={false}
            onOpenChange={(open) => {
              if (!open) {
                setRailContextMenu(null);
              }
            }}
          >
            <DropdownMenuPrimitive.Trigger asChild>
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none fixed size-0 opacity-0"
                style={{
                  left: railContextMenu?.x ?? 0,
                  top: railContextMenu?.y ?? 0,
                }}
              />
            </DropdownMenuPrimitive.Trigger>
            {railContextMenu && (
              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                  sideOffset={8}
                  align="start"
                  className="app-nodrag-region z-50 min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none"
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  {(
                    railContextMenu.edge === "bottom"
                      ? [
                          { value: "start", label: "Align Left" },
                          { value: "center", label: "Align Center" },
                          { value: "end", label: "Align Right" },
                        ]
                      : [
                          { value: "start", label: "Align Top" },
                          { value: "center", label: "Align Center" },
                          { value: "end", label: "Align Bottom" },
                        ]
                  ).map((option) => (
                    <DropdownMenuPrimitive.Item
                      key={option.value}
                      onSelect={() =>
                        handleRailAlignmentChange(
                          railContextMenu.edge,
                          option.value as SidebarRailAlignment
                        )
                      }
                      className={`relative flex cursor-default select-none items-center justify-between rounded-sm px-3 py-2 text-sm outline-none transition-colors focus:bg-accent ${
                        sidebarLayout.railAlignment[railContextMenu.edge] === option.value
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span>{option.label}</span>
                      {sidebarLayout.railAlignment[railContextMenu.edge] === option.value && (
                        <span>•</span>
                      )}
                    </DropdownMenuPrimitive.Item>
                  ))}
                </DropdownMenuPrimitive.Content>
              </DropdownMenuPrimitive.Portal>
            )}
          </DropdownMenuPrimitive.Root>


          <CommandPalette
            isOpen={commandPaletteOpen}
            commands={commandPaletteCommands}
            onClose={() => setCommandPaletteOpen(false)}
          />

          {/* Settings Dialog */}
          <SettingsDialog
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            defaultTab={settingsDefaultTab}
            sidebarLayout={sidebarLayout}
            layoutScope={layoutScope}
            isProjectScopeAvailable={isProjectScopeAvailable}
            onSidebarPositionChange={handleSidebarPositionChange}
            onSidebarScopeChange={handleSidebarScopeChange}
            onResetSidebarLayout={handleResetSidebarLayout}
          />

          {/* Status Bar */}
          <div className="flex items-center justify-between h-7 bg-background border-t border-border px-4 text-xs flex-shrink-0">
          <div className="flex items-center gap-3">
            {selectedFile && (
              <>
                <span className="font-mono text-foreground">
                  {window.fs.basename(selectedFile)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* File Type Button */}
            {selectedFile && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="File type"
              >
                {window.fs.extname(selectedFile).toUpperCase() || "No Extension Found"}
              </Button>
            )}

            {/* Autosave Status Button */}
            {selectedFile && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-5 px-2 text-xs ${
                  justAutosaved
                    ? "text-green-400 hover:text-green-300"
                    : hasUnsavedChanges
                      ? "text-yellow-400 hover:text-yellow-300"
                      : "text-muted-foreground hover:text-foreground"
                }`}
                title={
                  justAutosaved
                    ? `Last autosave: ${lastAutosaveTime?.toLocaleString() || "Just now"}`
                    : hasUnsavedChanges
                      ? "Unsaved changes - will autosave soon"
                      : lastAutosaveTime
                        ? `Last autosave: ${lastAutosaveTime.toLocaleString()}`
                        : "No unsaved changes"
                }
              >
                {justAutosaved ? "Autosaved ✓" : hasUnsavedChanges ? "Autosave ✗" : "—"}
              </Button>
            )}

            {/* Keyboard Shortcuts Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setSettingsDefaultTab("keybindings"); setSettingsOpen(true); }}
              title="View all keyboard shortcuts"
            >
              Shortcuts
            </Button>
          </div>
          </div>
        </div>

        <DragOverlay>
          {activeDragIconId ? (
            <div className="scale-110 shadow-lg ring-2 ring-ring/50">
              {renderSidebarIcon(activeDragIconId, "bottom")}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </React.Fragment>
  );
}
