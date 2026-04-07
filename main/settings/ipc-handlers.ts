/**
 * Settings IPC handlers.
 *
 * Registers all settings-related IPC channels so the renderer can
 * get/set/reset both global and project settings.
 *
 * Revision History:
 *  • Wesley McDougal - 07APR2026 - Added llm:chat IPC handler: performs all HTTP
 *    requests to LLM provider endpoints server-side so API keys are never exposed to the
 *    renderer process or browser DevTools network panel.
 */

import { ipcMain, BrowserWindow, Menu } from "electron";
import { SettingsManager } from "./settings-manager";
import { KEYBINDING_ACTIONS } from "./keybindings";
import { buildMenuTemplate } from "./menu-builder";
import { GlobalSettings } from "./schema";
import { upsertLLMModel, listLLMModels, getDefaultLLMModel, deleteLLMModel } from "./llm-registry";

/**
 * Register all settings IPC handlers.
 *
 * @param manager  The initialised SettingsManager instance
 * @param getMainWindow  Getter for the main BrowserWindow (used to rebuild menus)
 */
export function registerSettingsIpc(
  manager: SettingsManager,
  getMainWindow: () => BrowserWindow | null
): void {
  // -----------------------------------------------------------------------
  // Global settings
  // -----------------------------------------------------------------------

  ipcMain.handle("settings:getGlobal", async () => {
    return manager.getResolvedGlobal();
  });

  ipcMain.handle(
    "settings:setGlobal",
    async (_event, dotPath: string, value: any) => {
      const updated = await manager.setGlobal(dotPath, value);

      // If keybindings changed, rebuild the application menu
      if (dotPath.startsWith("keybindings")) {
        rebuildMenu(updated, getMainWindow());
      }

      // Notify renderer of the change so Zustand stays in sync
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send("settings:changed", updated);
      }

      return updated;
    }
  );

  ipcMain.handle("settings:resetGlobal", async (_event, dotPath: string) => {
    const updated = await manager.resetGlobal(dotPath);

    if (dotPath.startsWith("keybindings")) {
      rebuildMenu(updated, getMainWindow());
    }

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("settings:changed", updated);
    }

    return updated;
  });

  ipcMain.handle("settings:resetAllGlobal", async () => {
    const updated = await manager.resetAllGlobal();
    rebuildMenu(updated, getMainWindow());

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("settings:changed", updated);
    }

    return updated;
  });

  // -----------------------------------------------------------------------
  // LLM model registry (OpenAI-compatible endpoints)
  // -----------------------------------------------------------------------

  ipcMain.handle(
    "llm:upsertModel",
    async (_event, spec: any, setAsDefault: boolean = true) => {
      await upsertLLMModel(manager, spec, setAsDefault);

      // Notify renderer so Zustand (or any store) stays in sync
      const updated = manager.getResolvedGlobal();
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send("settings:changed", updated);
      }
    }
  );

  ipcMain.handle("llm:listModels", async () => {
    return listLLMModels(manager);
  });

  ipcMain.handle("llm:getDefaultModel", async () => {
    return getDefaultLLMModel(manager);
  });

  ipcMain.handle("llm:deleteModel", async (_event, modelId: string) => {
    await deleteLLMModel(manager, modelId);

    const updated = manager.getResolvedGlobal();
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("settings:changed", updated);
    }
  });

  // -----------------------------------------------------------------------
  // Project settings
  // -----------------------------------------------------------------------

  ipcMain.handle(
    "settings:getProject",
    async (_event, projectRoot: string) => {
      return manager.getResolvedProject(projectRoot);
    }
  );

  ipcMain.handle(
    "settings:loadProject",
    async (_event, projectRoot: string) => {
      return manager.loadProject(projectRoot);
    }
  );

  ipcMain.handle(
    "settings:setProject",
    async (_event, projectRoot: string, dotPath: string, value: any) => {
      return manager.setProject(projectRoot, dotPath, value);
    }
  );

  ipcMain.handle(
    "settings:resetProject",
    async (_event, projectRoot: string, dotPath: string) => {
      return manager.resetProject(projectRoot, dotPath);
    }
  );

  // -----------------------------------------------------------------------
  // Metadata / helpers
  // -----------------------------------------------------------------------

  ipcMain.handle("settings:getDefaults", () => {
    return manager.getDefaults();
  });

  ipcMain.handle("settings:getKeybindingActions", () => {
    return KEYBINDING_ACTIONS;
  });

  // -----------------------------------------------------------------------
  // LLM Chat Handler
  // All HTTP communication with LLM providers happens here in the main
  // process. The renderer never sees the raw API key — it only calls
  // window.llm.chat() and receives { success, content } back.
  //
  // Flow:
  //   1. Look up the CustomModel by id from persisted ai.customModels.
  //   2. Resolve the provider endpoint (or use the model's custom baseUrl).
  //   3. Perform an OpenAI-compatible streaming POST request.
  //   4. Drain the SSE stream and return the assembled plaintext response.
  // -----------------------------------------------------------------------

  ipcMain.handle(
    "llm:chat",
    async (
      _event,
      modelId: string,
      messages: Array<{ role: string; content: string }>,
      thinkingEnabled?: boolean
    ) => {
      try {
        const globalSettings = manager.getResolvedGlobal();
        const customModels = globalSettings?.ai?.customModels || [];
        const currentModel = customModels.find((m: any) => m.id === modelId);

        if (!currentModel) {
          throw new Error("Selected LLM model not found in settings.");
        }

        const apiKey = currentModel.apiKey || "";
        let endpoint = (currentModel.baseUrl || "").trim();

        if (!endpoint) {
          switch (currentModel.provider) {
            case "Ollama":
              endpoint = "http://localhost:11434/v1/chat/completions";
              break;
            case "OpenAI":
              endpoint = "https://api.openai.com/v1/chat/completions";
              break;
            case "Anthropic":
              endpoint = "https://api.anthropic.com/v1/chat/completions";
              break;
            case "Google":
              endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
              break;
            case "OpenRouter":
              endpoint = "https://openrouter.ai/api/v1/chat/completions";
              break;
            case "xAI":
              endpoint = "https://api.x.ai/v1/chat/completions";
              break;
            default:
              endpoint = "http://localhost:11434/v1/chat/completions";
          }
        }

        console.log(
          `[LLM] Sending request to: ${endpoint} (Model: ${currentModel.name}, Provider: ${currentModel.provider})`
        );

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: currentModel.name,
            messages: messages,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `LLM Error: ${response.statusText} (${response.status}). Details: ${errorBody.slice(0, 100)}...`
          );
        }

        // Consume the entire stream and return as string
        const reader = response.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullContent = "";
        let buffer = "";

        if (!reader) {
          throw new Error("No response stream available");
        }

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n");
          while (boundary !== -1) {
            const line = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 1);
            boundary = buffer.indexOf("\n");

            if (line === "data: [DONE]") continue;
            if (line.startsWith("data: ")) {
              try {
                const payload = line.slice(6).trim();
                if (payload === "[DONE]") continue;

                const data = JSON.parse(payload);
                const delta = data.choices?.[0]?.delta?.content || "";
                fullContent += delta;
              } catch (err) {
                // Ignore malformed JSON
              }
            }
          }
        }

        return { success: true, content: fullContent };
      } catch (error: any) {
        console.error("[LLM] Error:", error);
        return {
          success: false,
          error: error?.message || "Unknown error contacting LLM",
        };
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Menu rebuilder
// ---------------------------------------------------------------------------

function rebuildMenu(
  settings: GlobalSettings,
  win: BrowserWindow | null
): void {
  const template = buildMenuTemplate(settings, win);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
