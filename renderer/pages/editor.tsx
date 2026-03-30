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
 * 
 * Revision History:
 *  • Wesley McDougal - 29MAR2026 - Menu command handler and sidebar toggle fixes
 */

import { SidebarProvider, Sidebar, SidebarContent } from "../components/ui/sidebar";
import ThemeSelector from "@/renderer/components/ui/ThemeSelector";
import TagFilterPanel from "@/renderer/components/TagFilterPanel";
import React, { useEffect, useRef, useState } from "react";
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

// Autosave interval in milliseconds -> 10 seconds
const AUTOSAVE_INTERVAL = 10000;

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
  // Which tab the settings dialog should open to
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<"appearance" | "editor" | "keybindings">("appearance");

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

  useEffect(() => {
    const savedPath = localStorage.getItem("currentFolderPath");
    setRootPath(savedPath);
  }, []);

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
  const handleFileSelect = async (filePath: string) => {
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
  };

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
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<
    "file" | "search" | "theme" | "tags" | null
  >("file");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /**
   * Toggles sidebar open/close and switches active panel (file/search/theme/tags).
   * If sidebar is collapsed: opens sidebar and shows requested panel.
   * If same panel is active: closes sidebar. If different panel: switches to it.
   */
  const handleSidebarButtonClick = (panel: "file" | "search" | "theme" | "tags") => {
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
            localStorage.setItem("currentFolderPath", result.data);
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
      alert(`File exported to ${exportResult.exportedTo}`);
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

  return (
    <React.Fragment>
      <div className="flex flex-col h-screen">
        {/* Main Content Area */}
        <div className="flex flex-row flex-1 overflow-hidden">
          <div className="flex flex-col">
            {/* A drag region to allow dragging from the sidebar */}
            <div className="app-drag-region h-[41px] bg-background"></div>
            {/* Activity rail / fixed; controls the size of the left bar containing the buttons*/}
            <div className="flex flex-col items-center gap-2 px-2 py-4 bg-secondary w-18 border-r h-full">
              {/* justify-center can be added here to make it vertically centered */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSidebarButtonClick("file")}
                className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                title="Files"
              >
                {/*<img src="/assets/file_explorer.png" alt="Files" className="w-16 h-16 object-contain" />*/}
                <CiFileOn className="w-14 h-14 stroke-1" />
              </button>

              {/* search buttons */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSidebarButtonClick("search")}
                className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                title="Search"
              >
                {/* <img src="/assets/search.png" alt="Search" className="w-16 h-16 object-contain" /> */}
                <CiSearch className="w-14 h-14 stroke-1" />
              </button>

              {/* Import/ Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                    title="Import/Export"
                  >
                    <CiExport className="w-14 h-14 stroke-1" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-56 p-2">
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

              {/* AI Assistant button */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setActiveMainView((v) => (v === "ai" ? "editor" : "ai"))}
                className={`size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center transition-colors ${
                  activeMainView === "ai" ? "bg-accent/20 text-accent" : ""
                }`}
                title="AI Assistant"
              >
                <RiRobot2Line className="w-14 h-14" />
              </button>

              {/* Theme button */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSidebarButtonClick("theme")}
                className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                title="Themes"
              >
                <RiPaletteLine className="w-14 h-14" />
              </button>

              {/* Tag Filter button */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSidebarButtonClick("tags")}
                className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                title="Filter by Tags"
              >
                <Tag className="stroke-2 w-10 h-10" />
              </button>

              {/* Share button */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                    title="Share with Friends"
                  >
                    {/* <img src="/assets/share.png" alt="Share" className="w-16 h-16 object-contain" /> */}
                    <CiShare2 className="w-14 h-14 stroke-1" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-56 p-2">
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

              {/* Settings button */}
              <button
                onClick={() => { setSettingsDefaultTab("appearance"); setSettingsOpen(true); }}
                className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                title="Settings"
              >
                <CiSettings className="w-14 h-14 stroke-1" />
              </button>
              {/* File Change History button */}
              <button
                className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
                title="File Change History"
              >
                {/* <img src="/assets/folder.png" alt="Folder" className="w-16 h-16 object-contain" /> */}
                <RiFileHistoryLine className="w-14 h-14" />
              </button>
            </div>
          </div>

          <ResizablePanelGroup
            direction="horizontal"
            className="min-h-screen w-full bg-primary-foreground"
          >
            {/* Sidebar (resizable) + Editor */}
            <ResizablePanel
              ref={sidebarPanelRef}
              defaultSize={20}
              minSize={12}
              maxSize={40}
              collapsible={true}
              collapsedSize={0}
              onCollapse={() => setSidebarCollapsed(true)}
              onExpand={() => setSidebarCollapsed(false)}
              className={``}
            >
              {/* A drag region to allow dragging from the sidebar area */}
              <div className="app-drag-region h-10 bg-background"></div>

              <SidebarProvider>
                {/* Use non-fixed variant so the panel controls width; force w-full so Sidebar doesn't enforce its own CSS width variable */}
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
                  {/* AI view header with back-to-files affordance */}
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
                    <AIChatPanel />
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
          </ResizablePanelGroup>
        </div>



        {/* Settings Dialog */}
        <SettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} defaultTab={settingsDefaultTab} />

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
    </React.Fragment>
  );
}
