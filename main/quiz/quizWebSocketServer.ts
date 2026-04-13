/**
 * File: main/quiz/quizWebSocketServer.ts
 * Author: Atharva Patil
 * Sprint: 5
 * Purpose: LAN-accessible HTTP/WebSocket transport for quiz player connections.
 * Notes: Bridges socket events to QuizSessionManager and broadcasts snapshot updates.
 */


import http, { IncomingMessage, ServerResponse } from "http";
import os from "os";
import { URL } from "url";
import QRCode from "qrcode";
import { WebSocketServer, WebSocket } from "ws";
import { QuizSessionManager } from "./quizSessionManager";

interface SocketClient {
  socket: WebSocket;
  code: string;
  playerId: string;
}

// Finds a non-internal IPv4 LAN address for sharing join links.
function getLanAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === "IPv4" && !info.internal) {
        return info.address;
      }
    }
  }
  return "127.0.0.1";
}

// Returns a lightweight HTML page used by players joining from a browser.
function playerPageHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LocalNotes Quiz Join</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 20px; }
    .card { background: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    input, button { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #334155; margin-bottom: 10px; }
    button { background: #22c55e; color: #052e16; font-weight: 700; cursor: pointer; }
    .opt { background: #334155; color: #e2e8f0; margin-bottom: 8px; }
    .lb { display: flex; justify-content: space-between; padding: 8px; background: #334155; border-radius: 8px; margin-bottom: 6px; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card" id="joinCard">
    <h2>Join Quiz</h2>
    <input id="code" placeholder="Game code" />
    <input id="name" placeholder="Unique name" />
    <button id="joinBtn">Join</button>
    <p id="joinErr"></p>
  </div>
  <div class="card" id="playCard" style="display:none;">
    <h2 id="stateTitle">Waiting for host...</h2>
    <p id="prompt"></p>
    <div id="options"></div>
    <p id="timer"></p>
    <h3>Top 5</h3>
    <div id="top5"></div>
    <h3 id="finalTitle" style="display:none;">Final Leaderboard</h3>
    <div id="final"></div>
  </div>
</div>
<script>
  const params = new URLSearchParams(location.search);
  const codeInput = document.getElementById("code");
  const nameInput = document.getElementById("name");
  const joinErr = document.getElementById("joinErr");
  const joinBtn = document.getElementById("joinBtn");
  const joinCard = document.getElementById("joinCard");
  const playCard = document.getElementById("playCard");
  const stateTitle = document.getElementById("stateTitle");
  const prompt = document.getElementById("prompt");
  const options = document.getElementById("options");
  const timer = document.getElementById("timer");
  const top5 = document.getElementById("top5");
  const final = document.getElementById("final");
  const finalTitle = document.getElementById("finalTitle");
  codeInput.value = (params.get("code") || "").toUpperCase();

  let ws;
  let playerId = null;
  let currentCode = null;

  const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = wsProtocol + "://" + location.host;

  function renderBoard(el, rows) {
    el.innerHTML = "";
    rows.forEach((r, idx) => {
      const row = document.createElement("div");
      row.className = "lb";
      row.innerHTML = "<span>#" + (idx + 1) + " " + r.name + "</span><strong>" + r.score + "</strong>";
      el.appendChild(row);
    });
  }

  function renderSnapshot(snapshot) {
    if (snapshot.state === "question" && snapshot.currentQuestion) {
      stateTitle.textContent = "Answer now";
      prompt.textContent = snapshot.currentQuestion.prompt;
      options.innerHTML = "";
      snapshot.currentQuestion.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "opt";
        btn.textContent = opt;
        btn.onclick = () => {
          if (!playerId) return;
          ws.send(JSON.stringify({ type: "submitAnswer", code: currentCode, playerId, answer: opt }));
        };
        options.appendChild(btn);
      });
    } else {
      options.innerHTML = "";
      prompt.textContent = "";
    }

    if (snapshot.state === "round_result" && snapshot.roundResult) {
      stateTitle.textContent = "Round complete";
      renderBoard(top5, snapshot.roundResult.top5 || []);
      timer.textContent = "Correct answer: " + snapshot.roundResult.correctAnswer;
    }

    if (snapshot.state === "ended") {
      stateTitle.textContent = "Quiz ended";
      finalTitle.style.display = "block";
      renderBoard(final, snapshot.finalLeaderboard || []);
    }

    if (snapshot.currentQuestionEndsAt) {
      const tick = () => {
        const remain = Math.max(0, Math.ceil((snapshot.currentQuestionEndsAt - Date.now()) / 1000));
        timer.textContent = "Time left: " + remain + "s";
      };
      tick();
      setInterval(tick, 1000);
    }
  }

  joinBtn.onclick = () => {
    joinErr.textContent = "";
    currentCode = codeInput.value.trim().toUpperCase();
    if (!currentCode || !nameInput.value.trim()) {
      joinErr.textContent = "Enter code and unique name.";
      return;
    }

    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", code: currentCode, name: nameInput.value.trim() }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "joinResult") {
        if (!message.ok) {
          joinErr.textContent = message.error || "Failed to join";
          return;
        }

        playerId = message.playerId;
        joinCard.style.display = "none";
        playCard.style.display = "block";
        renderSnapshot(message.snapshot);
      }

      if (message.type === "sessionUpdate") {
        renderSnapshot(message.snapshot);
      }

      if (message.type === "error") {
        joinErr.textContent = message.error || "Error";
      }
    };
  };
</script>
</body>
</html>`;
}

export class QuizWebSocketServer {
  private readonly manager: QuizSessionManager;
  private readonly port: number;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, SocketClient>();

  // Stores dependencies and server port configuration.
  constructor(manager: QuizSessionManager, port: number = 9898) {
    this.manager = manager;
    this.port = port;
  }

  // Starts HTTP and WebSocket listeners and wires message handlers.
  async start(): Promise<void> {
    if (this.server) return;

    this.server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const reqUrl = new URL(req.url || "/", `http://${req.headers.host || `127.0.0.1:${this.port}`}`);

      if (reqUrl.pathname === "/join") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(playerPageHtml());
        return;
      }

      if (reqUrl.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("LocalNotes quiz server is running. Open /join to play.");
    });

    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on("connection", (socket) => {
      const socketId = Math.random().toString(36).slice(2);

      socket.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === "join") {
            this.handleJoin(socketId, socket, msg.code, msg.name);
            return;
          }

          if (msg.type === "submitAnswer") {
            const result = this.manager.submitAnswer(msg.code, msg.playerId, msg.answer);
            if (!result.ok) {
              socket.send(JSON.stringify({ type: "error", error: result.error }));
            }
            return;
          }
        } catch (error) {
          socket.send(JSON.stringify({ type: "error", error: "Invalid message format." }));
        }
      });

      socket.on("close", () => {
        this.clients.delete(socketId);
      });
    });

    this.manager.on("sessionUpdated", ({ code, snapshot }) => {
      this.clients.forEach((client) => {
        if (client.code === code && client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify({ type: "sessionUpdate", snapshot }));
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(this.port, "0.0.0.0", () => resolve());
      this.server?.on("error", reject);
    });
  }

  // Stops socket connections and shuts down the HTTP/WebSocket server.
  stop(): void {
    this.clients.forEach((client) => client.socket.close());
    this.clients.clear();
    this.wss?.close();
    this.wss = null;
    this.server?.close();
    this.server = null;
  }

  // Returns the configured server port.
  getPort(): number {
    return this.port;
  }

  // Builds the LAN join URL with a prefilled game code.
  getJoinUrl(code: string): string {
    const host = getLanAddress();
    return `http://${host}:${this.port}/join?code=${encodeURIComponent(code.toUpperCase())}`;
  }

  // Generates a QR data URL for the session join link.
  async getJoinQrDataUrl(code: string): Promise<string> {
    return QRCode.toDataURL(this.getJoinUrl(code), { margin: 1, width: 320 });
  }

  // Handles player join messages and registers connected clients.
  private handleJoin(socketId: string, socket: WebSocket, code: string, name: string): void {
    const joinResult = this.manager.joinSession(code, name);
    if (!joinResult.ok || !joinResult.playerId || !joinResult.snapshot) {
      socket.send(
        JSON.stringify({
          type: "joinResult",
          ok: false,
          error: joinResult.error || "Unable to join session.",
        })
      );
      return;
    }

    this.clients.set(socketId, {
      socket,
      code: code.trim().toUpperCase(),
      playerId: joinResult.playerId,
    });

    socket.send(
      JSON.stringify({
        type: "joinResult",
        ok: true,
        playerId: joinResult.playerId,
        snapshot: joinResult.snapshot,
      })
    );
  }
}
