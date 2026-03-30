/**
 * File: editorSpace.tsx
 * Project: LocalNotes
 * Course: EECS 582 Software Engineering Capstone
 *
 * Authors / Contributors:
 * - Malek Kchaou
 * - If you worked on this file besides me, add your name here when you see this.
 *
 * Date Created: 03/2026
 * Last Updated: 03/2026
 *
 * Change Summary:
 * Removed an accidentally duplicated JSX block that appeared after the main
 * return statement and caused a syntax error. Kept the bounded layout chain
 * required for the multi-page canvas editor to scroll correctly.
 */

/**
 * Purpose:
 * This component is the content-area switchboard for the main editor.
 * It decides which editing experience to render based on the selected file type:
 * - markdown editor / preview / live preview
 * - multi-page canvas editor for .canvas files
 * - plain text editor fallback for other file types
 *
 * Why this file matters to the multi-page canvas feature:
 * The canvas editor requires a very specific bounded flex layout to create a real
 * internal scroll viewport. This file became part of the solution because the old
 * wrapper structure allowed the canvas area to expand instead of scroll.
 *
 * Role in the multi-page canvas workflow:
 * - passes file content into CanvasEditor
 * - receives updated serialized canvas content from CanvasEditor
 * - passes through save state and save action
 * - provides the layout container that allows the notebook to scroll properly
 */

import React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/renderer/components/ui/button";
import MarkdownViewer from "@/renderer/components/MarkdownViewer";
import CanvasEditor from "@/renderer/components/CanvasEditor";

const TiptapTextEditor = dynamic(
    () => import("@/renderer/components/TiptapTextEditor"),
    {
        ssr: false,
    }
);

export interface EditorSpaceProps {
    selectedFile: string | null;
    previewMode: boolean;
    livePreview: boolean;
    fileContent: string;
    isSaving: boolean;
    handleSave: () => void;
    setPreviewMode: React.Dispatch<React.SetStateAction<boolean>>;
    setLivePreview: React.Dispatch<React.SetStateAction<boolean>>;
    setFileContent: React.Dispatch<React.SetStateAction<string>>;
    saveMessage: string | null;
}

export default function EditorSpace({ selectedFile, previewMode, livePreview, fileContent, isSaving, handleSave, setPreviewMode, setLivePreview, setFileContent, saveMessage }: EditorSpaceProps) {
  const markdownBaseDir = selectedFile ? window.fs.dirname(selectedFile) : null;
  return (
    <div className="flex h-full flex-col p-3 pr-1 bg-secondary">
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
          <div className="flex-1 w-full bg-secondary  text-foreground rounded-lg p-3 pr-1 font-mono text-sm resize-none focus:outline-none border border-border overflow-hidden">
            {selectedFile.toLowerCase().endsWith(".md") ? (
              livePreview ? (
                <div className="flex h-full gap-4">
                  <textarea
                    key={selectedFile}
                    value={fileContent}
                    onChange={(e) => {
                      setFileContent(e.target.value);
                    }}
                    className="h-[97%] w-1/2 bg-secondary custom-scrollbar  text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                    spellCheck={false}
                    autoFocus
                  />
                  <div className="h-[97%] w-1/2 overflow-auto bg-secondary custom-scrollbar rounded-lg p-3 border border-border">
                    <MarkdownViewer content={fileContent} baseDir={markdownBaseDir} />
                  </div>
                </div>
              ) : previewMode ? (
                <div className="h-[97%]  overflow-auto custom-scrollbar">
                  <MarkdownViewer content={fileContent} baseDir={markdownBaseDir} />
                </div>
              ) : (
                <textarea
                  key={selectedFile}
                  value={fileContent}
                  onChange={(e) => {
                    setFileContent(e.target.value);
                  }}
                  className="h-[97%] w-full custom-scrollbar bg-secondary text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                  spellCheck={false}
                  autoFocus
                />
              )
            ) : selectedFile.toLowerCase().endsWith(".canvas") ? (
              <div className="flex flex-col w-full h-[97%]">
                <div className="flex-1">
                  <CanvasEditor
                    value={fileContent}
                    onChange={setFileContent}
                    onSave={handleSave}
                    isSaving={isSaving}
                  />
                </div>
              </div>
            ) : selectedFile.toLowerCase().endsWith(".txt") ? (
              <div className="h-[97%] w-full">
                <TiptapTextEditor value={fileContent} onChange={setFileContent} />
              </div>
            ) : (
              <textarea
                key={selectedFile}
                value={fileContent}
                onChange={(e) => {
                  setFileContent(e.target.value);
                }}
                className="h-[97%] w-full bg-background text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
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
  );
}
