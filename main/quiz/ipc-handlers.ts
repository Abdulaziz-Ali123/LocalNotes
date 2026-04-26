/**
 * File: main/quiz/ipc-handlers.ts
 * Author: Atharva Patil
 * Git-history contributors: a157p624
 * Sprint: 5
 * Purpose: Registers Electron IPC handlers for host quiz controls and snapshot events.
 * Notes: Validates/sanitizes question payloads before session creation.
 */


import { BrowserWindow, ipcMain } from "electron";
import { QuizSessionManager } from "./quizSessionManager";
import { QuizWebSocketServer } from "./quizWebSocketServer";
import { QuizQuestion } from "./types";

// Sanitizes raw question input into valid quiz question objects.
/**
 * Functionality: sanitizeQuestions performs the sanitize questions workflow used by main/quiz/ipc-handlers.ts.
 * Parameters: input (any).
 * Returns: Returns QuizQuestion[].
 * Usage: Call sanitizeQuestions from the owning module or component when this behavior is required.
 */
function sanitizeQuestions(input: any): QuizQuestion[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item: any, index: number) => ({
      id: String(item?.id || `q-${index + 1}`),
      prompt: String(item?.prompt || "").trim(),
      options: Array.isArray(item?.options)
        ? item.options.map((opt: any) => String(opt)).filter((opt: string) => opt.trim().length > 0)
        : [],
      correctAnswer: String(item?.correctAnswer || "").trim(),
    }))
    .filter((q: QuizQuestion) => q.prompt.length > 0 && q.options.length >= 2 && q.correctAnswer.length > 0);
}

// Registers all quiz-related IPC handlers for host controls and session updates.
/**
 * Functionality: registerQuizIpc performs the register quiz ipc workflow used by main/quiz/ipc-handlers.ts.
 * Parameters: manager (QuizSessionManager); wsServer (QuizWebSocketServer); getMainWindow (() => BrowserWindow | null).
 * Returns: Returns void.
 * Usage: Call registerQuizIpc from the owning module or component when this behavior is required.
 */
export function registerQuizIpc(
  manager: QuizSessionManager,
  wsServer: QuizWebSocketServer,
  getMainWindow: () => BrowserWindow | null
): void {
  // Forwards manager session updates to the renderer process.
  manager.on("sessionUpdated", ({ code, snapshot }) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("quiz:sessionUpdated", { code, snapshot });
    }
  });

  // Returns quiz server metadata needed by the UI.
  ipcMain.handle("quiz:getServerInfo", async () => {
    return {
      success: true,
      data: {
        port: wsServer.getPort(),
      },
    };
  });

  // Creates a new session and returns join details, QR, and initial snapshot.
  ipcMain.handle("quiz:createSession", async (_event, payload: any) => {
    try {
      const questions = sanitizeQuestions(payload?.questions);
      const result = manager.createSession({
        hostName: String(payload?.hostName || "Host"),
        questionTimeSec: Number(payload?.questionTimeSec || 20),
        questions,
      });

      const joinUrl = wsServer.getJoinUrl(result.code);
      const qrDataUrl = await wsServer.getJoinQrDataUrl(result.code);

      return {
        success: true,
        data: {
          code: result.code,
          hostId: result.hostId,
          joinUrl,
          qrDataUrl,
          snapshot: result.snapshot,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Returns the latest snapshot for a given game code.
  ipcMain.handle("quiz:getSession", async (_event, code: string) => {
    try {
      const snapshot = manager.getSnapshot(code);
      return { success: true, data: snapshot };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Starts quiz progression from lobby to active question state.
  ipcMain.handle("quiz:startQuiz", async (_event, code: string) => {
    try {
      const result = manager.startQuiz(code);
      return result.ok ? { success: true } : { success: false, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Advances the session from round results to the next question.
  ipcMain.handle("quiz:nextQuestion", async (_event, code: string) => {
    try {
      const result = manager.nextQuestion(code);
      return result.ok ? { success: true } : { success: false, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Ends the quiz session and transitions to final leaderboard state.
  ipcMain.handle("quiz:endQuiz", async (_event, code: string) => {
    try {
      const result = manager.endQuiz(code);
      return result.ok ? { success: true } : { success: false, error: result.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
