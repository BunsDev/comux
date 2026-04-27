import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RemotePaneActionShortcut } from './remotePaneActions.js';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function resolveVmuxExecutable(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const localVmuxPath = path.resolve(currentDir, '..', '..', 'vmux');

  if (fs.existsSync(localVmuxPath)) {
    return localVmuxPath;
  }

  return 'vmux';
}

export function buildFilesOnlyCommand(): string {
  return `${shellQuote(resolveVmuxExecutable())} --files-only`;
}

export function buildRemotePaneActionCommand(
  shortcut: RemotePaneActionShortcut
): string {
  return `${shellQuote(resolveVmuxExecutable())} --remote-pane-action ${shortcut}`;
}
