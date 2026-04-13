/**
 * File: main/quiz/quizSessionManager.ts
 * Author: Atharva Patil
 * Sprint: 5
 * Purpose: In-memory quiz session lifecycle and scoring engine.
 * Notes: Emits session snapshots on every state transition; no persistent session recovery.
 */


import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import {
  CreateSessionInput,
  JoinResult,
  LeaderboardEntry,
  QuizPlayer,
  QuizSession,
  SessionSnapshot,
  SubmitResult,
} from "./types";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const BASE_CORRECT_POINTS = 1000;
const MAX_SPEED_BONUS = 500;

// Normalizes player names for case-insensitive uniqueness checks.
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// Generates a unique 6-character game code that is not already in use.
function createCode(used: Set<string>): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 })
      .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
      .join("");
  } while (used.has(code));
  return code;
}

// Sorts players into leaderboard order and maps to leaderboard entries.
function rankPlayers(players: QuizPlayer[]): LeaderboardEntry[] {
  return [...players]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return a.totalResponseMs - b.totalResponseMs;
    })
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      score: p.score,
      correctCount: p.correctCount,
      totalResponseMs: p.totalResponseMs,
    }));
}

export class QuizSessionManager extends EventEmitter {
  private sessions = new Map<string, QuizSession>();
  private roundTimers = new Map<string, NodeJS.Timeout>();
  private gcTimer: NodeJS.Timeout;

  // Starts the manager and periodic stale-session cleanup.
  constructor() {
    super();
    this.gcTimer = setInterval(() => this.cleanupStaleSessions(), 60_000);
  }

  // Stops timers and clears all in-memory quiz data.
  shutdown(): void {
    this.roundTimers.forEach((timer) => clearTimeout(timer));
    this.roundTimers.clear();
    clearInterval(this.gcTimer);
    this.sessions.clear();
  }

  // Creates a new quiz session and returns host/session details.
  createSession(input: CreateSessionInput): { code: string; hostId: string; snapshot: SessionSnapshot } {
    const used = new Set(this.sessions.keys());
    const code = createCode(used);
    const hostId = randomUUID();

    const normalizedQuestions = input.questions
      .filter((q) => q.prompt && q.options?.length >= 2 && q.correctAnswer)
      .map((q, i) => ({
        id: q.id || `q-${i + 1}`,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
      }));

    const session: QuizSession = {
      code,
      hostId,
      hostName: input.hostName.trim() || "Host",
      createdAt: Date.now(),
      state: "lobby",
      settings: { questionTimeSec: Math.max(5, Math.min(300, input.questionTimeSec || 20)) },
      questions: normalizedQuestions,
      currentQuestionIndex: -1,
      currentQuestionStartedAt: null,
      currentQuestionEndsAt: null,
      players: [],
      answersByQuestion: {},
      roundResult: null,
    };

    this.sessions.set(code, session);
    const snapshot = this.getSnapshot(code);
    this.emitUpdate(code);
    return { code, hostId, snapshot };
  }

  // Gets the raw in-memory session by code.
  getSession(code: string): QuizSession | undefined {
    return this.sessions.get(code.toUpperCase());
  }

