/**
 * File: renderer/pages/quiz/host.tsx
 * Author: Atharva Patil
 * Git-history contributors: a157p624
 * Sprint: 5
 * Purpose: Host control console for creating and running LAN quiz sessions.
 * Notes: Consumes `window.quiz` IPC bridge and reacts to live session update events.
 */


import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { Button } from "@/renderer/components/ui/button";
import { useRouter } from "next/router";
import { Brain, FileText, Loader2, ArrowLeft, Play } from "lucide-react";
import { useBoundStore } from "@/renderer/store/useBoundStore";
import { extractJsonFromLLMResponse } from "@/renderer/lib/extractJson";
import QuizConfigForm, {
  DEFAULT_QUIZ_CONFIG,
  type QuizConfig,
} from "@/renderer/components/quiz/QuizConfigForm";
import { buildQuizSystemPrompt, buildQuizUserPrompt } from "@/renderer/lib/quizPrompts";

type LeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
  correctCount: number;
};

type Snapshot = {
  code: string;
  hostName: string;
  state: "lobby" | "question" | "round_result" | "ended";
  questionTimeSec: number;
  currentQuestionIndex: number;
  currentQuestion: { id: string; prompt: string; options: string[] } | null;
  currentQuestionEndsAt: number | null;
  players: { id: string; name: string; score: number; correctCount: number }[];
  roundResult: { questionId: string; correctAnswer: string; top5: LeaderboardEntry[]; full: LeaderboardEntry[] } | null;
  finalLeaderboard: LeaderboardEntry[] | null;
};

const DEFAULT_QUESTIONS = JSON.stringify(
  [
    {
      id: "q1",
      prompt: "Which layer provides secure web transport?",
      options: ["HTTP", "TLS", "FTP", "SMTP"],
      correctAnswer: "TLS",
    },
    {
      id: "q2",
      prompt: "2 + 2 equals?",
      options: ["3", "4", "5", "6"],
      correctAnswer: "4",
    },
  ],
  null,
  2
);

type HostMode = "choose" | "generate" | "manual" | "ready";

