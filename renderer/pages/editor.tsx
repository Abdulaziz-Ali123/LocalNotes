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
import MarkdownViewer from "@/renderer/components/MarkdownViewer";
import { Button } from "../components/ui/button";
import SearchComponent from "@/renderer/components/SearchComponent";
import { produce } from "immer";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { TabsSlice } from "@/renderer/types/tab-slice";
import { useTheme } from "@/renderer/lib/theme";
import CanvasEditor from "@/renderer/components/CanvasEditor";

const AUTOSAVE_INTERVAL = 5000;

export default function Editor() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<boolean>(true);
  const [livePreview, setLivePreview] = useState<boolean>(false);
  const { theme, setTheme } = useTheme();
  const themeIcon = theme === "nord" ? "/assets/theme.png" : theme === "light" ? "/assets/theme.png" : "/assets/theme.png";

  const initializeTabs = useBoundStore((state) => state.tabs.initialize);

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

  // Load file content when selected file changes

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

  // Hande save action
  const handleSave = async () => {
    const selectedTabId = useBoundStore.getState().tabs.selectedTabId;
    const tabState = useBoundStore.getState().tabs;
    const filePath = selectedTab?.filePath || null;

    if (!filePath) return;

    setIsSaving(true);
    const result = await window.fs.writeFile(filePath, fileContent);
    setIsSaving(false);

    if (result.success) {
      // Update tab content after successful save
      const fileName = window.fs.basename(filePath);
      setSaveMessage(`Saved "${fileName}"`);
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

    const interval = setInterval(() => {
      window.autosaveAPI.save(selectedFile, fileContent);
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [selectedFile, fileContent]);

  useEffect(() => {
    const unsubscribe = window.ipc.on("fs:itemDeleted", (deletedPath: string) => {
      if (deletedPath === selectedFile) {
        setSelectedFile(null);
        setFileContent("");
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedFile]);

  const toggleTheme = () => {
    if (theme === "nord") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("nord");
  };

  return (
    <React.Fragment>
      <div className="flex flex-row">
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
                className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" title="Search">
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
                <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleTheme}
            className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center"
            title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
          >
            <img src={themeIcon} alt="Theme" className="w-16 h-16 object-contain" />
          </button>
              </div>
            <ResizablePanelGroup
                direction="horizontal"
                className="min-h-screen w-full bg-secondary"
            >
                 {/* Sidebar (resizable) + Editor */}
                {!sidebarCollapsed ? (
                <>
                  <ResizablePanel defaultSize={20} minSize={12}
                    className={`transition-all duration-200 ease-in-out ${
                    sidebarCollapsed ? "w-0 max-w-0 overflow-hidden" : "w-full"
                    }`}>
                    <SidebarProvider>
                      {/* Use non-fixed variant so the panel controls width; force w-full so Sidebar doesn't enforce its own CSS width variable */}
                      <Sidebar collapsible="none" className="w-full">
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
    </React.Fragment>
  );
}
