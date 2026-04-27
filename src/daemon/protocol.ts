/**
 * vmux daemon WS protocol (v0).
 *
 * Clients send JSON control frames; binary frames carry PTY IO.
 * A single WS connection can multiplex multiple attached panes via
 * the `streamId` field returned by `panes.attach`.
 */

export const PROTOCOL_VERSION = 0;

export type PaneId = string;
export type StreamId = string;

export interface PaneSummary {
  id: PaneId;
  cwd: string;
  branch?: string;
  agent?: string;
  title?: string;
  lastActivity?: string;
}

export type ClientRequest =
  | { type: 'hello'; token: string; clientName?: string }
  | { type: 'panes.list'; requestId: string }
  | { type: 'panes.spawn'; requestId: string; cwd: string; branch?: string; agent?: string; title?: string }
  | { type: 'panes.attach'; requestId: string; id: PaneId; cols?: number; rows?: number }
  | { type: 'panes.detach'; requestId: string; streamId: StreamId }
  | { type: 'panes.focus'; requestId: string; id?: PaneId; streamId?: StreamId }
  | { type: 'panes.input'; requestId: string; streamId: StreamId; data: string }
  | { type: 'panes.resize'; requestId: string; streamId: StreamId; cols: number; rows: number }
  | { type: 'panes.kill'; requestId: string; id: PaneId }
  | { type: 'panes.meta'; requestId: string; id: PaneId; title?: string; agent?: string };

export type ServerResponse =
  | { type: 'welcome'; protocol: number; serverVersion: string }
  | { type: 'error'; requestId?: string; code: string; message: string }
  | { type: 'ack'; requestId: string; ok: true }
  | { type: 'panes.list.result'; requestId: string; panes: PaneSummary[] }
  | { type: 'panes.spawn.result'; requestId: string; id: PaneId }
  | { type: 'panes.attach.result'; requestId: string; streamId: StreamId; id: PaneId }
  | { type: 'panes.stream.exit'; streamId: StreamId; reason: string };

export interface BinaryFrameHeader {
  streamId: StreamId;
}

/**
 * Binary frames are `[1-byte streamId-length][streamId utf8][payload]`.
 * streamId is short (base36), so a 1-byte length prefix is plenty.
 */
export function encodeBinaryFrame(streamId: StreamId, payload: Uint8Array): Buffer {
  const idBytes = Buffer.from(streamId, 'utf8');
  if (idBytes.length > 255) {
    throw new Error('streamId too long');
  }
  const out = Buffer.allocUnsafe(1 + idBytes.length + payload.length);
  out.writeUInt8(idBytes.length, 0);
  idBytes.copy(out, 1);
  Buffer.from(payload).copy(out, 1 + idBytes.length);
  return out;
}

export function decodeBinaryFrame(buf: Buffer): { streamId: StreamId; payload: Buffer } {
  const idLen = buf.readUInt8(0);
  const streamId = buf.subarray(1, 1 + idLen).toString('utf8');
  const payload = buf.subarray(1 + idLen);
  return { streamId, payload };
}
