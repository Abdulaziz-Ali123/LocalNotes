import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  useSidebar,
} from "../components/ui/sidebar";
import React, { useEffect, useState } from "react";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import FileSystemTree from "@/renderer/components/FileSystemTree";
import type { FileSystemTreeRef } from "@/renderer/components/FileSystemTree";
import MarkdownViewer from "@/renderer/components/MarkdownViewer";
import { Button } from "@/renderer/components/ui/button";
import SearchComponent from "@/renderer/components/SearchComponent";
import { produce } from "immer";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { TabsSlice } from "@/renderer/types/tab-slice";
import CanvasEditor from "@/renderer/components/CanvasEditor";

import { useKeyboardShortcuts } from "@/renderer/components/hooks/keyboardshortcuts";

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
  const openSidebar = () => setSidebarCollapsed(false);

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
      {/* Title Bar */}
      <div className="app-drag-region flex items-center justify-between h-8 bg-background border-b border-border px-4 flex-shrink-0">
        <div className="text-sm font-semibold text-foreground">LocalNotes</div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Activity rail / fixed; controls the size of the left bar containing the buttons*/}
        <div className="flex flex-col items-center gap-2 px-2 py-4 bg-background w-18 border-r">
          {/* justify-center can be added here to make it vertically centered */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSidebarButtonClick("file")}
              className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
              title="Files"
            >
                      <img src="/assets/file_explorer.png" alt="Files" className="w-16 h-16 object-contain" />
                </button>
                <button 
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSidebarButtonClick("search")}
            className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" 
            title="Search"
          >
                    <img src="/assets/search.png" alt="Search" className="w-16 h-16 object-contain" />
                </button>
                <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Export">
                    <img src="/assets/export.png" alt="Export" className="w-16 h-16 object-contain" />
                </button>
                <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Ai Assistant - Coming Soon">
                    <img src="/assets/ai_helper.png" alt="AI" className="w-16 h-16 object-contain" />
                </button>
                 <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Share with Friends">
                    <img src="/assets/share.png" alt="Share" className="w-16 h-16 object-contain" />
                </button>
                 <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Settings">
                    <img src="/assets/settings.png" alt="Settings" className="w-16 h-16 object-contain" />
                </button>
                 <button className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="File Change History">
                    <img src="/assets/folder.png" alt="Folder" className="w-16 h-16 object-contain" />
                </button>
              </div>

            <ResizablePanelGroup
                direction="horizontal"
                className="min-h-screen w-full bg-secondary"
            >
                 {/* Sidebar (resizable) + Editor */}
                {!sidebarCollapsed ? (
                <>
            <ResizablePanel 
              defaultSize={20} 
              minSize={12}
              maxSize={50}
                    className={`transition-all duration-200 ease-in-out ${
                sidebarCollapsed ? "w-0 overflow-hidden" : "w-full"
              }`}
              style={{ 
                display: sidebarCollapsed ? 'none' : 'block',
                visibility: sidebarCollapsed ? 'hidden' : 'visible'
              }}
            >
                    <SidebarProvider>
                      {/* Use non-fixed variant so the panel controls width; force w-full so Sidebar doesn't enforce its own CSS width variable */}
                      <Sidebar collapsible="none" className="w-full">
                        <SidebarContent className="h-full p-0">
                    <div style={{ display: activeSidebarPanel === 'file' ? 'block' : 'none', height: '100%' }}>
                      <FileSystemTree ref={fileTreeRef} onFileSelect={handleFileSelect} isVisible={activeSidebarPanel === 'file'} autoOpen={true} />
                    </div>
                            {activeSidebarPanel === "search" && <SearchComponent onFileSelect={handleFileSelect} />}
                        </SidebarContent>
                      </Sidebar>
                    </SidebarProvider>
                  </ResizablePanel>
                {!sidebarCollapsed && <ResizableHandle withHandle className="bg-transparent" />}
                </>
                ) : null}
                    <ResizablePanel defaultSize={sidebarCollapsed ? 100 : 75} minSize={60}>
                    <div className="flex h-full flex-col p-6 rounded-3xl bg-secondary">
                        {selectedFile ? (
                            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-semibold text-muted-foreground truncate max-w-[70%]">
                                        {selectedFile}
                                    </div>
                                    {selectedFile.toLowerCase().endsWith(".md") && (
                                        <div className="flex items-center bg-background border border-border rounded-md p-1">
                                            <button
                                                onClick={() => {
                                                    setPreviewMode(false);
                                                    setLivePreview(false);
                                                }}
                                                className={`px-2 py-1 text-xs rounded ${!previewMode && !livePreview ? "bg-accent text-background" : "hover:bg-muted"}`}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPreviewMode(true);
                                                    setLivePreview(false);
                                                }}
                                                className={`px-2 py-1 text-xs rounded ${previewMode && !livePreview ? "bg-accent text-background" : "hover:bg-muted"}`}
                                            >
                                                Preview
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setLivePreview((v) => !v);
                                                    setPreviewMode(true);
                                                }}
                                                className={`px-2 py-1 text-xs rounded ${livePreview ? "bg-accent text-background" : "hover:bg-muted"}`}
                                            >
                                                Live
                                            </button>
                                        </div>
                                    )}
                                    <Button
                                        onClick={handleSave}
                                        className="bg-accent px-4 py-1 rounded-md shadow-neumorph-sm hover:shadow-neumorph-inset"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? "Saving..." : "Save"}
                                    </Button>
                                </div>

                                {/* Editable / Preview area */}
                                <div className="flex-1 w-full bg-background text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border overflow-y-auto">
                                    {selectedFile.toLowerCase().endsWith(".md") ? (
                                        livePreview ? (
                                            <div className="flex h-full gap-4">
                                                <textarea
                                                    key={selectedFile}
                                                    value={fileContent}
                                                    onChange={(e) => {
                                                        setFileContent(e.target.value);
                                                    }}
                                                    className="h-full w-1/2 bg-background text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                                                    spellCheck={false}
                                                    autoFocus
                                                />
                                                <div className="h-full w-1/2 overflow-auto bg-background rounded-lg p-3 border border-border">
                                                    <MarkdownViewer content={fileContent} />
                                                </div>
                                            </div>
                                        ) : previewMode ? (
                                            <div className="h-full overflow-auto">
                                                <MarkdownViewer content={fileContent} />
                                            </div>
                                        ) : (
                                            <textarea
                                                key={selectedFile}
                                                value={fileContent}
                                                onChange={(e) => {
                                                    setFileContent(e.target.value);
                                                }}
                                                className="h-full w-full bg-background text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                                                spellCheck={false}
                                                autoFocus
                                            />
                                        )
                                    ) : selectedFile.toLowerCase().endsWith(".canvas") ? (
                                        <div className="flex flex-col w-full h-full">
                                            {/* Optional: you already have a Save button in the header */}
                                            <div className="flex-1">
                                                <CanvasEditor
                                                    value={fileContent}
                                                    onChange={setFileContent}
                                                    onSave={handleSave}
                                                    isSaving={isSaving}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <textarea
                                            key={selectedFile}
                                            value={fileContent}
                                            onChange={(e) => {
                                                setFileContent(e.target.value);
                                            }}
                                            className="h-full w-full bg-background text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                                            spellCheck={false}
                                            autoFocus
                                        />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <span className="font-semibold text-muted-foreground">
                                    Open a file to start editing
                                </span>
                            </div>
                        )}
                        {saveMessage && (
                            <div className="fixed bottom-6 right-6 bg-accent text-background text-sm px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300 animate-fade-in-out">
                                {saveMessage}
                            </div>
                        )}
                    </div>
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
        className="bg-background border border-border rounded-lg p-6 w-96"
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
        className={`h-5 px-2 text-xs ${
          justAutosaved 
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
    </React.Fragment>
  );
}