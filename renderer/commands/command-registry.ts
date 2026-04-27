import type {
  CustomThemeDefinition,
  GlobalSettings,
  ThemeType,
} from "@/renderer/store/settings-slice";

export type SettingsTab = "appearance" | "sidebar" | "editor" | "keybindings" | "ai";
export type CommandCategory = "App" | "File" | "View" | "Settings" | "Theme";

export interface WorkspaceCommandFile {
  path: string;
  name: string;
  relativePath: string;
}

export interface AppCommand {
  id: string;
  title: string;
  category: CommandCategory;
  subtitle?: string;
  keywords?: string[];
  disabled?: boolean;
  action: () => void | Promise<void>;
}

export interface CommandRegistryContext {
  selectedFile: string | null;
  rootPath: string | null;
  workspaceFiles: WorkspaceCommandFile[];
  currentTheme: ThemeType;
  customThemes: Record<string, CustomThemeDefinition>;
  settings: GlobalSettings;
  executeAction: (actionId: string) => void | Promise<void>;
  openSettings: (tab: SettingsTab) => void;
  openSidebarPanel: (panel: "file" | "search" | "theme" | "tags") => void;
  setMainView: (view: "editor" | "ai") => void;
  openWorkspaceFile: (filePath: string) => void | Promise<void>;
  setTheme: (theme: ThemeType) => void;
  setGlobalSetting: (dotPath: string, value: any) => void | Promise<void>;
}

const BUILT_IN_THEME_LABELS: Array<{ id: ThemeType; label: string }> = [
  { id: "nord", label: "Nord" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "cozy", label: "Cozy" },
  { id: "darker", label: "Darker" },
];

function command(command: AppCommand): AppCommand {
  return command;
}

function formatToggleLabel(enabled: boolean): string {
  return enabled ? "Disable" : "Enable";
}

export function buildCommandRegistry(context: CommandRegistryContext): AppCommand[] {
  const markdownSelected = Boolean(
    context.selectedFile?.toLowerCase().endsWith(".md")
  );

  const commands: AppCommand[] = [
    command({
      id: "file.save",
      title: "Save Current File",
      category: "File",
      subtitle: context.selectedFile ?? "No file selected",
      disabled: !context.selectedFile,
      keywords: ["write", "persist"],
      action: () => context.executeAction("file.save"),
    }),
    command({
      id: "file.open",
      title: "Open Folder",
      category: "File",
      subtitle: "Choose a notes folder",
      keywords: ["workspace", "directory"],
      action: () => context.executeAction("file.open"),
    }),
    command({
      id: "file.newFile",
      title: "New File",
      category: "File",
      disabled: !context.selectedFile,
      subtitle: context.selectedFile
        ? "Create next to the selected file"
        : "Select a file first",
      keywords: ["create", "note"],
      action: () => context.executeAction("file.newFile"),
    }),
    command({
      id: "file.newFolder",
      title: "New Folder",
      category: "File",
      disabled: !context.selectedFile,
      subtitle: context.selectedFile
        ? "Create next to the selected file"
        : "Select a file first",
      keywords: ["create", "directory"],
      action: () => context.executeAction("file.newFolder"),
    }),
    command({
      id: "view.search",
      title: "Search Notes",
      category: "View",
      subtitle: "Open the search panel",
      keywords: ["find"],
      action: () => context.executeAction("view.search"),
    }),
    command({
      id: "view.toggleSidebar",
      title: "Toggle Sidebar",
      category: "View",
      keywords: ["collapse", "panel"],
      action: () => context.executeAction("view.toggleSidebar"),
    }),
    command({
      id: "view.togglePreview",
      title: "Toggle Markdown Preview",
      category: "View",
      disabled: !markdownSelected,
      subtitle: markdownSelected ? undefined : "Select a Markdown file first",
      keywords: ["markdown", "render"],
      action: () => context.executeAction("view.togglePreview"),
    }),
    command({
      id: "view.toggleLivePreview",
      title: "Toggle Live Preview",
      category: "View",
      disabled: !markdownSelected,
      subtitle: markdownSelected ? undefined : "Select a Markdown file first",
      keywords: ["markdown", "split"],
      action: () => context.executeAction("view.toggleLivePreview"),
    }),
    command({
      id: "view.showFiles",
      title: "Show Files",
      category: "View",
      subtitle: "Open the file sidebar panel",
      action: () => context.openSidebarPanel("file"),
    }),
    command({
      id: "view.showThemes",
      title: "Show Themes",
      category: "Theme",
      subtitle: "Open the theme sidebar panel",
      action: () => context.openSidebarPanel("theme"),
    }),
    command({
      id: "view.showTags",
      title: "Show Tags",
      category: "View",
      subtitle: "Open the tag filter panel",
      action: () => context.openSidebarPanel("tags"),
    }),
    command({
      id: "view.showEditor",
      title: "Show Editor",
      category: "View",
      keywords: ["notes", "files"],
      action: () => context.setMainView("editor"),
    }),
    command({
      id: "view.showAi",
      title: "Show AI Chat",
      category: "View",
      keywords: ["assistant", "chat"],
      action: () => context.setMainView("ai"),
    }),
    ...settingsSectionCommands(context),
    ...settingToggleCommands(context),
    ...themeCommands(context),
    ...workspaceFileCommands(context),
  ];

  return commands;
}

