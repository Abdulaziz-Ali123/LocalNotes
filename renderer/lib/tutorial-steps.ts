/**
 * File: renderer/lib/tutorial-steps.ts
 *
 * Defines the Driver.js step arrays for the first-time user tutorial.
 *
 * HOW TO EDIT:
 *  Each step object has:
 *    - element:  A CSS selector for the element to highlight.
 *                All tutorial targets use data-tutorial="<name>" attributes.
 *    - popover:  The tooltip shown next to that element.
 *      - title:       Bold heading text.
 *      - description: Body text (HTML is supported, e.g. <b>bold</b>).
 *      - side:        Where the popover appears: "top" | "bottom" | "left" | "right".
 *      - align:       Alignment of the popover: "start" | "center" | "end".
 *
 * HOW TO ADD A NEW STEP:
 *  1. Add a data-tutorial="your-id" attribute to the target element in editor.tsx
 *     (or any other renderer component).
 *  2. Add a new step object to the array below, using '[data-tutorial="your-id"]'
 *     as the element selector.
 *
 * HOW TO REORDER STEPS:
 *  Simply move the step objects up or down in the array.
 *
 * HOW TO REMOVE A STEP:
 *  Delete the step object. The data-tutorial attribute on the element can stay —
 *  it has no visual effect when Driver.js is not active.
 *
 * HOW TO AUTO-OPEN A PANEL WHEN A STEP IS HIGHLIGHTED:
 *  Add an onHighlightStarted callback to the step. It receives the real DOM
 *  element and you can call .click() on it to trigger the same handler as a
 *  real user click. Only do this for panel buttons (files, search, themes, tags)
 *  — NOT for buttons that open dialogs or popovers (import, share, settings).
 *
 * CURRENT data-tutorial IDs in the codebase:
 *  "btn-files"          → Files sidebar button        (editor.tsx)
 *  "btn-search"         → Search sidebar button       (editor.tsx)
 *  "btn-ai"             → AI Assistant button         (editor.tsx)
 *  "btn-settings"       → Settings button             (editor.tsx)
 *  "tab-bar"            → Tab bar at the top          (TabBar.tsx)
 *  "editor-area"        → Main editor/content area    (editor.tsx)
 *  "ai-header"          → AI controls bar             (AIChatPanel.tsx) — not used in steps
 *  "ai-model-selector"  → Model selector dropdown     (AIChatPanel.tsx)
 *  "ai-thinking"        → Thinking toggle button      (AIChatPanel.tsx) — conditional
 *  "ai-new-chat"        → New Chat button             (AIChatPanel.tsx)
 *  "ai-messages"        → Chat messages area          (AIChatPanel.tsx)
 *  "ai-input"           → Chat input area             (AIChatPanel.tsx)
 */

import type { DriveStep } from "driver.js";

export const editorTutorialSteps: DriveStep[] = [
  {
    // No element — opens a centered welcome popover
    popover: {
      title: "Welcome to LocalNotes 👋",
      description:
        "This quick tour will walk you through the main features. Press <b>Next</b> to continue or <b>×</b> to skip.",
      side: "over",
    },
  },
  {
    element: '[data-tutorial="btn-files"]',
    popover: {
      title: "File Browser",
      description:
        "Click here to open the <b>file tree</b> and browse all your notes. Right-click any file or folder for more options.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tutorial="btn-search"]',
    onHighlightStarted: (element) => {
      (element as HTMLElement)?.click();
    },
    popover: {
      title: "Search",
      description:
        "Quickly find any note by content or filename using full-text search.",
      side: "right",
      align: "start",
    },
  },
    {
    element: '[data-tutorial="btn-import"]',
    popover: {
      title: "Import",
      description:
        "Import files or folders into your workspace. You can also import content directly into a note.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tutorial="btn-themes"]',
    onHighlightStarted: (element) => {
      (element as HTMLElement)?.click();
    },
    popover: {
      title: "Themes",
      description:
        "Customize the appearance of your notes with different themes.",
      side: "right",
      align: "start",
    },
  },
    {
    element: '[data-tutorial="btn-tags"]',
    onHighlightStarted: (element) => {
      (element as HTMLElement)?.click();
    },
    popover: {
      title: "Tags",
      description:
        "Filter your notes by tags to quickly find related content.",
      side: "right",
      align: "start",
    },
  },
    {
    element: '[data-tutorial="btn-share"]',
    popover: {
      title: "Share",
      description:
        "Share your notes with friends or collaborators via exporting a file or whole workspace.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tutorial="btn-settings"]',
    popover: {
      title: "Settings",
      description:
        "Customise the appearance, keybindings, AI models, and sidebar layout. You can also replay this tutorial from here.",
      side: "right",
      align: "start",
    },
  },
    {
    element: '[data-tutorial="btn-files-history"]',
    popover: {
      title: "Files History",
      description:
        "View the history of changes made to your files. You can revert to previous versions or track modifications over time.",
      side: "right",
      align: "start",
    },
  },
    {
    element: '[data-tutorial="tab-bar"]',
    onHighlightStarted: () => {
      document.querySelector<HTMLElement>('[data-tutorial="set-view-editor"]')?.click();
    },
    popover: {
      title: "Tabs",
      description:
        "Open multiple notes at once using tabs. Click <b>+</b> to open a new tab, and drag tabs to reorder them.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tutorial="editor-area"]',
    onHighlightStarted: () => {
      document.querySelector<HTMLElement>('[data-tutorial="set-view-editor"]')?.click();
    },
    popover: {
      title: "Editor",
      description:
        "Write and edit your notes here. Markdown is fully supported, and you can switch between <b>Edit</b>, <b>Preview</b>, and <b>Live Preview</b> modes.",
      side: "top",
      align: "center",
    },
  },
    {
    element: '[data-tutorial="btn-ai"]',
    onHighlightStarted: () => {
      document.querySelector<HTMLElement>('[data-tutorial="set-view-ai"]')?.click();
    },
    popover: {
      title: "AI Assistant",
      description:
        "Chat with an AI about your notes. You can ask questions, summarise content, and more. Configure your model in Settings.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tutorial="ai-model-selector"]',
    popover: {
      title: "Model Selector",
      description:
        "Click here to switch between any AI models you have configured. Add more models in <b>Settings → AI</b>.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tutorial="ai-thinking"]',
    popover: {
      title: "Thinking Mode",
      description:
        "When your model supports extended thinking, this button lets you toggle it on or off. Thinking traces the model's reasoning step-by-step before it answers.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tutorial="ai-new-chat"]',
    popover: {
      title: "New Chat",
      description:
        "Click here to clear the current conversation and start fresh. Your previous chats are not saved once cleared.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tutorial="ai-messages"]',
    popover: {
      title: "Conversation",
      description:
        "Your chat history appears here. The AI can reference your open notes when RAG is enabled.",
      side: "left",
      align: "center",
    },
  },
  {
    element: '[data-tutorial="ai-input"]',
    popover: {
      title: "Message Input",
      description:
        "Type your question here and press <b>Enter</b> or click Send. You can attach files or use voice input if your model supports it.",
      side: "top",
      align: "center",
    },
  },
];