// Host page for creating and controlling a live quiz session.
export default function QuizHostPage() {
  const router = useRouter();
  const [hostMode, setHostMode] = useState<HostMode>("choose");
  const [hostName, setHostName] = useState("Host");
  const [questionTimeSec, setQuestionTimeSec] = useState(20);
  const [questionsJson, setQuestionsJson] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [quizConfig, setQuizConfig] = useState<QuizConfig>(DEFAULT_QUIZ_CONFIG);

  const aiSettings = useBoundStore((s) => s.settings.global?.ai);

  const [code, setCode] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Subscribes to live session updates from the main process.
  useEffect(() => {
    if (typeof window === "undefined" || !window.quiz) return;
    const unsubscribe = window.quiz.onSessionUpdated((payload) => {
      if (payload.code !== code) return;
      setSnapshot(payload.snapshot as Snapshot);
    });

    return () => {
      unsubscribe?.();
    };
  }, [code]);

  // Updates the visible countdown while a question timer is active.
  useEffect(() => {
    if (!snapshot?.currentQuestionEndsAt) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((snapshot.currentQuestionEndsAt! - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.currentQuestionEndsAt]);

  /** Resolve the first available model ID */
  const getFirstModelId = async (): Promise<string | null> => {
    if (aiSettings?.customModels?.length) {
      return aiSettings.defaultModelId || aiSettings.customModels[0].id;
    }
    try {
      const globalSettings = await (window as any).settings.getGlobal();
      if (globalSettings?.ai?.customModels?.length) {
        return globalSettings.ai.defaultModelId || globalSettings.ai.customModels[0].id;
      }
      const llmModels = globalSettings?.llm?.models;
      if (llmModels && Object.keys(llmModels).length > 0) {
        return globalSettings.llm.defaultModelId || null;
      }
    } catch { /* ignore */ }
    return null;
  };

  /** Generate quiz questions using the LLM */
  const handleAIGenerate = async () => {
    try {
      setIsGenerating(true);
      setGenError("");

      const modelId = await getFirstModelId();
      if (!modelId) {
        throw new Error("No AI model configured. Please add one in Settings → AI.");
      }

      const currentFolderPath = localStorage.getItem("currentFolderPath");
      if (!currentFolderPath) throw new Error("No folder open. Go back and open a folder first.");

      const idRes = await window.db.getDirectoryIdByPath(currentFolderPath);
      const directoryId = idRes?.success ? idRes.data : null;

      if (!directoryId) {
        throw new Error("Directory not indexed for RAG. Open the folder from the home page first.");
      }

      const contextRes = await window.rag.retrieveContext(directoryId, "quiz", 10);
      const ragChunks = contextRes?.success && contextRes?.contextText ? contextRes.contextText : "No local notes found.";

      const systemPrompt = buildQuizSystemPrompt(quizConfig.questionTypes);
      const userPrompt = buildQuizUserPrompt({
        ragChunks,
        mode: "quiz",
        topic: quizConfig.topic,
        difficulty: quizConfig.difficulty,
        numItems: quizConfig.numItems,
        questionTypes: quizConfig.questionTypes,
      });

      const chatResult = await (window as any).llm.chat(modelId, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], false);

      if (!chatResult.success) {
        throw new Error(chatResult.error || "LLM request failed.");
      }

      const parsed = extractJsonFromLLMResponse(chatResult.content);

      // Convert to host format (LAN session uses a slightly different structure)
      const hostQuestions = (parsed.items || []).map((q: any) => ({
        id: String(q.id),
        prompt: q.question,
        options: q.options || (q.kind === 'true_false' ? ["True", "False"] : []),
        correctAnswer: q.answer !== undefined ? String(q.answer) : (q.kind === 'true_false' ? String(q.answer) : ""),
      }));

      const json = JSON.stringify(hostQuestions, null, 2);
      setQuestionsJson(json);
      localStorage.setItem("host_questions_json", json);
      setHostMode("ready");

    } catch (err: any) {
      console.error(err);
      setGenError(err.message || "Failed to generate.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Creates a new quiz session from host form values.
  const createSession = async () => {
    try {
      setError("");
      const questions = JSON.parse(questionsJson);
      if (!window.quiz) throw new Error("Quiz API not available");
      const result = await window.quiz.createSession({ hostName, questionTimeSec, questions });
      if (!result.success) {
        setError(result.error || "Failed to create session.");
        return;
      }

      setCode(result.data.code);
      setJoinUrl(result.data.joinUrl);
      setQrDataUrl(result.data.qrDataUrl);
      setSnapshot(result.data.snapshot as Snapshot);
    } catch (e: any) {
      setError(e.message || "Invalid questions JSON.");
    }
  };

  const startQuiz = async () => {
    if (!code) return;
    if (!window.quiz) return;
    const result = await window.quiz.startQuiz(code);
    if (!result.success) setError(result.error || "Unable to start quiz.");
  };

  const nextQuestion = async () => {
    if (!code) return;
    if (!window.quiz) return;
    const result = await window.quiz.nextQuestion(code);
    if (!result.success) setError(result.error || "Unable to advance question.");
  };

  const endSession = async () => {
    if (!code) return;
    if (!window.quiz) return;
    await window.quiz.endQuiz(code);
    router.push("/quiz");
  };

  if (snapshot) {
    return (
      <div className="flex h-screen flex-col bg-background p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quiz Session: {code}</h1>
            <p className="text-muted-foreground">Host: {snapshot.hostName}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={endSession}>End Session</Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto rounded-xl border bg-card p-6 shadow-sm">
          {snapshot.state === "lobby" && (
            <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
              <div className="space-y-2">
                <h2 className="text-4xl font-black text-primary">LOBBY</h2>
                <p className="text-xl">Waiting for players to join...</p>
              </div>

              {qrDataUrl && (
                <div className="rounded-2xl border-4 border-primary bg-white p-4 shadow-xl">
                  <img src={qrDataUrl} alt="Join QR Code" className="h-64 w-64" />
                </div>
              )}

              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Join Link</p>
                <code className="rounded bg-accent px-4 py-2 text-lg font-bold">{joinUrl}</code>
              </div>

              <div className="w-full max-w-md space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-semibold">{snapshot.players.length} Players Joined</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {snapshot.players.map((p) => (
                    <div key={p.id} className="rounded-lg bg-accent/50 px-4 py-2 text-sm font-medium">
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>

              <Button size="lg" className="px-12 py-6 text-xl" onClick={startQuiz} disabled={snapshot.players.length === 0}>
                Start Quiz
              </Button>
            </div>
          )}

          {snapshot.state === "question" && (
            <div className="flex flex-col gap-8 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-tighter">
                  Question {snapshot.currentQuestionIndex + 1}
                </span>
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-primary">
                  <span className="text-xl font-black">{secondsLeft ?? "--"}</span>
                  <span className="text-xs font-bold uppercase">Seconds Left</span>
                </div>
              </div>

              <div className="space-y-6 text-center">
                <h2 className="text-4xl font-bold">{snapshot.currentQuestion?.prompt}</h2>
                <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4">
                  {snapshot.currentQuestion?.options.map((opt, i) => (
                    <div key={i} className="rounded-xl border-2 border-primary/20 bg-accent/30 p-4 text-xl font-medium">
                      {opt}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6">
                <p className="text-center font-medium text-muted-foreground">
                  {snapshot.players.length} players connected
                </p>
              </div>
            </div>
          )}

          {snapshot.state === "round_result" && snapshot.roundResult && (
            <div className="flex flex-col gap-8 py-4">
              <div className="text-center space-y-4">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Answer revealed</h2>
                <p className="text-3xl font-bold">Correct Answer: <span className="text-green-500">{snapshot.roundResult.correctAnswer}</span></p>
              </div>

              <div className="mx-auto w-full max-w-2xl space-y-4">
                <h3 className="text-center text-xl font-bold">Round Leaderboard</h3>
                <div className="space-y-2">
                  {snapshot.roundResult.top5.map((p, i) => (
                    <div key={p.playerId} className="flex items-center justify-between rounded-xl bg-accent p-4">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black opacity-20">#{i + 1}</span>
                        <span className="text-lg font-bold">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-primary">{p.score} pts</div>
                        <div className="text-xs text-muted-foreground">{p.correctCount} correct</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button size="lg" className="mx-auto block px-12" onClick={nextQuestion}>
                Next Question
              </Button>
            </div>
          )}

          {snapshot.state === "ended" && snapshot.finalLeaderboard && (
            <div className="flex flex-col items-center gap-8 py-8">
              <div className="text-center space-y-2">
                <h2 className="text-5xl font-black text-primary">QUIZ FINISHED</h2>
                <p className="text-xl text-muted-foreground">Here are the final standings</p>
              </div>

              <div className="w-full max-w-2xl space-y-3">
                {snapshot.finalLeaderboard.map((p, i) => (
                  <div key={p.playerId} className={i === 0 ? "scale-105 border-2 border-primary rounded-2xl bg-primary/10 p-6 flex items-center justify-between" : "flex items-center justify-between rounded-xl bg-accent p-4 opacity-80"}>
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-black opacity-30">#{i + 1}</span>
                      <span className="text-xl font-bold">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black">{p.score}</div>
                      <div className="text-sm text-muted-foreground">{p.correctCount} correct answers</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="lg" onClick={() => router.push("/quiz")}>
                Back to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background p-6">
      <Head>
        <title>Host Quiz | LocalNotes</title>
      </Head>

      <header className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/quiz")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black">Host Quiz Session</h1>
          <p className="text-muted-foreground">Setup a live session for local network players</p>
        </div>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-6">
          {/* Step 1: Questions Source */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">1. Choose Questions</h2>

            {hostMode === "choose" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setHostMode("generate")}
                  className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 transition-colors hover:bg-accent/50 group"
                >
                  <div className="rounded-full bg-purple-500/10 p-4 group-hover:bg-purple-500/20">
                    <Brain className="h-8 w-8 text-purple-500" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold">Generate with AI</div>
                    <div className="text-xs text-muted-foreground">Build from local notes</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setQuestionsJson(DEFAULT_QUESTIONS);
                    setHostMode("manual");
                  }}
                  className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 transition-colors hover:bg-accent/50 group"
                >
                  <div className="rounded-full bg-blue-500/10 p-4 group-hover:bg-blue-500/20">
                    <FileText className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="text-center">
                    <div className="font-bold">Enter JSON Manually</div>
                    <div className="text-xs text-muted-foreground">Paste your own quiz data</div>
                  </div>
                </button>
              </div>
            )}

            {hostMode === "generate" && (
              <QuizConfigForm
                config={quizConfig}
                onChange={setQuizConfig}
                onGenerate={handleAIGenerate}
                onCancel={() => setHostMode("choose")}
                isGenerating={isGenerating}
                mode="quiz"
              />
            )}

            {hostMode === "manual" && (
              <div className="space-y-4">
                <textarea
                  className="h-64 w-full rounded-xl border bg-background p-4 font-mono text-sm"
                  value={questionsJson}
                  onChange={(e) => setQuestionsJson(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setHostMode("choose")}>Cancel</Button>
                  <Button onClick={() => setHostMode("ready")}>Use these questions</Button>
                </div>
              </div>
            )}

            {hostMode === "ready" && (
              <div className="flex items-center justify-between rounded-xl bg-green-500/10 p-4 text-green-600 border border-green-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-bold">Questions Loaded ({JSON.parse(questionsJson || "[]").length} items)</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setHostMode("choose")}>Change</Button>
              </div>
            )}

            {genError && <p className="mt-4 text-sm font-medium text-red-500">{genError}</p>}
          </div>

          {/* Step 2: Settings */}
          <div className={`rounded-2xl border bg-card p-6 shadow-sm transition-opacity ${hostMode !== "ready" ? "opacity-50 pointer-events-none" : ""}`}>
            <h2 className="mb-4 text-xl font-bold">2. Session Settings</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-tight">Host Display Name</label>
                <input
                  type="text"
                  className="w-full rounded-xl border bg-background px-4 py-3"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-tight">Time per question (seconds)</label>
                <input
                  type="number"
                  className="w-full rounded-xl border bg-background px-4 py-3"
                  value={questionTimeSec}
                  onChange={(e) => setQuestionTimeSec(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border bg-card p-12 text-center shadow-inner">
            <Play className={`h-16 w-16 mb-4 ${hostMode === "ready" ? "text-primary" : "text-muted-foreground opacity-20"}`} />
            <h3 className="text-2xl font-bold">Ready to Launch?</h3>
            <p className="mb-8 text-muted-foreground">Players will join using a code or QR code once you start.</p>

            {error && <p className="mb-4 font-bold text-red-500">{error}</p>}

            <Button
              size="lg"
              className="w-full max-w-sm py-8 text-2xl font-black shadow-xl"
              disabled={hostMode !== "ready"}
              onClick={createSession}
            >
              CREATE SESSION
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
