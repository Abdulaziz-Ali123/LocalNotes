import React, { useRef } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/renderer/components/ui/resizable";
import FileSystemTree from "@/renderer/components/FileSystemTree";
import MarkdownViewer from "@/renderer/components/MarkdownViewer";
import MDXEditorComponent from "@/renderer/components/MDXEditorComponent";
import { Button } from "@/renderer/components/ui/button";
import { X } from "lucide-react";
import TabBar from "@/renderer/components/TabBar";
import { SidebarProvider, Sidebar, SidebarContent } from "../components/ui/sidebar";
import CanvasEditor from "@/renderer/components/CanvasEditor";

export default function EditorSpace({
  handleFileSelect,
  selectedFile,
  handleSave,
  isSaving,
  setPreviewMode,
  setLivePreview,
  previewMode,
  livePreview,
  fileContent,
  setFileContent,
  saveMessage,
}) {
  return (
    <React.Fragment>
      <ResizablePanelGroup direction="horizontal" className="min-h-screen w-full bg-secondary">
        {/* Sidebar (resizable) + Editor */}

        <ResizablePanel defaultSize={25} minSize={20} className="bg-background">
          <div className="flex flex-col">
            <div className="h-10 ml-6 app-drag-region"></div>

            <div className="">
              <SidebarProvider>
                {/* Use non-fixed variant so the panel controls width; force w-full so Sidebar doesn't enforce its own CSS width variable */}
                <Sidebar collapsible="none" className="w-full">
                  <SidebarContent className="h-full p-0">
                    <FileSystemTree onFileSelect={handleFileSelect} />
                  </SidebarContent>
                </Sidebar>
              </SidebarProvider>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle className="w-0 hover:bg-accent hover:w-1 active:bg-accent active:w-1" />
        <ResizablePanel defaultSize={75} minSize={50}>
          <div className="flex flex-col h-[98%]">
            <TabBar />
            <div className="flex flex-col h-full p-6 rounded-t-lg bg-secondary">
              {selectedFile ? (
                <div className="flex flex-col h-full">
                  {/* Mode toggle buttons - always visible for markdown files */}
                  {selectedFile.toLowerCase().endsWith(".md") && (
                    <div className="flex items-center justify-end mb-2 px-2">
                      <div className="flex items-center bg-background border border-border rounded-md p-1">
                        <button
                          onClick={() => {
                            setPreviewMode(false);
                            setLivePreview(false);
                          }}
                          className={`px-2 py-1 text-xs rounded ${!previewMode && !livePreview ? "bg-accent text-background" : "text-foreground hover:bg-muted"}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setPreviewMode(true);
                            setLivePreview(false);
                          }}
                          className={`px-2 py-1 text-xs rounded ${previewMode && !livePreview ? "bg-accent text-background" : "text-foreground hover:bg-muted"}`}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => {
                            setLivePreview((v) => !v);
                            setPreviewMode(true);
                          }}
                          className={`px-2 py-1 text-xs rounded ${livePreview ? "bg-accent text-background" : "text-foreground hover:bg-muted"}`}
                        >
                          Live
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Editable / Preview area */}
                  <div className="h-full flex w-full text-foreground rounded-lg overflow-auto">
                    {selectedFile.toLowerCase().endsWith(".md") ? (
                      livePreview ? (
                        <div className="flex flex-col h-full w-full">
                          <div className="flex flex-row h-full gap-4 w-full">
                            <div className="w-1/2 bg-background rounded-lg border border-border flex flex-col overflow-hidden">
                              <MDXEditorComponent
                                key={selectedFile}
                                markdown={fileContent}
                                onChange={setFileContent}
                                onSave={handleSave}
                                isSaving={isSaving}
                                previewMode={previewMode}
                                livePreview={livePreview}
                                onModeChange={(mode) => {
                                  if (mode === "edit") {
                                    setPreviewMode(false);
                                    setLivePreview(false);
                                  } else if (mode === "preview") {
                                    setPreviewMode(true);
                                    setLivePreview(false);
                                  } else if (mode === "live") {
                                    setPreviewMode(true);
                                    setLivePreview(true);
                                  }
                                }}
                                isMarkdownFile={true}
                                showModeButtons={false}
                              />
                            </div>
                            <div className="h-full w-1/2 overflow-scroll bg-background rounded-lg p-3 border border-border">
                              <MarkdownViewer content={fileContent} />
                            </div>
                          </div>
                        </div>
                      ) : previewMode ? (
                        <div className="flex h-full gap-4 overflow-auto w-full p-3">
                          <MarkdownViewer content={fileContent} />
                        </div>
                      ) : (
                        <div className="w-full bg-background rounded-lg border border-border">
                          <MDXEditorComponent
                            key={selectedFile}
                            markdown={fileContent}
                            onChange={setFileContent}
                            onSave={handleSave}
                            isSaving={isSaving}
                            previewMode={previewMode}
                            livePreview={livePreview}
                            onModeChange={(mode) => {
                              if (mode === "edit") {
                                setPreviewMode(false);
                                setLivePreview(false);
                              } else if (mode === "preview") {
                                setPreviewMode(true);
                                setLivePreview(false);
                              } else if (mode === "live") {
                                setPreviewMode(true);
                                setLivePreview(true);
                              }
                            }}
                            isMarkdownFile={true}
                            showModeButtons={false}
                          />
                        </div>
                      )
                    ) : selectedFile.toLowerCase().endsWith(".canvas") ? (
                      <div className="flex flex-col w-full h-full">
                        <div className="flex justify-end mb-2 px-2">
                          <Button
                            onClick={handleSave}
                            className="bg-accent px-4 py-1 rounded-md shadow-neumorph-sm hover:shadow-neumorph-inset"
                            disabled={isSaving}
                          >
                            Save
                          </Button>
                        </div>
                        <div className="flex-1">
                          {/* Canvas drawing editor */}
                          <CanvasEditor
                            value={fileContent}
                            onChange={setFileContent}
                            onSave={handleSave}
                            isSaving={isSaving}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col w-full h-full">
                        <div className="flex justify-end mb-2 px-2">
                          <Button
                            onClick={handleSave}
                            className="bg-accent px-4 py-1 rounded-md shadow-neumorph-sm hover:shadow-neumorph-inset"
                            disabled={isSaving}
                          >
                            Save
                          </Button>
                        </div>
                        <textarea
                          key={selectedFile}
                          value={fileContent}
                          onChange={(e) => {
                            setFileContent(e.target.value);
                          }}
                          className="flex-1 w-full bg-background text-foreground rounded-lg p-3 font-mono text-md resize-none focus:outline-none border border-border"
                          spellCheck={false}
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <span className="font-semibold text-muted-foreground">
                    Open a file to start editing
                  </span>
                </div>
              )}
              {saveMessage && (
                <div className="fixed bottom-6 right-6 bg-accent text-background text-md px-4 py-2 rounded-lg shadow-lg transition-opacity duration-300 animate-fade-in-out">
                  {saveMessage}
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </React.Fragment>
  );
}
