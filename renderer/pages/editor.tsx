import React, { useState, useEffect, useRef } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import FileSystemTree from "@/renderer/components/FileSystemTree";

const AUTOSAVE_INTERVAL = 5000;

export default function Editor() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = async (filePath: string) => {
    setSelectedFile(filePath);

    // Load file content using preload API
    const fileData = await window.autosaveAPI.load(filePath);
    setContent(fileData || "");
  };

  // Autosave periodically
  useEffect(() => {
    if (!selectedFile) return;

    const interval = setInterval(() => {
      const current = editorRef.current?.value || content;
      window.autosaveAPI.save(selectedFile, current);
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [selectedFile, content]);

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
                <textarea
                  ref={editorRef}
                  className="flex-1 bg-background rounded-lg p-4 font-mono resize-none focus:outline-none"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Start typing..."
                />
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
