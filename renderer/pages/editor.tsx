import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
} from "../components/ui/sidebar";
import React, { useEffect, useState } from "react";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import FileSystemTree from "@/renderer/components/FileSystemTree";
import { Button } from "../components/ui/button";
import { error } from "console";

export default function Editor() {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string>("");
    const [saveMessage, setSaveMessage] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // Handle file selction from tree
    const handleFileSelect = (filePath: string) => {
        setSelectedFile(filePath);
        // TODO: Load file content into editor
        setSelectedFile(filePath);
    };

    // Load file content when selected file changes
    useEffect(() => {
        const loadFile = async () => {
            if (!selectedFile) return;
            const result = await window.fs.readFile(selectedFile);
            if (result.success) {
                setFileContent(result.data);
            } else {
                console.error("Failed to read file:", result.error);
                setFileContent("");
            }
        };
        loadFile();
        console.log("Selected file changed:", selectedFile);
    }, [selectedFile]);

    // Hande save action
    const handleSave = async () => {
        if (!selectedFile) return;
        setIsSaving(true);
        const result = await window.fs.writeFile(selectedFile, fileContent);
        setIsSaving(false);

        if (result.success) {
            const fileName = window.fs.basename(selectedFile);
            setSaveMessage(`Saved "${fileName}"`);
            setTimeout(() => setSaveMessage(""), 2000);
        } else {
            setSaveMessage(`Failed to save: ${result.error}`);
            setTimeout(() => setSaveMessage(""), 3000);
        }
    };
    
    return (
        <React.Fragment>
            <div className="flex flex-row">
              {/* Activity rail / fixed */}
              <div className="flex flex-col items-center gap-2 px-2 py-4 bg-background w-12 border-r">
                <button className="size-10 rounded-md hover:bg-accent p-2" title="Files">📁</button>
                <button className="size-10 rounded-md hover:bg-accent p-2" title="Search">🔍</button>
              </div>
            <ResizablePanelGroup
                direction="horizontal"
                className="min-h-screen w-full bg-secondary"
            >
                 {/* Sidebar (resizable) + Editor */}

                  <ResizablePanel defaultSize={20} minSize={12}>
                    <SidebarProvider>
                      {/* Use non-fixed variant so the panel controls width; force w-full so Sidebar doesn't enforce its own CSS width variable */}
                      <Sidebar collapsible="none" className="w-full">
                        <SidebarContent className="h-full p-0">
                          <FileSystemTree onFileSelect={handleFileSelect} />
                        </SidebarContent>
                      </Sidebar>
                    </SidebarProvider>
                  </ResizablePanel>
                <ResizableHandle withHandle className="bg-transparent" />
                <ResizablePanel defaultSize={75} minSize={60}>
                    <div className="flex h-full flex-col p-6 rounded-3xl bg-secondary">
                        {selectedFile ? (
                            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-semibold text-muted-foreground truncate max-w-[70%]">
                                        {selectedFile}
                                    </div>
                                    <Button
                                        onClick={handleSave}
                                        className="bg-accent px-4 py-1 rounded-md shadow-neumorph-sm hover:shadow-neumorph-inset"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? "Saving..." : "Save"}
                                    </Button>
                                </div>

                                {/* Editable area */}
                                <textarea
                                    key={selectedFile}
                                    value={fileContent}
                                    onChange={(e) => {
                                        console.log("Typing: ", e.target.value.slice(-1));
                                        setFileContent(e.target.value);
                                    }}
                                    className="flex-1 w-full bg-background text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                                    spellCheck={false}
                                    autoFocus
                                />
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
