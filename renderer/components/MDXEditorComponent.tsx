import React from "react";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CodeToggle,
  ListsToggle,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  InsertCodeBlock,
  Separator,
  type MDXEditorMethods,
} from "@mdxeditor/editor";

interface MDXEditorComponentProps {
  markdown: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  previewMode?: boolean;
  livePreview?: boolean;
  onModeChange?: (mode: "edit" | "preview" | "live") => void;
  isMarkdownFile?: boolean;
}

const MDXEditorComponent = React.forwardRef<
  MDXEditorMethods,
  MDXEditorComponentProps
>(
  (
    {
      markdown,
      onChange,
      readOnly = false,
      onSave,
      isSaving,
      previewMode,
      livePreview,
      onModeChange,
      isMarkdownFile,
    },
    ref
  ) => {
    return (
      <div className="mdx-editor-wrapper">
        <MDXEditor
          ref={ref}
          markdown={markdown}
          onChange={onChange}
          readOnly={readOnly}
          plugins={[
            // Core editing plugins
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),

            // Image support
            imagePlugin({
              imageUploadHandler: async (file: File) => {
                // For now, return a data URL. You can implement proper file upload later
                return new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    resolve(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                });
              },
            }),

            // Table support
            tablePlugin(),

            // Code block support with syntax highlighting
            codeBlockPlugin({ defaultCodeBlockLanguage: "js" }),
            codeMirrorPlugin({
              codeBlockLanguages: {
                js: "JavaScript",
                javascript: "JavaScript",
                ts: "TypeScript",
                typescript: "TypeScript",
                tsx: "TypeScript (React)",
                jsx: "JavaScript (React)",
                css: "CSS",
                html: "HTML",
                json: "JSON",
                python: "Python",
                bash: "Bash",
                shell: "Shell",
                markdown: "Markdown",
                md: "Markdown",
                sql: "SQL",
                yaml: "YAML",
                xml: "XML",
                java: "Java",
                cpp: "C++",
                c: "C",
                go: "Go",
                rust: "Rust",
                ruby: "Ruby",
                php: "PHP",
              },
            }),

            // Markdown shortcuts (e.g., ## for headings, - for lists)
            markdownShortcutPlugin(),

            // Toolbar with common formatting options
            toolbarPlugin({
              toolbarContents: () => (
                <div
                  style={{
                    display: "flex",
                    gap: "2px",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "2px",
                      alignItems: "center",
                    }}
                  >
                    <UndoRedo />
                    <Separator />
                    <BlockTypeSelect />
                    <Separator />
                    <BoldItalicUnderlineToggles />
                    <CodeToggle />
                    <Separator />
                    <CreateLink />
                    <InsertImage />
                    <Separator />
                    <ListsToggle />
                    <Separator />
                    <InsertTable />
                    <InsertThematicBreak />
                    <InsertCodeBlock />
                  </div>

                  {/* Mode toggles and Save button */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    {isMarkdownFile && onModeChange && (
                      <div
                        style={{
                          display: "flex",
                          gap: "2px",
                          backgroundColor: "rgb(46, 52, 64)",
                          border: "1px solid rgb(59, 66, 82)",
                          borderRadius: "6px",
                          padding: "2px",
                        }}
                      >
                        <button
                          onClick={() => onModeChange("edit")}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            borderRadius: "4px",
                            backgroundColor:
                              !previewMode && !livePreview
                                ? "rgb(129, 161, 193)"
                                : "transparent",
                            color:
                              !previewMode && !livePreview
                                ? "rgb(46, 52, 64)"
                                : "rgb(236, 239, 244)",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onModeChange("preview")}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            borderRadius: "4px",
                            backgroundColor:
                              previewMode && !livePreview
                                ? "rgb(129, 161, 193)"
                                : "transparent",
                            color:
                              previewMode && !livePreview
                                ? "rgb(46, 52, 64)"
                                : "rgb(236, 239, 244)",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => onModeChange("live")}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            borderRadius: "4px",
                            backgroundColor: livePreview
                              ? "rgb(129, 161, 193)"
                              : "transparent",
                            color: livePreview
                              ? "rgb(46, 52, 64)"
                              : "rgb(236, 239, 244)",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Live
                        </button>
                      </div>
                    )}

                    {onSave && (
                      <button
                        onClick={onSave}
                        disabled={isSaving}
                        style={{
                          backgroundColor: "rgb(129, 161, 193)",
                          color: "rgb(46, 52, 64)",
                          padding: "4px 16px",
                          borderRadius: "6px",
                          border: "none",
                          cursor: isSaving ? "not-allowed" : "pointer",
                          opacity: isSaving ? 0.6 : 1,
                          fontSize: "14px",
                          fontWeight: 500,
                        }}
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              ),
            }),
          ]}
          contentEditableClassName="prose prose-slate dark:prose-invert max-w-none min-h-[500px] p-4 focus:outline-none"
        />
      </div>
    );
  }
);

MDXEditorComponent.displayName = "MDXEditorComponent";

export default MDXEditorComponent;
