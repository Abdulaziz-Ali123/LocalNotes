/**
 * File: main/quiz/types.ts
 * Author: Atharva Patil
 * Git-history contributors: a157p624
 * Sprint: 5
 * Purpose: Canonical type contracts for quiz sessions, players, questions, and leaderboards.
 * Notes: Shared by quiz session manager, IPC handlers, and WebSocket transport.
 */


export type QuizSessionState = "lobby" | "question" | "round_result" | "ended";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
}

export interface QuizPlayer {
  id: string;
  name: string;
  normalizedName: string;
  score: number;
  correctCount: number;
  totalResponseMs: number;
  answeredCurrent: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  correctCount: number;
  totalResponseMs: number;
}

export interface QuizRoundResult {
  questionId: string;
  correctAnswer: string;
  top5: LeaderboardEntry[];
  full: LeaderboardEntry[];
}

export interface HostSettings {
  questionTimeSec: number;
}

export interface QuizSession {
  code: string;
  hostId: string;
  hostName: string;
  createdAt: number;
  state: QuizSessionState;
  settings: HostSettings;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  currentQuestionStartedAt: number | null;
  currentQuestionEndsAt: number | null;
  players: QuizPlayer[];
  answersByQuestion: Record<string, Record<string, { answer: string; submittedAt: number }>>;
  roundResult: QuizRoundResult | null;
}

export interface SessionSnapshot {
  code: string;
  hostName: string;
  state: QuizSessionState;
  questionTimeSec: number;
  currentQuestionIndex: number;
  currentQuestion: Pick<QuizQuestion, "id" | "prompt" | "options"> | null;
  currentQuestionEndsAt: number | null;
  players: { id: string; name: string; score: number; correctCount: number }[];
  roundResult: QuizRoundResult | null;
  finalLeaderboard: LeaderboardEntry[] | null;
}

export interface CreateSessionInput {
  hostName: string;
  questionTimeSec: number;
  questions: QuizQuestion[];
}

export interface JoinResult {
  ok: boolean;
  error?: string;
  playerId?: string;
  snapshot?: SessionSnapshot;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
}
