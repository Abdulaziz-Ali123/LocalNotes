/**
 * File: renderer/pages/quiz/host.tsx
 * Author: Atharva Patil
 * Sprint: 5
 * Purpose: Host control console for creating and running LAN quiz sessions.
 * Notes: Consumes `window.quiz` IPC bridge and reacts to live session update events.
 */


import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { Button } from "@/renderer/components/ui/button";
import { useRouter } from "next/router";

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

// Host page for creating and controlling a live quiz session.
export default function QuizHostPage() {
  const router = useRouter();
  const [hostName, setHostName] = useState("Host");
  const [questionTimeSec, setQuestionTimeSec] = useState(20);
  const [questionsJson, setQuestionsJson] = useState(DEFAULT_QUESTIONS);
  const [code, setCode] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Subscribes to live session updates from the main process.
  useEffect(() => {
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

  // Creates a new quiz session from host form values.
  const createSession = async () => {
    try {
      setError("");
      const questions = JSON.parse(questionsJson);
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

  // Starts the current session and moves to the first question.
  const startQuiz = async () => {
    if (!code) return;
    const result = await window.quiz.startQuiz(code);
    if (!result.success) setError(result.error || "Unable to start quiz.");
  };

  // Moves from round results to the next question.
  const nextQuestion = async () => {
    if (!code) return;
    const result = await window.quiz.nextQuestion(code);
    if (!result.success) setError(result.error || "Unable to advance question.");
  };

  // Ends the quiz and shows the final leaderboard.
  const endQuiz = async () => {
    if (!code) return;
    const result = await window.quiz.endQuiz(code);
    if (!result.success) setError(result.error || "Unable to end quiz.");
  };

  // Computes top 5 leaderboard data for the current view.
  const top5 = useMemo(() => {
    if (!snapshot) return [];
    if (snapshot.roundResult?.top5) return snapshot.roundResult.top5;
    return [...snapshot.players]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((p) => ({ ...p, playerId: p.id }));
  }, [snapshot]);

  return (
    <>
      <Head>
        <title>Quiz Host</title>
      </Head>

      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Quiz Host Console</h1>
            <Button variant="outline" onClick={() => router.push("/home")}>Back</Button>
          </div>

          {!code ? (
            <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
              <div>
                <label className="block mb-1">Host Name</label>
                <input
                  className="w-full rounded border border-slate-600 bg-slate-800 p-2"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1">Question Time (seconds)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  className="w-full rounded border border-slate-600 bg-slate-800 p-2"
                  value={questionTimeSec}
                  onChange={(e) => setQuestionTimeSec(Number(e.target.value || 20))}
                />
              </div>
              <div>
                <label className="block mb-1">Questions JSON</label>
                <textarea
                  className="h-72 w-full rounded border border-slate-600 bg-slate-800 p-2 font-mono text-xs"
                  value={questionsJson}
                  onChange={(e) => setQuestionsJson(e.target.value)}
                />
              </div>
              <Button onClick={createSession}>Create Session</Button>
            </section>
          ) : null}

          {code ? (
            <section className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
                <h2 className="text-lg font-semibold">Join Details</h2>
                <p>Game Code: <strong>{code}</strong></p>
                <p className="break-all">Join Link: {joinUrl}</p>
                {qrDataUrl ? <img src={qrDataUrl} alt="QR code" className="h-52 w-52 rounded bg-white p-2" /> : null}
                <div className="flex gap-2">
                  <Button onClick={startQuiz} disabled={snapshot?.state === "question" || snapshot?.state === "ended"}>Start Quiz</Button>
                  <Button onClick={nextQuestion} disabled={snapshot?.state !== "round_result"}>Next Question</Button>
                  <Button variant="destructive" onClick={endQuiz} disabled={snapshot?.state === "ended"}>End Quiz</Button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
                <h2 className="text-lg font-semibold">Session State</h2>
                <p>Status: {snapshot?.state}</p>
                <p>Players: {snapshot?.players.length || 0}</p>
                {secondsLeft !== null ? <p>Time Left: {secondsLeft}s</p> : null}
                {snapshot?.currentQuestion ? (
                  <div className="rounded border border-slate-700 p-3">
                    <p className="font-medium">Q{(snapshot.currentQuestionIndex || 0) + 1}: {snapshot.currentQuestion.prompt}</p>
                    <ul className="list-disc list-inside text-sm mt-2">
                      {snapshot.currentQuestion.options.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {snapshot ? (
            <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-2">
              <h3 className="font-semibold">Round Top 5</h3>
              {top5.length === 0 ? <p className="text-sm text-slate-300">No scores yet.</p> : null}
              {top5.map((entry, index) => (
                <div key={entry.playerId} className="flex justify-between rounded bg-slate-800 p-2 text-sm">
                  <span>{index + 1}. {entry.name}</span>
                  <span>{entry.score}</span>
                </div>
              ))}

              {snapshot.roundResult ? <p className="text-sm">Correct answer: <strong>{snapshot.roundResult.correctAnswer}</strong></p> : null}

              {snapshot.finalLeaderboard ? (
                <div className="pt-4">
                  <h3 className="font-semibold">Final Leaderboard</h3>
                  {snapshot.finalLeaderboard.map((entry, index) => (
                    <div key={entry.playerId} className="flex justify-between rounded bg-slate-800 p-2 text-sm mt-1">
                      <span>{index + 1}. {entry.name}</span>
                      <span>{entry.score}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {error ? <p className="text-red-400">{error}</p> : null}
        </div>
      </main>
    </>
  );
}
