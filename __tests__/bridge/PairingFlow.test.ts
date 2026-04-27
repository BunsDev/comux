import { describe, expect, it, vi } from "vitest";
import { PairingFlow, PAIR_WINDOW_MS } from "../../src/services/bridge/PairingFlow";

describe("PairingFlow", () => {
  it("opens with a 6-digit code", () => {
    const flow = new PairingFlow();
    const w = flow.open();
    expect(w.code).toMatch(/^\d{6}$/);
    expect(flow.isOpen()).toBe(true);
    flow.close("manual");
  });

  it("consume rejects wrong code, accepts the right code, then closes", () => {
    const flow = new PairingFlow();
    const w = flow.open();
    const wrong = w.code === "000000" ? "111111" : "000000";
    expect(flow.consume(wrong)).toBe(false);
    expect(flow.isOpen()).toBe(true);
    expect(flow.consume(w.code)).toBe(true);
    expect(flow.isOpen()).toBe(false);
  });

  it("emits open and close events", () => {
    const flow = new PairingFlow();
    const opens: PairingFlow extends EventTarget ? unknown[] : any[] = [];
    const closes: any[] = [];
    flow.on("open", (w) => opens.push(w));
    flow.on("close", (e) => closes.push(e));
    const w = flow.open();
    flow.consume(w.code);
    expect(opens).toHaveLength(1);
    expect(closes).toHaveLength(1);
    expect(closes[0].reason).toBe("consumed");
  });

  it("auto-closes on expiry with reason='expired'", () => {
    vi.useFakeTimers();
    const flow = new PairingFlow();
    const closes: any[] = [];
    flow.on("close", (e) => closes.push(e));
    flow.open();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(flow.isOpen()).toBe(false);
    expect(closes[0].reason).toBe("expired");
    vi.useRealTimers();
  });

  it("re-opening while a window is live returns the same window", () => {
    const flow = new PairingFlow();
    const a = flow.open();
    const b = flow.open();
    expect(a.code).toBe(b.code);
    expect(a.expiresAt.getTime()).toBe(b.expiresAt.getTime());
    flow.close("manual");
  });

  it("clears the stale expiry timer when opening after an expired window", () => {
    vi.useFakeTimers();
    try {
      const flow = new PairingFlow();
      const closes: any[] = [];
      flow.on("close", (e) => closes.push(e));

      const first = flow.open();
      vi.setSystemTime(first.expiresAt.getTime() + 1);
      const second = flow.open();

      expect(second.expiresAt.getTime()).toBeGreaterThan(first.expiresAt.getTime());
      expect(closes).toHaveLength(1);
      expect(closes[0].reason).toBe("expired");

      vi.advanceTimersByTime(1);
      expect(flow.isOpen()).toBe(true);

      vi.advanceTimersByTime(PAIR_WINDOW_MS);
      expect(flow.isOpen()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
