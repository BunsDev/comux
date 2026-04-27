import { describe, expect, it, vi } from "vitest";
import { runDevicesAction } from "../../src/actions/implementations/devicesAction";

const makeDevice = (overrides: Partial<{
  token: string; clientId: string; clientName: string; pairedAt: string; lastSeenAt: string;
}> = {}) => ({
  token: "tk1",
  clientId: "ios-1",
  clientName: "iPad",
  pairedAt: new Date("2025-01-01").toISOString(),
  lastSeenAt: new Date("2025-04-01").toISOString(),
  ...overrides,
});

describe("devicesAction", () => {
  it("revokes the chosen device", async () => {
    const device = makeDevice();
    const fakeDaemon = {
      listDevices: vi.fn(async () => [device]),
      revokeDevice: vi.fn(async () => true),
    };
    const setStatusMessage = vi.fn();
    const launchChoicePopup = vi.fn(async () => device.token);
    await runDevicesAction({
      bridgeDaemon: fakeDaemon,
      popup: { launchChoicePopup } as any,
      setStatusMessage,
    });
    expect(fakeDaemon.revokeDevice).toHaveBeenCalledWith(device.token);
    expect(setStatusMessage).toHaveBeenCalledWith(`revoked ${device.clientName}`);
  });

  it("status-messages when no devices paired", async () => {
    const fakeDaemon = {
      listDevices: vi.fn(async () => []),
      revokeDevice: vi.fn(),
    };
    const setStatusMessage = vi.fn();
    await runDevicesAction({
      bridgeDaemon: fakeDaemon,
      popup: {} as any,
      setStatusMessage,
    });
    expect(setStatusMessage).toHaveBeenCalledWith("no paired devices");
    expect(fakeDaemon.revokeDevice).not.toHaveBeenCalled();
  });

  it("status-messages when daemon is missing", async () => {
    const setStatusMessage = vi.fn();
    await runDevicesAction({
      bridgeDaemon: null,
      popup: {} as any,
      setStatusMessage,
    });
    expect(setStatusMessage).toHaveBeenCalledWith("bridge daemon not running");
  });

  it("does nothing when user cancels the popup (null selection)", async () => {
    const device = makeDevice();
    const fakeDaemon = {
      listDevices: vi.fn(async () => [device]),
      revokeDevice: vi.fn(),
    };
    const setStatusMessage = vi.fn();
    const launchChoicePopup = vi.fn(async () => null);
    await runDevicesAction({
      bridgeDaemon: fakeDaemon,
      popup: { launchChoicePopup } as any,
      setStatusMessage,
    });
    expect(fakeDaemon.revokeDevice).not.toHaveBeenCalled();
    expect(setStatusMessage).not.toHaveBeenCalled();
  });

  it("reports revoke failure", async () => {
    const device = makeDevice();
    const fakeDaemon = {
      listDevices: vi.fn(async () => [device]),
      revokeDevice: vi.fn(async () => false),
    };
    const setStatusMessage = vi.fn();
    const launchChoicePopup = vi.fn(async () => device.token);
    await runDevicesAction({
      bridgeDaemon: fakeDaemon,
      popup: { launchChoicePopup } as any,
      setStatusMessage,
    });
    expect(setStatusMessage).toHaveBeenCalledWith("revoke failed");
  });
});
