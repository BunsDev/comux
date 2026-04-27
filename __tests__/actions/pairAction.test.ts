import { describe, expect, it, vi } from "vitest";
import { runPairAction } from "../../src/actions/implementations/pairAction";

describe("pairAction", () => {
  it("opens a pair window via the daemon and shows the banner", async () => {
    const expiresAt = new Date(Date.now() + 300000);
    const showBanner = vi.fn();
    const fakeDaemon = {
      openPairWindow: vi.fn(async () => ({ code: "012345", expiresAt })),
    };
    await runPairAction({
      bridgeDaemon: fakeDaemon,
      showPairBanner: showBanner,
    });
    expect(fakeDaemon.openPairWindow).toHaveBeenCalled();
    expect(showBanner).toHaveBeenCalledWith({
      code: "012345",
      expiresAt,
    });
  });

  it("status-messages when daemon is missing (null)", async () => {
    const setStatusMessage = vi.fn();
    await runPairAction({ bridgeDaemon: null, setStatusMessage });
    expect(setStatusMessage).toHaveBeenCalledWith("bridge daemon not running");
  });

  it("status-messages when daemon is undefined", async () => {
    const setStatusMessage = vi.fn();
    await runPairAction({ bridgeDaemon: undefined, setStatusMessage });
    expect(setStatusMessage).toHaveBeenCalledWith("bridge daemon not running");
  });

  it("does not throw when showPairBanner is omitted", async () => {
    const fakeDaemon = {
      openPairWindow: vi.fn(async () => ({
        code: "999999",
        expiresAt: new Date(Date.now() + 300000),
      })),
    };
    await expect(runPairAction({ bridgeDaemon: fakeDaemon })).resolves.toBeUndefined();
  });
});
