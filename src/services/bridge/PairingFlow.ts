import { randomInt } from "node:crypto";
import { EventEmitter } from "node:events";

export const PAIR_WINDOW_MS = 5 * 60 * 1000;
export const PAIR_CODE_LENGTH = 6;

export interface PairWindow {
  code: string;
  expiresAt: Date;
}

/**
 * Pairing state machine. At most one window open at a time. `:pair` opens
 * the window; submitting the right code closes it. The daemon broadcasts
 * `pairChallenge` to every unauthenticated session whenever a window opens.
 *
 * Events:
 *   'open'  → (window: PairWindow)
 *   'close' → ({ window: PairWindow, reason: "expired" | "consumed" | "manual" })
 */
export class PairingFlow extends EventEmitter {
  private current: PairWindow | null = null;
  private timer: NodeJS.Timeout | null = null;

  open(): PairWindow {
    if (this.current && this.current.expiresAt > new Date()) {
      return this.current;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.current) {
      const expired = this.current;
      this.current = null;
      this.emit("close", { window: expired, reason: "expired" });
    }
    const code = randomInt(0, 1_000_000).toString().padStart(PAIR_CODE_LENGTH, "0");
    const expiresAt = new Date(Date.now() + PAIR_WINDOW_MS);
    this.current = { code, expiresAt };
    this.timer = setTimeout(() => this.close("expired"), PAIR_WINDOW_MS);
    this.emit("open", this.current);
    return this.current;
  }

  /** Returns true iff `code` matches the open window. Consumes the window on success. */
  consume(code: string): boolean {
    if (!this.current) return false;
    if (this.current.expiresAt <= new Date()) {
      this.close("expired");
      return false;
    }
    if (this.current.code !== code) return false;
    this.close("consumed");
    return true;
  }

  isOpen(): boolean {
    return !!this.current;
  }

  peek(): PairWindow | null {
    return this.current;
  }

  close(reason: "expired" | "consumed" | "manual"): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.current) {
      const w = this.current;
      this.current = null;
      this.emit("close", { window: w, reason });
    }
  }
}
