const DEFAULT_CAP = 256 * 1024;

export interface BufferChunk {
  data: Buffer;
  seq: number; // monotonic, never resets
}

export interface PaneOutputBufferOptions {
  capacityBytes?: number;
}

/**
 * Byte-bounded line-aligned ring buffer for one pane's PTY output. Each
 * write advances `seq` so subscribers can resume via subscribePane.sinceSeq.
 *
 * Snapshot returns the entire current contents as one chunk with the *latest*
 * seq value — clients that pass `sinceSeq` get a sliced buffer if the seq is
 * still within the live window, or the full snapshot with a `gap=true` marker
 * if it's been trimmed past.
 */
export class PaneOutputBuffer {
  private chunks: BufferChunk[] = [];
  private size = 0;
  private nextSeq = 1;
  private partialTrimmedSeq: number | null = null;
  private listeners = new Set<(chunk: BufferChunk) => void>();
  readonly capacity: number;

  constructor(opts: PaneOutputBufferOptions = {}) {
    this.capacity = opts.capacityBytes ?? DEFAULT_CAP;
  }

  /** Records a chunk and returns the assigned seq. */
  write(data: Buffer): number {
    const seq = this.nextSeq++;
    const chunk: BufferChunk = { data, seq };
    this.chunks.push(chunk);
    this.size += data.length;
    for (const l of this.listeners) l({ data, seq });
    this.trimToCapacity();
    return seq;
  }

  /** Snapshot for a new subscriber. If sinceSeq is provided and still in scope,
   *  returns chunks with seq > sinceSeq; otherwise returns full buffer with gap=true. */
  snapshot(sinceSeq?: number): { data: Buffer; latestSeq: number; gap: boolean } {
    if (this.chunks.length === 0) {
      // All data has been trimmed; if caller supplied sinceSeq and there was
      // ever data written (nextSeq > 1), they missed it → gap=true.
      const gap = sinceSeq != null && sinceSeq < this.nextSeq - 1;
      return { data: Buffer.alloc(0), latestSeq: this.nextSeq - 1, gap };
    }
    const oldestSeq = this.chunks[0].seq;
    const latestSeq = this.chunks[this.chunks.length - 1].seq;
    const hasPartialOldest = this.partialTrimmedSeq === oldestSeq;
    if (sinceSeq != null && sinceSeq >= oldestSeq - 1 && sinceSeq <= latestSeq) {
      const tail = this.chunks.filter(c => c.seq > sinceSeq);
      return {
        data: Buffer.concat(tail.map(c => c.data)),
        latestSeq,
        gap: hasPartialOldest && sinceSeq < oldestSeq,
      };
    }
    return {
      data: Buffer.concat(this.chunks.map(c => c.data), this.size),
      latestSeq,
      gap: sinceSeq != null && (sinceSeq < oldestSeq - 1 || (hasPartialOldest && sinceSeq < oldestSeq)),
    };
  }

  subscribe(listener: (chunk: BufferChunk) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private trimToCapacity(): void {
    while (this.size > this.capacity && this.chunks.length > 0) {
      const oldest = this.chunks[0];
      const nl = oldest.data.indexOf(0x0A);
      if (nl === -1 || nl + 1 === oldest.data.length) {
        // No mid-chunk newline → drop the whole oldest chunk
        this.chunks.shift();
        this.size -= oldest.data.length;
        if (this.partialTrimmedSeq === oldest.seq) this.partialTrimmedSeq = null;
      } else {
        // Drop everything up to and including the first newline
        const trimmed = oldest.data.subarray(nl + 1);
        this.size -= (oldest.data.length - trimmed.length);
        oldest.data = trimmed;
        this.partialTrimmedSeq = oldest.seq;
        // seq stays the same — partial trim of the same chunk
        if (oldest.data.length === 0) {
          this.chunks.shift();
          if (this.partialTrimmedSeq === oldest.seq) this.partialTrimmedSeq = null;
        }
      }
    }
  }
}
