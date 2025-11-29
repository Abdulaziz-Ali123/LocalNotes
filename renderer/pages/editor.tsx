import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  useSidebar,
} from "../components/ui/sidebar";
import React, { useEffect, useState, useRef } from "react";
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
import CanvasEditor from "@/renderer/components/CanvasEditor";

const AUTOSAVE_INTERVAL = 5000;

export default function Editor() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<boolean>(true);
  const [livePreview, setLivePreview] = useState<boolean>(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportToNoteModal, setShowImportToNoteModal] = useState<{ visible: boolean; importFiles: string[]; }>({ visible: false, importFiles: [] });
  const [availableNotes, setAvailableNotes] = useState<string[]>([]);
  const [selectedTargetNote, setSelectedTargetNote] = useState<string>("");
  const initializeTabs = useBoundStore((state) => state.tabs.initialize);

    // Add this ref at the top with your other state
    const exportMenuRef = useRef<HTMLDivElement>(null);

    // Add this useEffect
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };

        if (showExportMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showExportMenu]);

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
                    tab.fileType = result.type; // 'text' or 'binary'
                    tab.mimeType = result.mimeType; // For images
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

   const handleImportFiles = async () => {
        const result = await window.fs.selectImportFiles(); // new IPC
        if (!result.success || result.paths.length === 0) return;

        const targetRoot = localStorage.getItem("currentFolderPath");

        for (const filePath of result.paths) {
            const fileName = window.fs.basename(filePath);
            const destPath = window.fs.join(targetRoot, fileName);
            await window.fs.copyFile(filePath, destPath);
        }

        alert("File(s) imported successfully");
        window.location.reload();
   };

  const handleImportFolder = async () => {
        const importResult = await window.fs.openFolderDialog();
        if (!importResult.success || !importResult.data) return;

        const importFolder = importResult.data;
        const targetRoot = localStorage.getItem("currentFolderPath");

        if (!targetRoot) {
            alert("No project folder is currently open.");
            return;
        }

        const copyResult = await window.fs.importFolder(importFolder, targetRoot);

        if (copyResult.success) {
            alert("Notes imported successfully!");
            window.location.reload(); // Reload tree
        } else {
            alert(`Import failed: ${copyResult.error}`);
        }
    };

    const getAllSupportedNotes = async (folderPath: string): Promise<string[]> => {
        const result = await window.fs.readDirectory(folderPath);
        if (!result.success) return [];

        const files: string[] = [];
        const supportedExtensions = [".md", ".txt", ".pdf", ".docx"];

        for (const item of result.data) {
            if (item.isDirectory) {
                const subFiles = await getAllSupportedNotes(item.path);
                files.push(...subFiles);
            } else {
                const lower = item.name.toLowerCase();
                if (supportedExtensions.some((ext) => lower.endsWith(ext))) {
                    files.push(item.path);
                }
            }
        }

        return files;
    };


    const handleImportIntoExistingNote = async () => {
        const result = await window.fs.selectImportFiles();
        if (!result.success) return;

        const importFiles = result.paths;

        const root = localStorage.getItem("currentFolderPath");
        const noteFiles = await getAllSupportedNotes(root);

        setAvailableNotes(noteFiles);
        setSelectedTargetNote(noteFiles[0] ?? "");
        setShowImportToNoteModal({ visible: true, importFiles });
    };


    const handleConfirmMerge = async () => {
        if (showImportToNoteModal.importFiles.length === 0) {
            alert("No files selected to import.");
            return;
        }

        if (!selectedTargetNote) {
            alert("Please select a target note.");
            return;
        }

        const targetRoot = localStorage.getItem("currentFolderPath");

        // First, copy all the files to the workspace
        const copiedFiles: string[] = [];
        for (const filePath of showImportToNoteModal.importFiles) {
            const fileName = window.fs.basename(filePath);
            const destPath = window.fs.join(targetRoot, fileName);

            await window.fs.copyFile(filePath, destPath);
            copiedFiles.push(fileName); // Store just the filename, not full path
        }

        // Then merge with the relative filenames
        await window.fs.mergeFiles(
            copiedFiles, // Use the new filenames instead of original paths
            selectedTargetNote
        );

        alert("Imported into note successfully.");

        // If editor has this note open, reload content
        if (selectedFile === selectedTargetNote) {
            const content = await window.fs.readFile(selectedTargetNote);
            setFileContent(content.data);
        }

        setShowImportToNoteModal({ visible: false, importFiles: [] });
    };

    const handleExportCurrentFile = async () => {
        if (!selectedFile) {
            alert("No file selected to export.");
            return;
        }

        const result = await window.fs.selectExportDestination();
        if (!result.success) return;

        const exportResult = await window.fs.exportFile(
            selectedFile,
            result.folder
        );

        if (exportResult.success) {
            refreshTree();
            alert(`File exported to ${exportResult.exportedTo}`);
        } else {
            alert("Export failed: " + exportResult.error);
        }
    };

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

    const fileTreeRef = useRef(null);

    const refreshTree = () => {
        if (fileTreeRef.current && fileTreeRef.current.reloadRoot) {
            fileTreeRef.current.reloadRoot();
        }
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
                <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="size-12 rounded-md hover:bg-accent p-0.5 flex items-center justify-center" 
                title="Export / Import">
                    <img src="/assets/export.png" alt="Export" className="w-16 h-16 object-contain" />
                  </button>
                  {showExportMenu && (
                      <div ref={exportMenuRef}  className="absolute left-20 top-24 bg-background border rounded-md shadow-md p-2 z-50 w-40">
                          <button onClick={handleImportFiles}>Import File(s)</button>
                          <button onClick={handleImportFolder}>Import Folder</button>
                          <button onClick={handleImportIntoExistingNote}>Import into Existing Note</button>
                          <button onClick={handleExportCurrentFile}>Export Current File</button>
                          <button onClick={handleExportFolder}>Export Workspace</button>
                      </div>
                  )}

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
                                                  {activeSidebarPanel === "file" && <FileSystemTree ref={refreshTree} onFileSelect={handleFileSelect} isVisible={!sidebarCollapsed} autoOpen={true} />}
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
                                  <div className="flex-1 w-full bg-background text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border">
                                      {selectedFile.toLowerCase().match(/\.(png|jpg|jpeg|gif|bmp|svg|webp|ico)$/) ? (
                                          // Display image
                                          <div className="flex items-center justify-center h-full">
                                              <img
                                                  src={`data:${selectedTab?.mimeType || 'image/png'};base64,${fileContent}`}  // Add curly braces
                                                  alt={window.fs.basename(selectedFile)}
                                                  className="max-w-full max-h-full object-contain"
                                              />
                                          </div>
                                      ) : selectedFile.toLowerCase().endsWith(".md") ? (
                                          // Existing markdown logic
                                          livePreview ? (
                                              <div className="flex h-full gap-4">
                                                  {/* ... your existing markdown live preview code ... */}
                                              </div>
                                          ) : previewMode ? (
                                              <div className="h-full overflow-y-auto">
                                                  <MarkdownViewer content={fileContent} />
                                              </div>
                                          ) : (
                                              <textarea
                                                  key={selectedFile}
                                                  value={fileContent}
                                                  onChange={(e) => setFileContent(e.target.value)}
                                                  className="h-full w-full bg-background text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                                                  spellCheck={false}
                                                  autoFocus
                                              />
                                          )
                                      ) : selectedFile.toLowerCase().endsWith(".canvas") ? (
                                          // Existing canvas logic
                                          <div className="flex flex-col w-full h-full">
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
                                          // Text editor for other files
                                          <textarea
                                              key={selectedFile}
                                              value={fileContent}
                                              onChange={(e) => setFileContent(e.target.value)}
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

          {showImportToNoteModal.visible && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-background border rounded-lg p-4 w-96">

                      <h2 className="font-semibold mb-2 text-lg">
                          Import into existing note
                      </h2>

                      <label className="block text-sm mb-1">Choose note:</label>
                      <select
                          className="w-full border p-2 rounded mb-4"
                          value={selectedTargetNote}
                          onChange={(e) => setSelectedTargetNote(e.target.value)}
                      >
                          {availableNotes.map((path) => (
                              <option key={path} value={path}>
                                  {path.split("/").pop()}
                              </option>
                          ))}
                      </select>

                      <div className="flex justify-end gap-2">
                          <button
                              onClick={() => setShowImportToNoteModal({ visible: false, importFiles: [] })}
                              className="px-3 py-1 border rounded"
                          >
                              Cancel
                          </button>

                          <button
                              onClick={handleConfirmMerge}
                              className="px-3 py-1 bg-accent text-background rounded"
                          >
                              Import
                          </button>
                      </div>
                  </div>
              </div>
          )}
    </React.Fragment>
  );
}
