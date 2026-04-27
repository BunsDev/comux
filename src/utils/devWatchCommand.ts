/**
 * Build a shell-safe command for restarting comux dev watch from a source path.
 * For respawned tmux panes, we append an interactive shell so the pane stays open
 * after comux exits intentionally.
 */

const escapeForDoubleQuotedShell = (value: string): string =>
  value.replace(/([\\$"`])/g, "\\$1");

export function buildDevWatchCommand(sourcePath: string): string {
  const escapedPath = escapeForDoubleQuotedShell(sourcePath);
  return `cd "${escapedPath}" && pnpm dev:watch`;
}

export function buildDevWatchRespawnCommand(sourcePath: string): string {
  return `${buildDevWatchCommand(sourcePath)}; exec "\${SHELL:-/bin/zsh}" -l`;
}
