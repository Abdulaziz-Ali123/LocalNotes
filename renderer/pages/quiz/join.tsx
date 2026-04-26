/**
 * File: renderer/pages/quiz/join.tsx
 * Author: Atharva Patil
 * Git-history contributors: a157p624
 * Sprint: 5
 * Purpose: Player join-and-play UI over local WebSocket transport.
 * Notes: Handles join, answer submission, and live snapshot rendering.
 */


import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { Button } from "@/renderer/components/ui/button";
import { useRouter } from "next/router";

type LeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
};

type Snapshot = {
  code: string;
  state: "lobby" | "question" | "round_result" | "ended";
  currentQuestion: { id: string; prompt: string; options: string[] } | null;
  currentQuestionEndsAt: number | null;
  roundResult: { top5: LeaderboardEntry[]; correctAnswer: string } | null;
  finalLeaderboard: LeaderboardEntry[] | null;
};

// Player page for joining and participating in a live quiz session.
/**
 * Functionality: QuizJoinPage performs the quiz join page workflow used by renderer/pages/quiz/join.tsx.
 * Parameters: None.
 * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
 * Usage: Call QuizJoinPage from the owning module or component when this behavior is required.
 */
export default function QuizJoinPage() {
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);

  const [host, setHost] = useState("127.0.0.1:9898");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Prefills the game code when opened from a join link containing ?code=.
  useEffect(() => {
    if (!router.isReady) return;
    const queryCode = typeof router.query.code === "string" ? router.query.code : "";
    if (queryCode) {
      setCode(queryCode.toUpperCase());
    }
  }, [router.isReady, router.query.code]);

  // Updates the visible countdown while the current question is active.
  useEffect(() => {
    if (!snapshot?.currentQuestionEndsAt) {
      setSecondsLeft(null);
      return;
    }

        /**
     * Functionality: tick performs the tick workflow used by renderer/pages/quiz/join.tsx.
     * Parameters: None.
     * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
     * Usage: Call tick from the owning module or component when this behavior is required.
     */
const tick = () => {
      const remaining = Math.max(0, Math.ceil((snapshot.currentQuestionEndsAt! - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.currentQuestionEndsAt]);

  // Opens a WebSocket connection and attempts to join the selected session.
    /**
   * Functionality: joinSession performs the join session workflow used by renderer/pages/quiz/join.tsx.
   * Parameters: None.
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call joinSession from the owning module or component when this behavior is required.
   */
const joinSession = () => {
    setError("");
    setSelectedAnswer("");

    if (!code || !name) {
      setError("Enter a game code and unique name.");
      return;
    }

    const ws = new WebSocket(`ws://${host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", code: code.toUpperCase(), name }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "joinResult") {
        if (!data.ok) {
          setError(data.error || "Failed to join session.");
          return;
        }

        setPlayerId(data.playerId || "");
        setSnapshot(data.snapshot || null);
      }

      if (data.type === "sessionUpdate") {
        setSnapshot(data.snapshot || null);
        if (data.snapshot?.state !== "question") {
          setSelectedAnswer("");
        }
      }

      if (data.type === "error") {
        setError(data.error || "Something went wrong.");
      }
    };

    ws.onerror = () => {
      setError("Unable to connect to quiz server.");
    };
  };

  // Sends the player's selected answer for the current question.
    /**
   * Functionality: submitAnswer performs the submit answer workflow used by renderer/pages/quiz/join.tsx.
   * Parameters: answer (string).
   * Returns: Returns the value produced by the implementation, or void when used as an event handler or side-effect routine.
   * Usage: Call submitAnswer from the owning module or component when this behavior is required.
   */
const submitAnswer = (answer: string) => {
    if (!wsRef.current || !playerId || !snapshot) return;
    setSelectedAnswer(answer);
    wsRef.current.send(
      JSON.stringify({
        type: "submitAnswer",
        code: snapshot.code,
        playerId,
        answer,
      })
    );
  };

  // Computes a user-facing status label from the current session state.
  const statusLabel = useMemo(() => {
    if (!snapshot) return "Not connected";
    if (snapshot.state === "lobby") return "Waiting for host";
    if (snapshot.state === "question") return "Answer now";
    if (snapshot.state === "round_result") return "Round complete";
    return "Quiz ended";
  }, [snapshot]);

  return (
    <>
      <Head>
        <title>Join Quiz</title>
      </Head>

      <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Join Quiz Session</h1>
            <Button variant="outline" onClick={() => router.push("/home")}>Back</Button>
          </div>

          {!snapshot ? (
            <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
              <p className="text-sm text-slate-300">Join with game code, or scan QR from host then open the generated link.</p>
              <div>
                <label className="block mb-1">Host Address</label>
                <input
                  className="w-full rounded border border-slate-600 bg-slate-800 p-2"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.25:9898"
                />
              </div>
              <div>
                <label className="block mb-1">Game Code</label>
                <input
                  className="w-full rounded border border-slate-600 bg-slate-800 p-2 uppercase"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="block mb-1">Unique Name</label>
                <input
                  className="w-full rounded border border-slate-600 bg-slate-800 p-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <Button onClick={joinSession}>Join Game</Button>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h2 className="text-lg font-semibold">{statusLabel}</h2>
            {secondsLeft !== null ? <p>Time Left: {secondsLeft}s</p> : null}

            {snapshot?.state === "question" && snapshot.currentQuestion ? (
              <div className="space-y-2">
                <p className="font-medium">{snapshot.currentQuestion.prompt}</p>
                <div className="grid gap-2">
                  {snapshot.currentQuestion.options.map((option) => (
                    <button
                      key={option}
                      className={`rounded border p-2 text-left ${selectedAnswer === option ? "border-emerald-400 bg-emerald-900/20" : "border-slate-600 bg-slate-800"}`}
                      onClick={() => submitAnswer(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {snapshot?.roundResult ? (
              <div className="space-y-2">
                <p className="text-sm">Correct answer: <strong>{snapshot.roundResult.correctAnswer}</strong></p>
                <h3 className="font-semibold">Top 5</h3>
                {snapshot.roundResult.top5.map((entry, index) => (
                  <div key={entry.playerId} className="flex justify-between rounded bg-slate-800 p-2 text-sm">
                    <span>{index + 1}. {entry.name}</span>
                    <span>{entry.score}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {snapshot?.finalLeaderboard ? (
              <div className="space-y-2">
                <h3 className="font-semibold">Final Leaderboard</h3>
                {snapshot.finalLeaderboard.map((entry, index) => (
                  <div key={entry.playerId} className="flex justify-between rounded bg-slate-800 p-2 text-sm">
                    <span>{index + 1}. {entry.name}</span>
                    <span>{entry.score}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {error ? <p className="text-red-400">{error}</p> : null}
        </div>
      </main>
    </>
  );
}