  // Builds a renderer-safe snapshot of current session state.
  getSnapshot(code: string): SessionSnapshot {
    const session = this.mustGet(code);
    const currentQuestion =
      session.currentQuestionIndex >= 0 && session.currentQuestionIndex < session.questions.length
        ? session.questions[session.currentQuestionIndex]
        : null;

    const full = rankPlayers(session.players);
    const finalLeaderboard = session.state === "ended" ? full : null;

    return {
      code: session.code,
      hostName: session.hostName,
      state: session.state,
      questionTimeSec: session.settings.questionTimeSec,
      currentQuestionIndex: session.currentQuestionIndex,
      currentQuestion: currentQuestion
        ? { id: currentQuestion.id, prompt: currentQuestion.prompt, options: currentQuestion.options }
        : null,
      currentQuestionEndsAt: session.currentQuestionEndsAt,
      players: session.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        correctCount: p.correctCount,
      })),
      roundResult: session.roundResult,
      finalLeaderboard,
    };
  }

  // Adds a player to a session after validating code and unique name.
  joinSession(code: string, playerName: string): JoinResult {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return { ok: false, error: "Game code is required." };

    const session = this.sessions.get(normalizedCode);
    if (!session) return { ok: false, error: "Session not found." };
    if (session.state === "ended") return { ok: false, error: "Session has already ended." };

    const rawName = playerName.trim();
    if (!rawName) return { ok: false, error: "Name is required." };

    const normalizedName = normalizeName(rawName);
    const duplicate = session.players.some((p) => p.normalizedName === normalizedName);
    if (duplicate) {
      return { ok: false, error: "Name already taken in this session." };
    }

    const player: QuizPlayer = {
      id: randomUUID(),
      name: rawName,
      normalizedName,
      score: 0,
      correctCount: 0,
      totalResponseMs: 0,
      answeredCurrent: false,
    };

    session.players.push(player);
    this.emitUpdate(normalizedCode);

    return { ok: true, playerId: player.id, snapshot: this.getSnapshot(normalizedCode) };
  }

  // Starts the quiz by advancing from lobby to the first question.
  startQuiz(code: string): SubmitResult {
    const session = this.mustGet(code);
    if (session.questions.length === 0) {
      return { ok: false, error: "No questions in session." };
    }

    if (session.state !== "lobby" && session.state !== "round_result") {
      return { ok: false, error: "Quiz cannot be started right now." };
    }

    return this.advanceQuestion(code);
  }

  // Advances to the next question after a round result.
  nextQuestion(code: string): SubmitResult {
    const session = this.mustGet(code);
    if (session.state !== "round_result") {
      return { ok: false, error: "Wait for the current round to finish." };
    }

    return this.advanceQuestion(code);
  }

  // Ends the quiz immediately and publishes a final session update.
  endQuiz(code: string): SubmitResult {
    const session = this.mustGet(code);
    session.state = "ended";
    session.currentQuestionEndsAt = null;
    session.currentQuestionStartedAt = null;
    this.clearRoundTimer(code);
    this.emitUpdate(code);
    return { ok: true };
  }

  // Records one player's answer for the active question.
  submitAnswer(code: string, playerId: string, answer: string): SubmitResult {
    const session = this.mustGet(code);
    if (session.state !== "question") {
      return { ok: false, error: "Question is not active." };
    }

    const player = session.players.find((p) => p.id === playerId);
    if (!player) return { ok: false, error: "Player not found." };
    if (player.answeredCurrent) return { ok: false, error: "Answer already submitted." };

    const question = session.questions[session.currentQuestionIndex];
    if (!question) return { ok: false, error: "Question not found." };

    if (!session.answersByQuestion[question.id]) {
      session.answersByQuestion[question.id] = {};
    }

    const submittedAt = Date.now();
    session.answersByQuestion[question.id][playerId] = {
      answer,
      submittedAt,
    };
    player.answeredCurrent = true;

    const everyoneAnswered = session.players.length > 0 && session.players.every((p) => p.answeredCurrent);
    if (everyoneAnswered) {
      this.finalizeRound(code);
      return { ok: true };
    }

    this.emitUpdate(code);
    return { ok: true };
  }

  // Moves session state to the next question or ends quiz if complete.
  private advanceQuestion(code: string): SubmitResult {
    const session = this.mustGet(code);
    this.clearRoundTimer(code);

    const nextIndex = session.currentQuestionIndex + 1;
    if (nextIndex >= session.questions.length) {
      session.state = "ended";
      session.currentQuestionEndsAt = null;
      session.currentQuestionStartedAt = null;
      session.roundResult = null;
      this.emitUpdate(code);
      return { ok: true };
    }

    session.currentQuestionIndex = nextIndex;
    session.state = "question";
    session.roundResult = null;

    const now = Date.now();
    const durationMs = session.settings.questionTimeSec * 1000;
    session.currentQuestionStartedAt = now;
    session.currentQuestionEndsAt = now + durationMs;

    session.players.forEach((p) => {
      p.answeredCurrent = false;
    });

    const timer = setTimeout(() => {
      this.finalizeRound(code);
    }, durationMs + 25);
    this.roundTimers.set(code, timer);

    this.emitUpdate(code);
    return { ok: true };
  }

  // Finalizes scoring for the current question and computes round leaderboard.
  private finalizeRound(code: string): void {
    const session = this.mustGet(code);
    if (session.state !== "question") return;

    const question = session.questions[session.currentQuestionIndex];
    if (!question) return;

    const startedAt = session.currentQuestionStartedAt ?? Date.now();
    const endsAt = session.currentQuestionEndsAt ?? Date.now();
    const durationMs = Math.max(1, endsAt - startedAt);
    const answerMap = session.answersByQuestion[question.id] || {};

    session.players.forEach((player) => {
      const submitted = answerMap[player.id];
      if (!submitted) return;

      if (submitted.answer === question.correctAnswer) {
        const elapsed = Math.max(0, submitted.submittedAt - startedAt);
        const remaining = Math.max(0, durationMs - elapsed);
        const speedBonus = Math.floor((MAX_SPEED_BONUS * remaining) / durationMs);
        const gained = BASE_CORRECT_POINTS + speedBonus;
        player.score += gained;
        player.correctCount += 1;
        player.totalResponseMs += elapsed;
      }
    });

    const full = rankPlayers(session.players);
    session.roundResult = {
      questionId: question.id,
      correctAnswer: question.correctAnswer,
      top5: full.slice(0, 5),
      full,
    };

    session.state = "round_result";
    session.currentQuestionEndsAt = null;
    session.currentQuestionStartedAt = null;
    this.clearRoundTimer(code);
    this.emitUpdate(code);
  }

  // Gets a session by code or throws if it does not exist.
  private mustGet(code: string): QuizSession {
    const normalizedCode = code.trim().toUpperCase();
    const session = this.sessions.get(normalizedCode);
    if (!session) {
      throw new Error("Session not found");
    }
    return session;
  }

  // Clears the active timer for a session's current round.
  private clearRoundTimer(code: string): void {
    const normalizedCode = code.trim().toUpperCase();
    const timer = this.roundTimers.get(normalizedCode);
    if (timer) {
      clearTimeout(timer);
      this.roundTimers.delete(normalizedCode);
    }
  }

  // Emits a session snapshot update event for subscribers.
  private emitUpdate(code: string): void {
    const normalizedCode = code.trim().toUpperCase();
    const snapshot = this.getSnapshot(normalizedCode);
    this.emit("sessionUpdated", { code: normalizedCode, snapshot });
  }

  // Removes expired or finished sessions from memory.
  private cleanupStaleSessions(): void {
    const cutoff = Date.now() - SESSION_TTL_MS;
    const toDelete: string[] = [];
    this.sessions.forEach((session, code) => {
      if (session.createdAt < cutoff || session.state === "ended") {
        toDelete.push(code);
      }
    });

    toDelete.forEach((code) => {
      this.clearRoundTimer(code);
      this.sessions.delete(code);
    });
  }
}
