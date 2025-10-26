import React, { useState } from "react";
import FileSystemTree from "../components/FileSystemTree";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
} from "../components/ui/sidebar";

export default function Editor() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    // TODO: Load file content into editor
    console.log("Selected file:", filePath);
  };

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Activity rail / fixed */}
      <div className="flex flex-col items-center gap-2 px-2 py-4 bg-muted/10 w-12 border-r">
        <button className="size-10 rounded-md hover:bg-accent p-2" title="Files">📁</button>
        <button className="size-10 rounded-md hover:bg-accent p-2" title="Search">🔍</button>
      </div>

      {/* Sidebar (resizable) + Editor */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 flex">
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

  <ResizableHandle withHandle className="bg-transparent ml-2" />

        <ResizablePanel defaultSize={80} minSize={40}>
          <main className="flex-1 p-6">
            <div className="flex h-full flex-col p-6 rounded-3xl bg-secondary">
              {selectedFile ? (
                <div className="flex flex-col h-full">
                  <div className="text-sm font-semibold mb-2 text-muted-foreground">
                    {selectedFile.split("/").pop()}
                  </div>
                  <div className="flex-1 bg-background rounded-lg p-4">
                    <span className="font-semibold">Text Editor</span>
                    <p className="text-sm text-muted-foreground mt-2">File: {selectedFile}</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="font-semibold text-muted-foreground">Open a file to start editing</span>
                </div>
              )}
            </div>
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