function settingsSectionCommands(context: CommandRegistryContext): AppCommand[] {
  const tabs: Array<{ tab: SettingsTab; title: string; keywords: string[] }> = [
    { tab: "appearance", title: "Open Appearance Settings", keywords: ["theme", "font"] },
    { tab: "sidebar", title: "Open Sidebar Settings", keywords: ["layout", "rail"] },
    { tab: "editor", title: "Open Editor Settings", keywords: ["autosave", "wrap"] },
    { tab: "keybindings", title: "Open Keybinding Settings", keywords: ["shortcuts", "keyboard"] },
    { tab: "ai", title: "Open AI Settings", keywords: ["models", "rag"] },
  ];

  return tabs.map(({ tab, title, keywords }) =>
    command({
      id: `settings.open.${tab}`,
      title,
      category: "Settings",
      subtitle: "Navigate to a settings section",
      keywords,
      action: () => context.openSettings(tab),
    })
  );
}

function settingToggleCommands(context: CommandRegistryContext): AppCommand[] {
  const { editor, ai } = context.settings;

  return [
    command({
      id: "settings.toggle.autosave",
      title: `${formatToggleLabel(editor.autosaveEnabled)} Autosave`,
      category: "Settings",
      subtitle: `Currently ${editor.autosaveEnabled ? "enabled" : "disabled"}`,
      keywords: ["editor", "save"],
      action: () =>
        context.setGlobalSetting("editor.autosaveEnabled", !editor.autosaveEnabled),
    }),
    command({
      id: "settings.toggle.wordWrap",
      title: `${formatToggleLabel(editor.wordWrap)} Word Wrap`,
      category: "Settings",
      subtitle: `Currently ${editor.wordWrap ? "enabled" : "disabled"}`,
      keywords: ["editor", "wrap"],
      action: () => context.setGlobalSetting("editor.wordWrap", !editor.wordWrap),
    }),
    command({
      id: "settings.toggle.lineNumbers",
      title: `${formatToggleLabel(editor.showLineNumbers)} Line Numbers`,
      category: "Settings",
      subtitle: `Currently ${editor.showLineNumbers ? "shown" : "hidden"}`,
      keywords: ["editor", "gutter"],
      action: () =>
        context.setGlobalSetting("editor.showLineNumbers", !editor.showLineNumbers),
    }),
    command({
      id: "settings.toggle.defaultRag",
      title: `${formatToggleLabel(ai.defaultRagEnabled)} Default RAG`,
      category: "Settings",
      subtitle: `Currently ${ai.defaultRagEnabled ? "enabled" : "disabled"}`,
      keywords: ["ai", "retrieval", "indexing"],
      action: () =>
        context.setGlobalSetting("ai.defaultRagEnabled", !ai.defaultRagEnabled),
    }),
  ];
}

function themeCommands(context: CommandRegistryContext): AppCommand[] {
  const customThemeCommands = Object.values(context.customThemes)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .map((theme) =>
      command({
        id: `theme.set.${theme.id}`,
        title: `Use ${theme.name} Theme`,
        category: "Theme",
        subtitle: context.currentTheme === theme.id ? "Current theme" : "Custom theme",
        keywords: ["appearance", "custom"],
        action: () => context.setTheme(theme.id),
      })
    );

  return [
    ...BUILT_IN_THEME_LABELS.map(({ id, label }) =>
      command({
        id: `theme.set.${id}`,
        title: `Use ${label} Theme`,
        category: "Theme" as const,
        subtitle: context.currentTheme === id ? "Current theme" : "Built-in theme",
        keywords: ["appearance", label.toLowerCase()],
        action: () => context.setTheme(id),
      })
    ),
    ...customThemeCommands,
  ];
}

function workspaceFileCommands(context: CommandRegistryContext): AppCommand[] {
  return context.workspaceFiles.map((file) =>
    command({
      id: `workspace.openFile.${file.path}`,
      title: `Open ${file.name}`,
      category: "File",
      subtitle: file.relativePath,
      keywords: ["workspace", "note", file.path, file.relativePath],
      action: () => context.openWorkspaceFile(file.path),
    })
  );
}
