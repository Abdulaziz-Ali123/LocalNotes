/*
Brief description:
- `TiptapTextEditor` renders a rich-text editor for `.txt` content using Tiptap.
- It normalizes plain text to HTML, supports formatting (bold/italic/underline/code),
  font family/size, text color, highlight, symbol insertion, and table insertion/editing.
- On every editor change, it emits the current HTML through `onChange`.

• Programmer’s name: Wesley McDougal
• Date the code was created: 12MAR2026
• Dates the code was revised: 12MAR2026

• Brief description of each revision & author:
    Wesley McDougal - 12MAR2026 - Initial implementation of TiptapTextEditor component with rich text editing features,
    including font family and size selection, text color and highlight color pickers, quick symbol insertion,
    and table insertion with dynamic row and column configuration.

Preconditions:
- `value` must be a string (plain text or HTML).
- `onChange` must be a callable function provided by the parent.
- Component is expected to run in a browser/renderer environment (not server-only),
  because it uses DOM events and Tiptap editor lifecycle.

Acceptable and unacceptable inputs:
- Acceptable: `value` as empty string, plain text, or valid/partial HTML.
  Meaning: initial editor content to display and edit.
- Acceptable: `onChange(nextValue: string)` callback.
  Meaning: receives editor output as HTML.
- Unacceptable: non-string `value` (number/object/null/undefined).
  Meaning: can cause runtime or typing issues in normalization/editor content setup.
- Unacceptable: missing/non-function `onChange`.
  Meaning: content updates cannot propagate to parent state.

Postconditions:
- Editor UI is rendered with configured toolbar controls.
- Internal editor state is synchronized with incoming `value` when it changes.
- Parent callback is invoked with updated HTML whenever content changes.
- Table/symbol/font/color commands update editor document when valid actions are triggered.

Return values/types:
- React function component return type: `JSX.Element`.
- Returns either:
  1) a placeholder bordered container while editor instance is initializing, or
  2) full editor + toolbar once initialized.

Error/exception conditions:
- No explicit `throw` statements are defined in this component.
- Potential runtime errors can still occur from third-party editor/extension internals,
  invalid DOM environment usage, or incorrect prop types passed by caller.

Side effects:
- Registers/removes a document-level `mousedown` listener to close insert menu.
- Mutates editor content via Tiptap commands in response to user actions.
- Calls `onChange` as user edits (external state mutation in parent).

Invariants:
- `onChange` output is always HTML string from `editor.getHTML()`.
- Font-size styling is represented through `textStyle` mark attributes.
- Insert menu closes when clicking outside or after insert actions.
- Table insertion is bounded to max 20 rows and 12 columns.

Any known faults:
  - 12MAR2026 - None at this time
 * Git-history contributors: Wesley McDougal
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";

interface TiptapTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const FONT_FAMILIES = [
  "Inter",
  "JetBrains Mono",
  "Georgia",
  "Times New Roman",
  "Arial",
  "Verdana",
  "Courier New",
];

const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px", "64px"];

const QUICK_SYMBOLS = [
  "•",
  "✓",
  "★",
  "©",
  "™",
  "∞",
  "π",
  "√",
  "≈",
  "≤",
  "≥",
  "±",
  "€",
  "£",
  "¥",
  "§",
  "¶",
  "⟵",
  "⟶",
  "⟷",
  "↑",
  "↓",
  "↔",
  "↕",
  "↖",
  "↗",
  "↘",
  "↙",
  "⇐",
  "⇒",
  "⇑",
  "⇓",
  "⇔",
  "⇕",
  "⟸",
  "⟹",
  "⟺",
  "↩",
  "↪",
  "↺",
  "↻",
];

const FontSize = Extension.create({
  name: "fontSize",

    /**
   * Functionality: addGlobalAttributes performs the add global attributes workflow used by renderer/components/TiptapTextEditor.tsx.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call addGlobalAttributes from the owning module or component when this behavior is required.
   */
addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }

              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

/**
 * Functionality: escapeHtml performs the escape html workflow used by renderer/components/TiptapTextEditor.tsx.
 * Parameters: input (string).
 * Returns: Returns string.
 * Usage: Call escapeHtml from the owning module or component when this behavior is required.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Functionality: normalizeToHtml performs the normalize to html workflow used by renderer/components/TiptapTextEditor.tsx.
 * Parameters: content (string).
 * Returns: Returns string.
 * Usage: Call normalizeToHtml from the owning module or component when this behavior is required.
 */
