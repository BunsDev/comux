/**
 * PAIR Action - Open a pairing window on the bridge daemon and show a TUI banner.
 *
 * This is a session-level command (not a pane action), invoked via the `:pair`
 * colon command in useInputHandling.ts.
 */

export interface PairActionContext {
  bridgeDaemon: {
    openPairWindow(): Promise<{ code: string; expiresAt: Date }>;
  } | null | undefined;
  setStatusMessage?: (msg: string) => void;
  showPairBanner?: (opts: { code: string; expiresAt: Date }) => void;
}

export async function runPairAction(ctx: PairActionContext): Promise<void> {
  if (!ctx.bridgeDaemon) {
    ctx.setStatusMessage?.("bridge daemon not running");
    return;
  }
  const w = await ctx.bridgeDaemon.openPairWindow();
  ctx.showPairBanner?.({ code: w.code, expiresAt: w.expiresAt });
}
