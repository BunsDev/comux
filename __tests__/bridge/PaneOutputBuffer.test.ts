import { describe, expect, it } from "vitest";
import { PaneOutputBuffer } from "../../src/services/bridge/PaneOutputBuffer";

describe("PaneOutputBuffer", () => {
  it("assigns monotonic seq", () => {
    const buf = new PaneOutputBuffer();
    expect(buf.write(Buffer.from("a"))).toBe(1);
    expect(buf.write(Buffer.from("b"))).toBe(2);
    expect(buf.write(Buffer.from("c"))).toBe(3);
  });

  it("snapshot returns full buffer when no sinceSeq", () => {
    const buf = new PaneOutputBuffer();
    buf.write(Buffer.from("hello\n"));
    buf.write(Buffer.from("world\n"));
    const snap = buf.snapshot();
    expect(snap.data.toString()).toBe("hello\nworld\n");
    expect(snap.latestSeq).toBe(2);
    expect(snap.gap).toBe(false);
  });

  it("snapshot returns tail when sinceSeq is in scope", () => {
    const buf = new PaneOutputBuffer();
    buf.write(Buffer.from("a\n"));
    buf.write(Buffer.from("b\n"));
    buf.write(Buffer.from("c\n"));
    const snap = buf.snapshot(1);
    expect(snap.data.toString()).toBe("b\nc\n");
    expect(snap.gap).toBe(false);
  });

  it("snapshot signals gap when sinceSeq is past trim", () => {
    const buf = new PaneOutputBuffer({ capacityBytes: 8 });
    buf.write(Buffer.from("aaaaaaaa\n"));
    buf.write(Buffer.from("bbbbbbbb\n"));
    const snap = buf.snapshot(0);
    expect(snap.gap).toBe(true);
  });

  it("snapshot signals gap when the oldest chunk was partially trimmed", () => {
    const buf = new PaneOutputBuffer({ capacityBytes: 7 });
    buf.write(Buffer.from("aaa\nbbb\n"));
    const snap = buf.snapshot(0);
    expect(snap.data.toString()).toBe("bbb\n");
    expect(snap.gap).toBe(true);
  });

  it("notifies live subscribers", () => {
    const buf = new PaneOutputBuffer();
    const seen: number[] = [];
    const unsub = buf.subscribe((c) => seen.push(c.seq));
    buf.write(Buffer.from("a"));
    buf.write(Buffer.from("b"));
    unsub();
    buf.write(Buffer.from("c"));
    expect(seen).toEqual([1, 2]);
  });

  it("notifies live subscribers with the full write before trimming", () => {
    const buf = new PaneOutputBuffer({ capacityBytes: 4 });
    const seen: string[] = [];
    buf.subscribe((c) => seen.push(c.data.toString()));

    buf.write(Buffer.from("aaa\nbbb\n"));

    expect(seen).toEqual(["aaa\nbbb\n"]);
    expect(buf.snapshot().data.toString()).toBe("bbb\n");
  });
});
