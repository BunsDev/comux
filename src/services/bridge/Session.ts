import type { WebSocket } from "ws";
import { ServerMessage, encodeServerMessage } from "./wireProtocol.js";

export type SessionState = "unauthenticated" | "authenticated";

export interface SessionContext {
  socket: WebSocket;
  remoteAddress: string;
  remoteUserAgent?: string;
}

export class Session {
  state: SessionState = "unauthenticated";
  clientId: string | null = null;
  clientName: string | null = null;
  token: string | null = null;
  subscribedPaneIds = new Set<string>();
  subscriptionTeardowns = new Map<string, () => void>();

  constructor(public readonly ctx: SessionContext) {}

  send(msg: ServerMessage): void {
    if (this.ctx.socket.readyState !== 1) return; // 1 = OPEN
    this.ctx.socket.send(encodeServerMessage(msg));
  }

  close(reason: string): void {
    try {
      this.send({ type: "error", payload: { code: "closing", message: reason } });
    } catch {
      // ignore
    }
    this.ctx.socket.close(1000, reason);
  }
}
