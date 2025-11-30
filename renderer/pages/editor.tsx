import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
} from "../components/ui/sidebar";
import React, { useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import FileSystemTree from "@/renderer/components/FileSystemTree";
import type { FileSystemTreeRef } from "@/renderer/components/FileSystemTree";
import { Button } from "@/renderer/components/ui/button";
import SearchComponent from "@/renderer/components/SearchComponent";
import { produce } from "immer";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { TabsSlice } from "@/renderer/types/tab-slice";
import { useKeyboardShortcuts } from "@/renderer/components/hooks/keyboardshortcuts";
import { CiFileOn, CiSearch, CiExport, CiShare2, CiSettings } from "react-icons/ci";
import { RiRobot2Line, RiFileHistoryLine } from "react-icons/ri";
import EditorSpace from "@/renderer/pages/editorSpace";
import { Tab } from "@/renderer/components/Tab";
import TabBar from "../components/TabBar";

// Autosave interval in milliseconds -> 10 seconds
const AUTOSAVE_INTERVAL = 10000;

export default function Editor() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<boolean>(true);
  const [livePreview, setLivePreview] = useState<boolean>(false);
  const fileTreeRef = useRef<FileSystemTreeRef>(null);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const initializeTabs = useBoundStore((state) => state.tabs.initialize);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Autosave states
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [justAutosaved, setJustAutosaved] = useState(false);
  const [lastAutosaveTime, setLastAutosaveTime] = useState<Date | null>(null);

  // keep a ref to the latest content so the interval callback doesn't need fileContent as a dep
  const contentRef = useRef<string>(fileContent);
  useEffect(() => {
    contentRef.current = fileContent;
  }, [fileContent]);

  // Track unsaved changes
  useEffect(() => {
    if (selectedFile && fileContent !== '') {
      setHasUnsavedChanges(true);
    }
  }, [fileContent, selectedFile]);

  useEffect(() => {
    document.title = 'LocalNotes';
  }, []);
  useEffect(() => {
    initializeTabs();
  }, [initializeTabs]);

  // Handle file selction from tree
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

  // Handle save action
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
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<"file" | "search" | null>("file");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSidebarButtonClick = (panel: "file" | "search") => {
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

  const toggleSidebar = () => setSidebarCollapsed((s) => !s);

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
        console.error('Autosave failed:', e);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [selectedFile, hasUnsavedChanges]);

  useKeyboardShortcuts({
    onSave: handleSave,
    onTogglePreview: () => {
      if (selectedFile?.toLowerCase().endsWith(".md")) {
        setPreviewMode(prev => !prev);
        setLivePreview(false);
      }
    },
    onToggleLivePreview: () => {
      if (selectedFile?.toLowerCase().endsWith(".md")) {
        setLivePreview(prev => !prev);
        setPreviewMode(true);
      }
    },
    onToggleSidebar: () => {
      toggleSidebar();
    },
    onNewFile: () => {
      if (sidebarCollapsed) {
        setSidebarCollapsed(false);
        setActiveSidebarPanel('file');
      }
      if (fileTreeRef.current) {
        const targetPath = selectedFile ? window.fs.dirname(selectedFile) : '';
        if (targetPath) {
          fileTreeRef.current.createNewFile(targetPath);
        }
      }
    },
    onNewFolder: () => {
      if (sidebarCollapsed) {
        setSidebarCollapsed(false);
        setActiveSidebarPanel('file');
      }
      if (fileTreeRef.current) {
        const targetPath = selectedFile ? window.fs.dirname(selectedFile) : '';
        if (targetPath) {
          fileTreeRef.current.createNewFolder(targetPath);
        }
      }
    },
    onSearch: () => {
      setSidebarCollapsed(false);
      setActiveSidebarPanel('search');
    },
    onOpenFolder: async () => {
      // Open file explorer sidebar if closed
      if (sidebarCollapsed) {
        setSidebarCollapsed(false);
        setActiveSidebarPanel('file');
      }
      // Trigger folder selection dialog
      const result = await window.fs.openFolderDialog();
      if (result.success && result.data) {
        // The FileSystemTree will handle loading the new folder
        localStorage.setItem("currentFolderPath", result.data);
        // Reload the page to mount the new folder
        window.location.reload();
      }
    },
    enabled: true,
  });

  return (
    <React.Fragment>
      <div className="flex flex-col h-screen">

        {/* Main Content Area */}
        <div className="flex flex-row flex-1 overflow-hidden">
          <div className="flex flex-col">
            {/* A drag region to allow dragging from the sidebar */}
            <div className="app-drag-region h-[41px] bg-background">
            </div>
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

              {/* Export buttons */}
              <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Export">
                {/* <img src="/assets/export.png" alt="Export" className="w-16 h-16 object-contain" /> */}
                <CiExport className="w-14 h-14 stroke-1" />
              </button>

              {/* AI Assistant button */}
              <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Ai Assistant - Coming Soon">
                {/* <img src="/assets/ai_helper.png" alt="AI" className="w-16 h-16 object-contain" /> */}
                <RiRobot2Line className="w-14 h-14" />
              </button>

              {/* Share button */}
              <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Share with Friends">
                {/* <img src="/assets/share.png" alt="Share" className="w-16 h-16 object-contain" /> */}
                <CiShare2 className="w-14 h-14 stroke-1" />
              </button>
              {/* Settings button */}
              <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Settings">
                {/* <img src="/assets/settings.png" alt="Settings" className="w-16 h-16 object-contain" /> */}
                <CiSettings className="w-14 h-14 stroke-1" />
              </button>
              {/* File Change History button */}
              <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="File Change History">
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
            <ResizablePanel ref={sidebarPanelRef}
              defaultSize={20}
              minSize={12}
              maxSize={40}
              collapsible={true}
              collapsedSize={0}
              onCollapse={() => setSidebarCollapsed(true)}
              onExpand={() => setSidebarCollapsed(false)}
              className={``}>
              {/* A drag region to allow dragging from the sidebar area */}
              <div className="app-drag-region h-10 bg-background">
              </div>

              <SidebarProvider>
                {/* Use non-fixed variant so the panel controls width; force w-full so Sidebar doesn't enforce its own CSS width variable */}
                <Sidebar collapsible="none" className="!static w-full">
                  <SidebarContent className="h-full p-0">
                    {!sidebarCollapsed && (
                      <>
                        {activeSidebarPanel === "file" && <FileSystemTree onFileSelect={handleFileSelect} isVisible={!sidebarCollapsed} autoOpen={true} />}
                        {activeSidebarPanel === "search" && <SearchComponent onFileSelect={handleFileSelect} />}
                      </>
                    )}
                  </SidebarContent>
                </Sidebar>
              </SidebarProvider>
            </ResizablePanel>
            <ResizableHandle className="w-0 hover:bg-accent hover:w-1 z-50 cursor-col-resize" />

            <ResizablePanel defaultSize={75} minSize={60}>
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
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>


        {/* Shortcuts Modal */}
        {showShortcuts && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowShortcuts(false)}
          >
            <div
              className="bg-background border border-border rounded-lg p-6 w-97"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Save</span><kbd className="px-2 py-1 bg-muted rounded">Ctrl+S</kbd></div>
                <div className="flex justify-between"><span>New File</span><kbd className="px-2 py-1 bg-muted rounded">Ctrl+N</kbd></div>
                <div className="flex justify-between"><span>New Folder</span><kbd className="px-2 py-1 bg-muted rounded">Ctrl+Shift+N</kbd></div>
                <div className="flex justify-between"><span>Toggle Preview (MD files)</span><kbd className="px-2 py-1 bg-muted rounded">Ctrl+P</kbd></div>
                <div className="flex justify-between"><span>Toggle Live Preview (MD files)</span><kbd className="px-2 py-1 bg-muted rounded">Ctrl+Shift+P</kbd></div>
                <div className="flex justify-between"><span>Toggle Sidebar</span><kbd className="px-2 py-1 bg-muted rounded">Ctrl+B</kbd></div>
                <div className="flex justify-between"><span>Open Folder</span><kbd className="px-2 py-1 bg-muted rounded">Ctrl+O</kbd></div>
                <div className="flex justify-between"><span>Search</span><kbd className="px-2 py-1 bg-muted rounded">Ctrl+F</kbd></div>
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center justify-between h-7 bg-background border-t border-border px-4 text-xs flex-shrink-0">
          <div className="flex items-center gap-3">
            {selectedFile && (
              <>
                <span className="font-mono text-foreground">{window.fs.basename(selectedFile)}</span>
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
                {window.fs.extname(selectedFile).toUpperCase() || 'No Extension Found'}
              </Button>
            )}

            {/* Autosave Status Button */}
            {selectedFile && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-5 px-2 text-xs ${justAutosaved
                  ? 'text-green-400 hover:text-green-300'
                  : hasUnsavedChanges
                    ? 'text-yellow-400 hover:text-yellow-300'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
                title={
                  justAutosaved
                    ? `Last autosave: ${lastAutosaveTime?.toLocaleString() || 'Just now'}`
                    : hasUnsavedChanges
                      ? 'Unsaved changes - will autosave soon'
                      : lastAutosaveTime
                        ? `Last autosave: ${lastAutosaveTime.toLocaleString()}`
                        : 'No unsaved changes'
                }
              >
                {justAutosaved ? 'Autosaved ✓' : hasUnsavedChanges ? 'Autosave ✗' : '—'}
              </Button>
            )}

            {/* Keyboard Shortcuts Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowShortcuts(true)}
              title="View all keyboard shortcuts"
            >
              Shortcuts
            </Button>
          </div>
        </div>
      </div>
    </React.Fragment >
  );
}
