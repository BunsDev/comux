/**
 * DEVICES Action - List paired devices and offer to revoke one.
 *
 * This is a session-level command (not a pane action), invoked via the
 * `:devices` colon command in useInputHandling.ts.
 */

export interface DeviceRecord {
  token: string;
  clientId: string;
  clientName: string;
  pairedAt: string;
  lastSeenAt: string;
}

export interface DevicesPopup {
  launchChoicePopup(
    title: string,
    message: string,
    options: Array<{ id: string; label: string; description?: string; danger?: boolean; default?: boolean }>,
    data?: unknown,
    projectRoot?: string,
  ): Promise<string | null>;
}

export interface DevicesActionContext {
  bridgeDaemon: {
    listDevices(): Promise<DeviceRecord[]>;
    revokeDevice(token: string): Promise<boolean>;
  } | null | undefined;
  popup: DevicesPopup;
  setStatusMessage?: (msg: string) => void;
}

export async function runDevicesAction(ctx: DevicesActionContext): Promise<void> {
  if (!ctx.bridgeDaemon) {
    ctx.setStatusMessage?.("bridge daemon not running");
    return;
  }
  const devices = await ctx.bridgeDaemon.listDevices();
  if (devices.length === 0) {
    ctx.setStatusMessage?.("no paired devices");
    return;
  }

  const selected = await ctx.popup.launchChoicePopup(
    "Paired devices — pick to revoke",
    "Select a device to revoke its access.",
    devices.map((d) => ({
      id: d.token,
      label: `${d.clientName} — paired ${new Date(d.pairedAt).toLocaleDateString()}`,
      danger: true,
    })),
  );
  if (!selected) return;

  const deviceLabel = devices.find((d) => d.token === selected)?.clientName ?? selected;
  const ok = await ctx.bridgeDaemon.revokeDevice(selected);
  ctx.setStatusMessage?.(ok ? `revoked ${deviceLabel}` : "revoke failed");
}
