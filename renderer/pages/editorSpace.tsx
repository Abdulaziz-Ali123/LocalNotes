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
 * Updated the editor content region to support the new multi-page canvas editor
 * alongside existing markdown and plain-text editing modes. This file now provides
 * the bounded layout chain required for the canvas notebook viewport to scroll
 * correctly inside the larger editor shell.
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
import { Button } from "@/renderer/components/ui/button";
import MarkdownViewer from "@/renderer/components/MarkdownViewer";
import CanvasEditor from "@/renderer/components/CanvasEditor";

/**
 * Props for the shared editor content region.
 *
 * This component does not own file state itself.
 * It receives all state and callbacks from the parent editor shell.
 */
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

export default function EditorSpace({
  selectedFile,
  previewMode,
  livePreview,
  fileContent,
  isSaving,
  handleSave,
  setPreviewMode,
  setLivePreview,
  setFileContent,
  saveMessage,
}: EditorSpaceProps) {
  return (
    /**
     * Root editor-space layout.
     *
     * min-h-0 is important here because this component sits inside nested flex
     * containers. Without it, children such as CanvasEditor may grow to content
     * height instead of becoming bounded scroll regions.
     */
    <div className="flex h-full min-h-0 flex-col p-3 pr-1 bg-secondary">
      {selectedFile ? (
        <div className="flex flex-col h-full min-h-0">
          {/* File header section: shows current file name, mode toggles, and save button */}
          <div className="flex-shrink-0 flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-muted-foreground truncate max-w-[70%]">
              {selectedFile}
            </div>

            {/* Markdown-only mode switcher: edit / preview / live split preview */}
            {selectedFile.toLowerCase().endsWith(".md") && (
              <div className="flex items-center bg-background border border-border rounded-md p-1">
                <button
                  onClick={() => {
                    setPreviewMode(false);
                    setLivePreview(false);
                  }}
                  className={`px-2 py-1 text-xs rounded ${
                    !previewMode && !livePreview
                      ? "bg-accent text-background"
                      : "hover:bg-muted"
                  }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setPreviewMode(true);
                    setLivePreview(false);
                  }}
                  className={`px-2 py-1 text-xs rounded ${
                    previewMode && !livePreview
                      ? "bg-accent text-background"
                      : "hover:bg-muted"
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => {
                    setLivePreview((v) => !v);
                    setPreviewMode(true);
                  }}
                  className={`px-2 py-1 text-xs rounded ${
                    livePreview ? "bg-accent text-background" : "hover:bg-muted"
                  }`}
                >
                  Live
                </button>
              </div>
            )}

            {/* Shared save button used by markdown, canvas, and plain text flows */}
            <Button
              onClick={handleSave}
              className="bg-accent px-4 py-1 rounded-md shadow-neumorph-sm hover:shadow-neumorph-inset"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>

          {/* Main editable / preview content region */}
          <div className="flex-1 min-h-0 w-full bg-secondary text-foreground rounded-lg p-3 pr-1 font-mono text-sm border border-border overflow-hidden">
            {selectedFile.toLowerCase().endsWith(".md") ? (
              /**
               * Markdown mode branch
               *
               * Supports:
               * - live side-by-side preview
               * - preview-only mode
               * - plain markdown editing mode
               */
              livePreview ? (
                <div className="flex h-full min-h-0 gap-4">
                  <textarea
                    key={selectedFile}
                    value={fileContent}
                    onChange={(e) => {
                      setFileContent(e.target.value);
                    }}
                    className="h-full w-1/2 bg-secondary custom-scrollbar text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                    spellCheck={false}
                    autoFocus
                  />
                  <div className="h-full w-1/2 overflow-auto bg-secondary custom-scrollbar rounded-lg p-3 border border-border">
                    <MarkdownViewer content={fileContent} />
                  </div>
                </div>
              ) : previewMode ? (
                <div className="h-full overflow-auto custom-scrollbar">
                  <MarkdownViewer content={fileContent} />
                </div>
              ) : (
                <textarea
                  key={selectedFile}
                  value={fileContent}
                  onChange={(e) => {
                    setFileContent(e.target.value);
                  }}
                  className="h-full w-full custom-scrollbar bg-secondary text-foreground rounded-lg p-3 font-mono text-sm resize-none focus:outline-none border border-border"
                  spellCheck={false}
                  autoFocus
                />
              )
            ) : selectedFile.toLowerCase().endsWith(".canvas") ? (
              /**
               * Canvas mode branch
               *
               * This wrapper chain is intentionally structured with:
               * - flex
               * - flex-1
               * - min-h-0
               * - overflow-hidden
               *
               * This layout is what allows the CanvasEditor component to create a true
               * internal notebook viewport with scrolling, rather than expanding to fit
               * all pages at once.
               */
              <div className="flex flex-col w-full h-full min-h-0">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <CanvasEditor
                    value={fileContent}
                    onChange={setFileContent}
                    onSave={handleSave}
                    isSaving={isSaving}
                  />
                </div>
              </div>
            ) : (
              /**
               * Plain text fallback branch
               *
               * Used for non-markdown, non-canvas file types.
               */
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
        /**
         * Empty-state view shown when no file is currently open.
         */
        <div className="flex h-full min-h-0 items-center justify-center">
          <span className="font-semibold text-muted-foreground">
            Open a file to start editing
          </span>
        </div>
      )}

      {/* Temporary save feedback toast shown after manual save operations */}
      {saveMessage && (
        <div className="fixed bottom-6 right-6 bg-accent text-background text-sm px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300 animate-fade-in-out">
          {saveMessage}
        </div>
      )}
    </div>
  );
}
