/**
 * Settings IPC handlers.
 *
 * Registers all settings-related IPC channels so the renderer can
 * get/set/reset both global and project settings.
 *
 * Git-history contributors: Wesley McDougal; Malek Kchaou; Shaun
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
/**
 * Functionality: registerSettingsIpc performs the register settings ipc workflow used by main/settings/ipc-handlers.ts.
 * Parameters: manager (SettingsManager); getMainWindow (() => BrowserWindow | null).
 * Returns: Returns void.
 * Usage: Call registerSettingsIpc from the owning module or component when this behavior is required.
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

  // Track active streaming controllers for abortion
  const activeControllers = new Map<string, AbortController>();

  ipcMain.on("llm:abort", (_event, { requestId }) => {
    const controller = activeControllers.get(requestId);
    if (controller) {
      controller.abort();
      activeControllers.delete(requestId);
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
      requestId: string,
      modelId: string,
      messages: Array<{ role: string; content: string }>,
      thinkingEnabled?: boolean
    ) => {
      try {
        const globalSettings = manager.getResolvedGlobal();
        const customModels = globalSettings?.ai?.customModels || [];
        let currentModel = customModels.find((m: any) => m.id === modelId);

        if (!currentModel && globalSettings?.llm?.models) {
          const llmModels = Object.values(globalSettings.llm.models);
          currentModel = llmModels.find((m: any) => m.id === modelId);
        }

        if (!currentModel) {
          throw new Error("Selected LLM model not found in settings.");
        }

        const apiKey = currentModel.apiKey || "";
        // llm.models use "model" for the API model string; ai.customModels use "name"
        const modelString = currentModel.model || currentModel.name;
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

        // llm.models store baseUrl without /chat/completions — append if needed
        if (endpoint && !endpoint.endsWith("/chat/completions")) {
          endpoint = endpoint.replace(/\/+$/, "") + "/chat/completions";
        }

        console.log(
          `[LLM] Sending request to: ${endpoint} (Model: ${modelString}, Provider: ${currentModel.provider || "unknown"})`
        );

        const controller = new AbortController();
        activeControllers.set(requestId, controller);

        // Build the request body
        const requestBody: any = {
          model: modelString,
          messages: [...messages], // Clone to avoid mutation
          stream: true,
        };

        // If thinking is enabled, we need to pass the appropriate parameters
        // and ensure the message history doesn't end with an assistant message (prefill),
        // as thinking models generally require starting with a <thinking> block.
        if (thinkingEnabled) {
          // 1. Clean up message history: remove trailing non-user messages
          // Thinking models generally require starting with a fresh user message
          // and specifically forbid assistant pre-fill.
          while (requestBody.messages.length > 0) {
            const lastMsg = requestBody.messages[requestBody.messages.length - 1];
            const role = (lastMsg.role || "").toLowerCase();
            const content = typeof lastMsg.content === "string" ? lastMsg.content.trim() : "";
            
            if (role === "assistant" || role === "system" || !content) {
              requestBody.messages.pop();
            } else {
              break;
            }
          }

          // 2. Add provider-specific thinking parameters
          if (currentModel.provider === "Anthropic" || modelString.toLowerCase().includes("claude-3-7")) {
            requestBody.thinking = { type: "enabled", budget_tokens: 4000 };
            // Anthropic models with thinking enabled require max_tokens instead of max_completion_tokens for now,
            // but we'll stick to their specific spec.
            requestBody.max_tokens = 8000; 
          } else if (modelString.toLowerCase().startsWith("o1") || modelString.toLowerCase().startsWith("o3")) {
             // OpenAI O-series doesn't use "enable_thinking" but "reasoning_effort"
             requestBody.reasoning_effort = "medium";
          } else {
            // Generic/Other providers (like OpenRouter or custom proxies)
            requestBody.enable_thinking = true;
          }
        }

        // For Anthropic, move system message to top-level if it exists
        if (currentModel.provider === "Anthropic") {
          const systemMsgIdx = requestBody.messages.findIndex((m: any) => m.role === "system");
          if (systemMsgIdx !== -1) {
            const [systemMsg] = requestBody.messages.splice(systemMsgIdx, 1);
            requestBody.system = systemMsg.content;
          }
        }

        const response = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            // Some providers (like Anthropic) require specific version headers
            ...(currentModel.provider === "Anthropic" ? { "anthropic-version": "2023-06-01" } : {}),
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          activeControllers.delete(requestId);
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
        let rawBody = "";

        if (!reader) {
          activeControllers.delete(requestId);
          throw new Error("No response stream available");
        }

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          rawBody += chunk;
          buffer += chunk;

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
                const delta = data.choices?.[0]?.delta || {};

                // Handle both standard content and reasoning_content (for DeepSeek/O1 style thinking)
                const content = delta.content || "";
                const reasoning = delta.reasoning_content || "";

                const win = getMainWindow();
                if (win && !win.isDestroyed()) {
                  if (reasoning) {
                    win.webContents.send(`llm:chunk:${requestId}`, { reasoning });
                  }
                  if (content) {
                    win.webContents.send(`llm:chunk:${requestId}`, { chunk: content });
                  }
                }

                fullContent += content;
              } catch (err) {
                // Ignore malformed SSE JSON chunks
              }
            }
          }
        }

        // If SSE parsing yielded nothing, the provider may have returned
        // a plain (non-streaming) JSON response — try to extract content.
        if (!fullContent && rawBody.trim()) {
          try {
            const plain = JSON.parse(rawBody.trim());
            fullContent =
              plain.choices?.[0]?.message?.content ||
              plain.choices?.[0]?.delta?.content ||
              plain.content ||
              plain.response ||
              "";
          } catch {
            // rawBody might not be valid JSON either — just use it as-is
            console.warn("[LLM] Could not parse raw response as JSON, using raw text.");
            fullContent = rawBody.trim();
          }
        }

        if (!fullContent) {
          console.error("[LLM] Empty response. Raw body:", rawBody.slice(0, 500));
          throw new Error("LLM returned an empty response. Check your model configuration.");
        }

        console.log("[LLM] Response length:", fullContent.length);
        console.log("[LLM] Response preview:", fullContent.slice(0, 500));

        activeControllers.delete(requestId);
        return { success: true, content: fullContent };
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log(`[LLM] Request aborted for requestId: ${requestId}`);
          return { success: false, error: "Request aborted" };
        } else {
          console.error("[LLM] Error:", error);
          return {
            success: false,
            error: error?.message || "Unknown error contacting LLM",
          };
        }
      } finally {
        activeControllers.delete(requestId);
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Menu rebuilder
// ---------------------------------------------------------------------------

/**
 * Functionality: rebuildMenu performs the rebuild menu workflow used by main/settings/ipc-handlers.ts.
 * Parameters: settings (GlobalSettings); win (BrowserWindow | null).
 * Returns: Returns void.
 * Usage: Call rebuildMenu from the owning module or component when this behavior is required.
 */
function rebuildMenu(
  settings: GlobalSettings,
  win: BrowserWindow | null
): void {
  const template = buildMenuTemplate(settings, win);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
