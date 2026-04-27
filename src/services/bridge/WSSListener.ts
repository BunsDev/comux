import https from "node:https";
import { WebSocketServer, WebSocket } from "ws";
import type { TLSMaterial } from "./TLSCertificate.js";
import { Session } from "./Session.js";
import { ClientMessage, decodeClientMessage } from "./wireProtocol.js";

export interface WSSListenerEvents {
  onConnection: (session: Session) => void;
  onClientMessage: (session: Session, msg: ClientMessage) => Promise<void> | void;
  onClose: (session: Session) => void;
}

export class WSSListener {
  private https: https.Server;
  private wss: WebSocketServer;
  private sessions = new Set<Session>();

  constructor(tls: TLSMaterial, private events: WSSListenerEvents) {
    this.https = https.createServer({ cert: tls.cert, key: tls.key });
    this.wss = new WebSocketServer({ server: this.https });
    this.wss.on("connection", (socket, req) => this.handleConnection(socket, req));
  }

  async start(): Promise<{ port: number }> {
    return await new Promise((resolve, reject) => {
      this.https.once("error", reject);
      this.https.listen(0, "0.0.0.0", () => {
        const addr = this.https.address();
        if (typeof addr !== "object" || !addr) return reject(new Error("no address"));
        resolve({ port: addr.port });
      });
    });
  }

  async stop(): Promise<void> {
    for (const s of this.sessions) s.close("daemon shutting down");
    await new Promise<void>((r) => this.wss.close(() => r()));
    await new Promise<void>((r) => this.https.close(() => r()));
  }

  get activeSessions(): ReadonlySet<Session> {
    return this.sessions;
  }

  private handleConnection(socket: WebSocket, req: import("http").IncomingMessage) {
    const session = new Session({
      socket,
      remoteAddress: req.socket.remoteAddress ?? "?",
      remoteUserAgent: req.headers["user-agent"],
    });
    this.sessions.add(session);
    this.events.onConnection(session);
    let messageQueue = Promise.resolve();
    socket.on("message", (raw) => {
      messageQueue = messageQueue.then(
        () => this.handleMessage(session, raw),
        () => this.handleMessage(session, raw)
      );
    });
    socket.on("close", () => {
      this.sessions.delete(session);
      this.events.onClose(session);
    });
  }

  private async handleMessage(session: Session, raw: WebSocket.RawData): Promise<void> {
    try {
      const msg = decodeClientMessage(raw.toString("utf8"));
      await this.events.onClientMessage(session, msg);
    } catch (err) {
      session.send({
        type: "error",
        payload: { code: "parse_failed", message: String(err) },
      });
    }
  }
}
