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
} from "react-icons/ri";
import { LuBrain, LuBrainCircuit } from "react-icons/lu";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { DEFAULT_MODEL_CAPABILITIES } from "@/renderer/store/settings-slice";

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

const MODEL_OPTIONS = [
  { id: "llama3.2", name: "Llama 3.2", provider: "Ollama" },
  { id: "mistral", name: "Mistral", provider: "Ollama" },
  { id: "gemma2", name: "Gemma 2", provider: "Ollama" },
  { id: "phi3", name: "Phi-3", provider: "Ollama" },
  { id: "codellama", name: "Code Llama", provider: "Ollama" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "Ollama" },
  { id: "qwen2.5", name: "Qwen 2.5", provider: "Ollama" },
  { id: "llava", name: "LLaVA (Vision)", provider: "Ollama" },
];

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = MODEL_OPTIONS.find((m) => m.id === selectedModel) ?? MODEL_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted transition-colors"
      >
        <span className="truncate max-w-[140px]">{current.name}</span>
        <RiArrowDownSLine
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-background border border-border rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {MODEL_OPTIONS.map((model) => (
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

export default function AIChatPanel() {
  const aiSettings = useBoundStore((s) => s.settings.global?.ai);

  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: generateId(),
      title: "New Chat",
      messages: [],
      model: "llama3.2",
      createdAt: new Date(),
    },
  ]);
  const [activeConvoId, setActiveConvoId] = useState(conversations[0].id);
  const [input, setInput] = useState("");
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isListening, setIsListening] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const activeConvo = conversations.find((c) => c.id === activeConvoId)!;

  // Derive capabilities for the active model
  const caps = (
    aiSettings?.modelConfigs?.[activeConvo.model]?.capabilities ??
    DEFAULT_MODEL_CAPABILITIES[activeConvo.model] ??
    { fileUpload: false, voice: true, thinking: false }
  );

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

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

  const updateConversation = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  };

  // Simulated AI response for UI demo
  const simulateResponse = (convoId: string) => {
    const assistantId = generateId();
    const thinkingText = thinkingEnabled
      ? "Let me analyze your question carefully...\nConsidering the context of your notes and the specific request...\nFormulating a comprehensive response..."
      : undefined;

    updateConversation(convoId, (c) => ({
      ...c,
      messages: [
        ...c.messages,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          thinking: thinkingText,
          timestamp: new Date(),
          isStreaming: true,
        },
      ],
    }));

    const demoResponse =
      "This is a **demo response** from the AI assistant. Once connected to a local LLM like **Ollama**, responses will stream here in real-time.\n\nYou can:\n- Ask questions about your notes\n- Get summaries\n- Generate content\n- And much more!";

    let index = 0;
    const interval = setInterval(() => {
      index += 3;
      const partial = demoResponse.slice(0, index);
      updateConversation(convoId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === assistantId ? { ...m, content: partial } : m
        ),
      }));

      if (index >= demoResponse.length) {
        clearInterval(interval);
        updateConversation(convoId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          ),
        }));
        setIsGenerating(false);
      }
    }, 25);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isGenerating) return;

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

    setTimeout(() => simulateResponse(convoId), 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
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
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-secondary">
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

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4">
        {activeConvo.messages.length === 0 ? (
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
    </div>
  );
}
