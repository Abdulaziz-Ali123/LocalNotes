import React, { useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import FileSystemTree from "@/renderer/components/FileSystemTree";

export default function Editor() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    // TODO: Load file content into editor
    console.log("Selected file:", filePath);
  };

  return (
    <React.Fragment>
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-screen w-full bg-sidebar"
      >
        <ResizablePanel defaultSize={25} minSize={15}>
          <FileSystemTree onFileSelect={handleFileSelect} />
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-transparent" />
        <ResizablePanel defaultSize={75} minSize={60}>
          <div className="flex h-full flex-col p-6 rounded-3xl bg-secondary">
            {selectedFile ? (
              <div className="flex flex-col h-full">
                <div className="text-sm font-semibold mb-2 text-muted-foreground">
                  {selectedFile.split("/").pop()}
                </div>
                <div className="flex-1 bg-background rounded-lg p-4">
                  <span className="font-semibold">Text Editor</span>
                  <p className="text-sm text-muted-foreground mt-2">
                    File: {selectedFile}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="font-semibold text-muted-foreground">
                  Open a file to start editing
                </span>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </React.Fragment>
  );
}