function normalizeToHtml(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return "<p></p>";
  }

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  if (looksLikeHtml) {
    return content;
  }

  const blocks = content.split(/\n{2,}/g);
  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/**
 * Functionality: TiptapTextEditor performs the tiptap text editor workflow used by renderer/components/TiptapTextEditor.tsx.
 * Parameters: { value, onChange } (TiptapTextEditorProps).
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call TiptapTextEditor from the owning module or component when this behavior is required.
 */
export default function TiptapTextEditor({ value, onChange }: TiptapTextEditorProps) {
  const normalizedContent = useMemo(() => normalizeToHtml(value), [value]);
  const [textColor, setTextColor] = useState("#111827");
  const [highlightColor, setHighlightColor] = useState("#fde047");
  const [symbolValue, setSymbolValue] = useState("");
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const insertMenuRef = useRef<HTMLDivElement | null>(null);
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      Color,
      FontFamily,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight.configure({ multicolor: true }),
    ],
    content: normalizedContent,
    onUpdate: ({ editor: editorInstance }) => {
      onChange(editorInstance.getHTML());
    },
    onSelectionUpdate: ({ editor: editorInstance }) => {
      const { from, to } = editorInstance.state.selection;
      lastSelectionRef.current = { from, to };
    },
    editorProps: {
      attributes: {
        class: "tiptap-content",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = editor.getHTML();
    if (current !== normalizedContent) {
      editor.commands.setContent(normalizedContent, false);
    }
  }, [editor, normalizedContent]);

  useEffect(() => {
        /**
     * Functionality: handleDocumentMouseDown performs the handle document mouse down workflow used by renderer/components/TiptapTextEditor.tsx.
     * Parameters: event (MouseEvent).
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call handleDocumentMouseDown from the owning module or component when this behavior is required.
     */
const handleDocumentMouseDown = (event: MouseEvent) => {
      if (!insertMenuRef.current) {
        return;
      }

      if (!insertMenuRef.current.contains(event.target as Node)) {
        setInsertMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, []);

  if (!editor) {
    return <div className="h-full rounded-md border border-border bg-background" />;
  }

  const currentFamily = editor.getAttributes("textStyle").fontFamily ?? "";
  const currentSize = editor.getAttributes("textStyle").fontSize ?? "16px";

    /**
   * Functionality: applyFontSize performs the apply font size workflow used by renderer/components/TiptapTextEditor.tsx.
   * Parameters: size (string).
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call applyFontSize from the owning module or component when this behavior is required.
   */
const applyFontSize = (size: string) => {
    const selection = lastSelectionRef.current;
    const baseChain = editor.chain().focus();

    if (selection) {
      baseChain.setTextSelection(selection);
    }

    if (size) {
      baseChain.setMark("textStyle", { fontSize: size }).run();
    } else {
      baseChain.setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
    }
  };

    /**
   * Functionality: insertTable performs the insert table workflow used by renderer/components/TiptapTextEditor.tsx.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call insertTable from the owning module or component when this behavior is required.
   */
const insertTable = () => {
    const rows = Number.parseInt(tableRows, 10);
    const cols = Number.parseInt(tableCols, 10);

    if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows < 1 || cols < 1) {
      return;
    }

    editor
      .chain()
      .focus()
      .insertTable({ rows: Math.min(rows, 20), cols: Math.min(cols, 12), withHeaderRow: true })
      .run();
    setInsertMenuOpen(false);
  };

    /**
   * Functionality: insertSymbol performs the insert symbol workflow used by renderer/components/TiptapTextEditor.tsx.
   * Parameters: symbol (string).
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call insertSymbol from the owning module or component when this behavior is required.
   */
const insertSymbol = (symbol: string) => {
    if (!symbol) {
      return;
    }

    editor.chain().focus().insertContent(symbol).run();
    setInsertMenuOpen(false);
  };

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-background">
      <div className="tiptap-toolbar">
        <button
          type="button"
          className={`tiptap-btn ${editor.isActive("bold") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </button>
        <button
          type="button"
          className={`tiptap-btn ${editor.isActive("italic") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </button>
        <button
          type="button"
          className={`tiptap-btn ${editor.isActive("underline") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          U
        </button>
        <button
          type="button"
          className={`tiptap-btn ${editor.isActive("codeBlock") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          Code Block
        </button>

        <span className="tiptap-divider" />
        <span className="tiptap-group-title">Font</span>
        <select
          id="font-family-select"
          className="tiptap-select"
          value={currentFamily}
          onChange={(e) => {
            const family = e.target.value;
            if (family) {
              editor.chain().focus().setFontFamily(family).run();
            } else {
              editor.chain().focus().unsetFontFamily().run();
            }
          }}
        >
          <option value="">Default</option>
          {FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
        <select
          id="font-size-select"
          className="tiptap-select"
          value={currentSize}
          onChange={(e) => {
            applyFontSize(e.target.value);
          }}
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <span className="tiptap-divider" />
        <label className="tiptap-label" htmlFor="text-color-picker">
          Text
        </label>
        <input
          id="text-color-picker"
          type="color"
          className="tiptap-color"
          value={textColor}
          onChange={(e) => {
            const color = e.target.value;
            setTextColor(color);
            editor.chain().focus().setColor(color).run();
          }}
          title="Text color"
        />

        <label className="tiptap-label" htmlFor="highlight-color-picker">
          Highlight
        </label>
        <input
          id="highlight-color-picker"
          type="color"
          className="tiptap-color"
          value={highlightColor}
          onChange={(e) => {
            const color = e.target.value;
            setHighlightColor(color);
            editor.chain().focus().setHighlight({ color }).run();
          }}
          title="Highlight color"
        />
        <button
          type="button"
          className={`tiptap-btn ${editor.isActive("highlight") ? "active" : ""}`}
          onClick={() => {
            if (editor.isActive("highlight")) {
              editor.chain().focus().unsetHighlight().run();
            } else {
              editor.chain().focus().setHighlight({ color: highlightColor }).run();
            }
          }}
        >
          Toggle Highlight
        </button>

        <span className="tiptap-divider" />
        <select
          className="tiptap-select"
          value={symbolValue}
          onChange={(e) => {
            const symbol = e.target.value;
            setSymbolValue("");
            insertSymbol(symbol);
          }}
        >
          <option value="">Insert Symbol</option>
          {QUICK_SYMBOLS.map((symbol) => (
            <option key={symbol} value={symbol}>
              {symbol}
            </option>
          ))}
        </select>

        <div className="tiptap-dropdown" ref={insertMenuRef}>
          <button
            type="button"
            className={`tiptap-btn ${insertMenuOpen ? "active" : ""}`}
            onClick={() => setInsertMenuOpen((prev) => !prev)}
          >
            Insert Table
          </button>

          {insertMenuOpen && (
            <div className="tiptap-dropdown-panel">
              <div className="tiptap-dropdown-section">
                <span className="tiptap-dropdown-label">Table</span>
                <div className="tiptap-dropdown-row">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="tiptap-select"
                    value={tableRows}
                    onChange={(e) => setTableRows(e.target.value)}
                    title="Table rows"
                  />
                  <input
                    type="number"
                    min={1}
                    max={12}
                    className="tiptap-select"
                    value={tableCols}
                    onChange={(e) => setTableCols(e.target.value)}
                    title="Table columns"
                  />
                  <button type="button" className="tiptap-btn" onClick={insertTable}>
                    Insert Table
                  </button>
                </div>
                <div className="tiptap-dropdown-row">
                  <button
                    type="button"
                    className="tiptap-btn"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    disabled={!editor.isActive("table")}
                  >
                    + Row
                  </button>
                  <button
                    type="button"
                    className="tiptap-btn"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    disabled={!editor.isActive("table")}
                  >
                    + Col
                  </button>
                  <button
                    type="button"
                    className="tiptap-btn"
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    disabled={!editor.isActive("table")}
                  >
                    - Row
                  </button>
                  <button
                    type="button"
                    className="tiptap-btn"
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    disabled={!editor.isActive("table")}
                  >
                    - Col
                  </button>
                  <button
                    type="button"
                    className="tiptap-btn"
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    disabled={!editor.isActive("table")}
                  >
                    Delete Table
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="tiptap-editor-wrap custom-scrollbar">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
