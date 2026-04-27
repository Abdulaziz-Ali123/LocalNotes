/**
 * AIChatPanel
 *
 * AI chat interface embedded in the editor sidebar. Allows users to converse
 * with a configured LLM model using their open notes as optional RAG context.
 *
 * Revision History:
 *  • Wesley McDougal - 07APR2026 - Initial implementation:
 *    - Model dropdown reads from ai.customModels (Zustand).
 *    - Pre-send guard blocks send and shows amber banner when no models exist.
 *    - "Add AI Model" button in empty state navigates to Settings → AI tab.
 *    - New chats initialise from ai.defaultModelId; selection persists on change.
 *    - useEffect detects deleted active model and shows amber replacement warning.
 *    - Settings load errors surfaced as red banner with Retry button.
 *    - Replaced direct fetch() with window.llm.chat() IPC call so API keys
 *              remain in the main process and are invisible to the renderer.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/renderer/components/ui/scroll-area";
import MarkdownViewer from "@/renderer/components/MarkdownViewer";
import {
  RiSendPlaneFill,
  RiMicLine,
  RiMicOffLine,
  RiAttachmentLine,
  RiAddLine,
  RiDeleteBinLine,
  RiFileLine,
  RiArrowDownSLine,
  RiCheckLine,
  RiRobot2Line,
  RiUser3Line,
  RiStopCircleLine,
  RiCloseLine,
  RiInformationLine,
} from "react-icons/ri";
import { LuBrain, LuBrainCircuit } from "react-icons/lu";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { DEFAULT_MODEL_CAPABILITIES } from "@/renderer/store/settings-slice";
import { Button } from "@/renderer/components/ui/button";
import { X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  attachments?: FileAttachment[];
  timestamp: Date;
  isStreaming?: boolean;
}

interface FileAttachment {
  name: string;
  size: number;
  type: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: Date;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Model Selector ──────────────────────────────────────────────────────────

function ModelSelector({
  selectedModel,
  onSelect,
}: {
  selectedModel: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const aiSettings = useBoundStore((s) => s.settings.global?.ai);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const customModels = aiSettings?.customModels || [];
  const current = customModels.find((m) => m.id === selectedModel);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={customModels.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate max-w-[140px]">
          {current ? current.name : customModels.length > 0 ? "Select Model" : "No Models Added"}
        </span>
        <RiArrowDownSLine
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && customModels.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-background border border-border rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {customModels.map((model) => (
            <button
              key={model.id}
              onClick={() => {
                onSelect(model.id);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">{model.name}</span>
                <span className="text-xs text-muted-foreground">{model.provider}</span>
              </div>
              {model.id === selectedModel && <RiCheckLine className="w-4 h-4 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Thinking Block ──────────────────────────────────────────────────────────

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <LuBrainCircuit className="w-3.5 h-3.5" />
        <span>{expanded ? "Hide thinking" : "Show thinking"}</span>
        <RiArrowDownSLine
          className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-1.5 pl-3 border-l-2 border-muted text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      )}
    </div>
  );
}

// ─── Chat Message Bubble ─────────────────────────────────────────────────────

function MessageBubble({
  message,
  thinkingEnabled,
}: {
  message: ChatMessage;
  thinkingEnabled: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <RiUser3Line className="w-4 h-4" /> : <RiRobot2Line className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {message.attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs"
              >
                <RiFileLine className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{file.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Thinking */}
        {thinkingEnabled && message.thinking && <ThinkingBlock content={message.thinking} />}

        {/* Message body */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-accent text-accent-foreground rounded-br-md"
              : "bg-muted/50 border border-border rounded-bl-md"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.isStreaming && !message.content ? (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          ) : (
            <MarkdownViewer content={message.content} />
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground mt-1 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ─── Main Chat Panel ─────────────────────────────────────────────────────────

interface AIChatPanelProps {
  /** Callback that opens Settings → AI tab so the empty-state button
   *  and removed-model warning can navigate without knowing dialog internals. */
  onOpenAiSettings?: () => void;
}

export default function AIChatPanel({ onOpenAiSettings }: AIChatPanelProps = {}) {
  const aiSettings = useBoundStore((s) => s.settings.global?.ai);
  // error string set by settings-slice when initialization fails
  const settingsLoadError = useBoundStore((s) => s.settings.loadError);
  // re-runs initialize() and clears loadError; bound to Retry button
  const retrySettingsLoad = useBoundStore((s) => s.settings.retryLoad);

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: generateId(),
      title: "New Chat",
      messages: [],
  // seed the first conversation from saved default, then first model, then empty
      model: aiSettings?.defaultModelId ?? aiSettings?.customModels?.[0]?.id ?? "",
      createdAt: new Date(),
    },
  ]);
  const [activeConvoId, setActiveConvoId] = useState(conversations[0].id);
  const [isInitializingRag, setIsInitializingRag] = useState(false);
  const [ragInitStatus, setRagInitStatus] = useState("");
  const [showRagInitDialog, setShowRagInitDialog] = useState(false);
  const [pendingUserText, setPendingUserText] = useState("");
  const [input, setInput] = useState("");
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  /** validation message shown in amber banner when send is attempted
   *  without any models configured. Cleared on successful model selection. */
  const [modelError, setModelError] = useState<string>("");
  /** true when the conversation's selected model no longer exists in
   *  ai.customModels; triggers the amber "model removed" warning banner. */
  const [removedModelWarning, setRemovedModelWarning] = useState<boolean>(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const activeConvo = conversations.find((c) => c.id === activeConvoId)!;

  // Derive capabilities for the active model
  const caps = (
    aiSettings?.modelConfigs?.[activeConvo.model]?.capabilities ??
  aiSettings?.customModels?.find(m => m.id === activeConvo.model)?.capabilities ??
    { fileUpload: false, voice: false, thinking: false }
  );

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const executeRAG = async (convoId: string, userText: string) => {
    // Scaffold UI
    const assistantId = generateId();
    updateConversation(convoId, (c) => ({
      ...c,
      messages: [
        ...c.messages,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isStreaming: true,
        },
      ],
    }));

    try {
      // 1. Get current directory UUID
      const currentFolderPath = localStorage.getItem("currentFolderPath");
      if (!currentFolderPath) throw new Error("No folder open.");
      
      let directoryId = "";
      let debugInfo = "";

      // Prioritize Database Lookup
      const idRes = await window.db.getDirectoryIdByPath(currentFolderPath);
      if (idRes.success && idRes.data) {
        directoryId = idRes.data;
        debugInfo += `DB Match Found | `;
      } else {
        debugInfo += `DB Lookup Failed: ${idRes.error || "Not found"} | `;
        
        // Fallback: Read from .Local Notes/.env
        const localNotesDir = window.fs.join(currentFolderPath, ".Local Notes");
        const envPath = window.fs.join(localNotesDir, ".env");
        
        const envRes = await window.fs.exists(envPath);
        debugInfo += `Env Path: ${envPath} | Env Exists: ${envRes.success ? envRes.data : envRes.error} | `;
        
        if (envRes.success && envRes.data) {
           const contentRes = await window.fs.readFile(envPath);
           if (contentRes.success) {
              const lines = contentRes.data.split("\n");
              lines.forEach((line: string) => {
                if (line.startsWith("DIRECTORY_ID=")) {
                   directoryId = line.split("=")[1].trim();
                }
              });
              debugInfo += `Env Read Success | Lines: ${lines.length} | ID: ${directoryId}`;
           } else {
              debugInfo += `Env Read Failed: ${contentRes.error}`;
           }
        }
      }
      
      if (!directoryId) {
        setPendingUserText(userText);
        setShowRagInitDialog(true);
        throw new Error("RAG not initialized for this folder.");
      }

      // 2. Retrieve Context via RAG IPC
      updateConversation(convoId, (c) => ({
        ...c,
        messages: c.messages.map(m => m.id === assistantId ? { ...m, thinking: "Retrieving relevant notes from local database..." } : m)
      }));
      
      const contextRes = await window.rag.retrieveContext(directoryId, userText, 5);
      const contextAugmentation = contextRes.success && contextRes.contextText 
        ? contextRes.contextText 
        : "No relevant local notes found.";

      updateConversation(convoId, (c) => ({
        ...c,
        messages: c.messages.map(m => m.id === assistantId ? { ...m, thinking: "Thinking based on your notes..." } : m)
      }));

      // 3. Prepare Chat Prompt
      const c = conversations.find(c => c.id === convoId);
      if (!c) return;

      const systemPrompt = `You are a helpful assistant assisting the user with their local markdown notes repository.
      
${contextAugmentation}

Use the above context to answer the user accurately. If the context does not answer the question, say so, but try to be helpful based on your general knowledge if applicable.`;

      // We only send prior conversation context + the new system prompt
      const previousMessagesForAPI = c.messages
        .filter(m => m.id !== assistantId)
        .map(m => ({ role: m.role, content: m.content }));

      const messagesData = [
         { role: "system", content: systemPrompt },
         ...previousMessagesForAPI
      ];

      // 4. Contact LLM via IPC handler (API key stays in main process)
      let fullRawResponse = "";
      let fullThinkingResponse = "";
      const requestId = Math.random().toString(36).substring(7);
      activeRequestIdRef.current = requestId;

      const chatResult = await (window as any).llm.chatStream(
        activeConvo.model,
        messagesData,
        thinkingEnabled,
        (data: { content: string; reasoning: string }) => {
          if (activeRequestIdRef.current !== requestId) return;
          
          fullRawResponse += data.content;
          
          // 1. Accumulate explicit reasoning if provided (DeepSeek/O1 style)
          if (data.reasoning) {
            fullThinkingResponse += data.reasoning;
          }

          // 2. Fallback: Parse <think> tags from the content (Ollama/R1 style)
          let currentContent = fullRawResponse;
          let currentThinking = fullThinkingResponse;

          const thinkStartIdx = currentContent.indexOf("<think>");
          if (thinkStartIdx !== -1) {
            const thinkEndIdx = currentContent.indexOf("</think>");
            if (thinkEndIdx !== -1) {
              // Extract thinking from tags and append to currentThinking
              const taggedThinking = currentContent.substring(thinkStartIdx + 7, thinkEndIdx).trim();
              currentThinking = (currentThinking ? currentThinking + "\n" : "") + taggedThinking;
              currentContent = currentContent.substring(0, thinkStartIdx) + currentContent.substring(thinkEndIdx + 8);
            } else {
              // Still thinking inside tags
              const taggedThinking = currentContent.substring(thinkStartIdx + 7).trim();
              currentThinking = (currentThinking ? currentThinking + "\n" : "") + taggedThinking;
              currentContent = currentContent.substring(0, thinkStartIdx);
            }
          }

          updateConversation(convoId, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId ? { ...m, content: currentContent, thinking: currentThinking || undefined } : m
            ),
          }));
        },
        requestId
      );

      if (activeRequestIdRef.current !== requestId) return;
      activeRequestIdRef.current = null;

      if (!chatResult.success) {
        throw new Error(chatResult.error || "Unknown LLM error");
      }

      updateConversation(convoId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        ),
      }));
      setIsGenerating(false);

    } catch (error: any) {
      console.error(error);

      // Don't show the error message if we're showing the RAG init dialog
      if (error instanceof Error && error.message === "RAG not initialized for this folder.") {
        updateConversation(convoId, (c) => ({
          ...c,
          messages: c.messages.filter((m) => m.id !== assistantId),
        }));
        setIsGenerating(false);
        return;
      }

      updateConversation(convoId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                isStreaming: false,
                content: m.content + `\n\n**Error:** ${error.message}`,
              }
            : m
        ),
      }));
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConvo.messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // Detect when the active conversation's model is deleted from settings.
  // Does NOT auto-swap to another model — shows an amber warning and requires
  // the user to pick a replacement explicitly from the dropdown.
  useEffect(() => {
    if (!activeConvo || !aiSettings?.customModels) return;

    // Only show warning if a model was actually selected
    if (!activeConvo.model) {
      setRemovedModelWarning(false);
      return;
    }

    const modelExists = aiSettings.customModels.some((m) => m.id === activeConvo.model);
    if (!modelExists) {
      setRemovedModelWarning(true);
    } else {
      setRemovedModelWarning(false);
    }
  }, [activeConvo, activeConvoId, aiSettings?.customModels]);

  // If settings push a new defaultModelId (e.g. user clicked "Enable"
  // in Settings → AI), sync the active conversation to match so the dropdown
  // and settings table always reflect the same selection.
  useEffect(() => {
    if (!activeConvo || !aiSettings?.defaultModelId || !aiSettings?.customModels) return;

    const defaultModelExists = aiSettings.customModels.some((m) => m.id === aiSettings.defaultModelId);
    if (!defaultModelExists || activeConvo.model === aiSettings.defaultModelId) return;

    updateConversation(activeConvoId, (c) => ({ ...c, model: aiSettings.defaultModelId! }));
  }, [activeConvo, activeConvoId, aiSettings?.customModels, aiSettings?.defaultModelId]);

  const updateConversation = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isGenerating) return;

    // Pre-send validation: check if models exist
    if (!aiSettings?.customModels?.length) {
      setModelError("No AI models configured. Please add one in Settings.");
      return;
    }

    // Clear any previous error
    setModelError("");

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: trimmed,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date(),
    };

    const convoId = activeConvoId;
    updateConversation(convoId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? trimmed.slice(0, 40) : c.title,
      messages: [...c.messages, userMessage],
    }));

    setInput("");
    setAttachments([]);
    setIsGenerating(true);

    // Give state time to update, then fire RAG
    setTimeout(() => executeRAG(convoId, trimmed), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    if (activeRequestIdRef.current) {
      (window as any).llm.abort(activeRequestIdRef.current);
      activeRequestIdRef.current = null;
    }
    setIsGenerating(false);
    updateConversation(activeConvoId, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    }));
  };

  const handleNewChat = () => {
    const newConvo: Conversation = {
      id: generateId(),
      title: "New Chat",
      messages: [],
      model: activeConvo.model,
      createdAt: new Date(),
    };
    setConversations((prev) => [newConvo, ...prev]);
    setActiveConvoId(newConvo.id);
    setInput("");
    setAttachments([]);
    setIsGenerating(false);
  };

  const handleFileUpload = async () => {
    try {
      const result = await window.fs.selectImportFiles();
      if (result.success && result.paths) {
        const newAttachments: FileAttachment[] = result.paths.map((p: string) => ({
          name: window.fs.basename(p),
          size: 0,
          type: window.fs.extname(p),
        }));
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    } catch {
      // File dialog cancelled or error
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Voice-to-text using Web Speech API
  const toggleDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput((prev) => {
        const base = prev.endsWith(" ") || prev === "" ? prev : prev + " ";
        return base + transcript;
      });
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleModelSelect = (modelId: string) => {
    updateConversation(activeConvoId, (c) => ({ ...c, model: modelId }));
    // Persist selection so new chats and Settings reflect the choice
    const setGlobal = useBoundStore.getState().settings.setGlobal;
    setGlobal("ai.defaultModelId", modelId);
  };

  const handleInitializeRag = async () => {
    const currentFolderPath = localStorage.getItem("currentFolderPath");
    if (!currentFolderPath) {
      alert("No folder open to initialize RAG.");
      return;
    }

    try {
      setIsInitializingRag(true);
      setRagInitStatus("Initializing RAG database...");

      // Generate new UUID and add directory to database
      const uuid = window.crypto.randomUUID();
      const dirResult = await window.db.addDirectory(uuid, currentFolderPath);

      if (!dirResult.success) {
        throw new Error(dirResult.error || "Failed to add directory to database");
      }

      // Ensure .localnotes/.env exists for compatibility
      const localNotesDir = window.fs.join(currentFolderPath, ".localnotes");
      await window.fs.createFolder(localNotesDir);
      await window.fs.writeFile(window.fs.join(localNotesDir, ".env"), `DIRECTORY_ID=${uuid}`);

      setRagInitStatus("Indexing files (this may take a moment)...");
      const storeResult = await window.indexer.indexDirectory(uuid, currentFolderPath);

      if (storeResult.success) {
        setRagInitStatus("Complete!");
        setShowRagInitDialog(false);

        // Retry the original query
        if (activeConvoId && pendingUserText) {
          setTimeout(() => {
            executeRAG(activeConvoId, pendingUserText);
            setPendingUserText("");
          }, 500);
        }
      } else {
        throw new Error(storeResult.error || "Failed to index directory");
      }
    } catch (error) {
      console.error("RAG Init Error:", error);
      alert(`Failed to initialize RAG: ${error}`);
    } finally {
      setIsInitializingRag(false);
      setRagInitStatus("");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-secondary">
      {/* ── Settings Load Error Banner ── */}
      {settingsLoadError && (
        <div className="flex-shrink-0 px-4 py-3 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-700/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RiInformationLine className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200">
                Failed to load settings: {settingsLoadError}
              </p>
            </div>
            <button
              onClick={() => retrySettingsLoad()}
              className="ml-auto px-2 py-1 text-xs font-medium rounded bg-red-600/10 hover:bg-red-600/20 text-red-700 dark:text-red-300 transition-colors flex-shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-secondary">
        <div className="flex items-center gap-3">
          <ModelSelector selectedModel={activeConvo.model} onSelect={handleModelSelect} />

          {/* Thinking Toggle — only shown if model supports it */}
          {caps.thinking && (
            <button
              onClick={() => setThinkingEnabled((t) => !t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                thinkingEnabled
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title={thinkingEnabled ? "Thinking enabled" : "Thinking disabled"}
            >
              {thinkingEnabled ? (
                <LuBrainCircuit className="w-4 h-4" />
              ) : (
                <LuBrain className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Thinking</span>
            </button>
          )}
        </div>

        {/* New Chat */}
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted transition-colors"
          title="New Chat"
        >
          <RiAddLine className="w-4 h-4" />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>

      {/* ── Removed Model Warning ── */}
      {removedModelWarning && (
        <div className="flex-shrink-0 px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-700/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RiInformationLine className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                The selected model was removed. {aiSettings?.customModels?.length ? 'Please choose a replacement.' : 'Please add a model in AI Settings.'}
              </p>
            </div>
            {aiSettings?.customModels?.length ? (
              <button
                onClick={() => {
                  if (aiSettings.customModels[0]) {
                    handleModelSelect(aiSettings.customModels[0].id);
                  }
                }}
                className="ml-auto px-2 py-1 text-xs font-medium rounded bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 dark:text-amber-300 transition-colors flex-shrink-0"
              >
                Switch Model
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4">
        {aiSettings?.customModels?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-destructive">
              <RiRobot2Line className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No AI Models Configured
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                You currently don't have any LLMs enabled to process your notes. Please add a model in the AI Settings to chat with your documents.
              </p>
              {onOpenAiSettings && (
                <Button
                  onClick={onOpenAiSettings}
                  className="mt-4"
                >
                  <RiAddLine className="w-4 h-4 mr-2" />
                  Add AI Model
                </Button>
              )}
            </div>
          </div>
        ) : activeConvo.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <RiRobot2Line className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Local AI Assistant
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ask questions about your notes, get summaries, generate content, or just
                chat. Select your preferred local model above.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {[
                "Summarize my notes",
                "Help me brainstorm",
                "Explain this concept",
                "Rewrite this paragraph",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          activeConvo.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} thinkingEnabled={thinkingEnabled} />
          ))
        )}
      </div>

      {/* ── Attachments Preview ── */}
      {attachments.length > 0 && (
        <div className="flex-shrink-0 flex gap-2 px-4 pt-2 flex-wrap">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs group"
            >
              <RiFileLine className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
              >
                <RiCloseLine className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Input Area ── */}
      {modelError && (
        <div className="flex-shrink-0 px-4 pt-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100/20 border border-amber-600/30 text-sm text-amber-800 dark:text-amber-200">
            <RiInformationLine className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{modelError}</span>
            {onOpenAiSettings && (
              <button
                onClick={onOpenAiSettings}
                className="ml-auto px-2 py-1 text-xs font-medium rounded hover:bg-amber-600/10 transition-colors"
              >
                Add Model
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex-shrink-0 px-4 pb-3 pt-2">
        <div className="flex items-end gap-2 bg-background border border-border rounded-2xl px-3 py-2 focus-within:ring-1 focus-within:ring-accent/40 transition-shadow">
          {/* File Upload — only shown if model supports it */}
          {caps.fileUpload && (
            <button
              onClick={handleFileUpload}
              className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Attach files"
            >
              <RiAttachmentLine className="w-5 h-5" />
            </button>
          )}

          {/* Voice — only shown if model supports it */}
          {caps.voice && (
            <button
              onClick={toggleDictation}
              className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                isListening
                  ? "text-destructive bg-destructive/10 animate-pulse"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title={isListening ? "Stop dictation" : "Start dictation"}
            >
              {isListening ? (
                <RiMicOffLine className="w-5 h-5" />
              ) : (
                <RiMicLine className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Text Input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none max-h-40 py-1.5"
          />

          {/* Send / Stop */}
          {isGenerating ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              title="Stop generating"
            >
              <RiStopCircleLine className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0}
              className="flex-shrink-0 p-1.5 rounded-lg bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              title="Send message"
            >
              <RiSendPlaneFill className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          Responses are generated by your local LLM. Connect Ollama or a compatible server to get started.
        </p>
      </div>

      {/* RAG Initialization Modal */}
      {showRagInitDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !isInitializingRag && setShowRagInitDialog(false)}
        >
          <div 
            className="bg-background border border-border rounded-lg shadow-xl w-[450px] overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <LuBrainCircuit className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-semibold">Initialize AI Search</h2>
              </div>
              <button
                onClick={() => !isInitializingRag && setShowRagInitDialog(false)}
                disabled={isInitializingRag}
                className="rounded-md p-1 hover:bg-accent transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                To provide answers based on your notes, the AI needs to index this folder.
                This will create a hidden <code className="bg-muted px-1 rounded font-mono text-xs">.localnotes</code> folder inside your project.
              </p>

              {isInitializingRag ? (
                <div className="py-6 flex flex-col items-center justify-center gap-4 bg-muted/30 rounded-lg border border-dashed border-border">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                  <p className="text-sm font-medium animate-pulse">{ragInitStatus}</p>
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-lg flex gap-3 border border-border">
                  <RiInformationLine className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Indexing involves breaking your notes into small chunks and generating 
                    embeddings (mathematical representations) for each. This stays 100% local.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-muted/20 border-t border-border flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowRagInitDialog(false)}
                disabled={isInitializingRag}
                className="h-9"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleInitializeRag}
                disabled={isInitializingRag}
                className="h-9 min-w-[120px]"
              >
                {isInitializingRag ? "Initializing..." : "Initialize & Index"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
