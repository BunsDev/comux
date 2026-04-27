import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  VMUX_TMUX_CONFIG_END,
  VMUX_TMUX_CONFIG_START,
  buildVmuxManagedTmuxConfigBlock,
  hasVmuxManagedTmuxConfigBlock,
  upsertVmuxManagedTmuxConfigBlock,
  writeVmuxManagedTmuxConfig,
} from '../src/utils/tmuxManagedConfig.js';

describe('tmux managed config', () => {
  it('inserts the vmux block without changing user-owned config', () => {
    const existing = 'set -g mouse off\n';
    const block = buildVmuxManagedTmuxConfigBlock('dark');
    const result = upsertVmuxManagedTmuxConfigBlock(existing, block);

    expect(result.action).toBe('inserted');
    expect(result.changed).toBe(true);
    expect(result.content).toContain('set -g mouse off');
    expect(result.content).toContain(VMUX_TMUX_CONFIG_START);
    expect(result.content).toContain(VMUX_TMUX_CONFIG_END);
  });

  it('replaces only the existing vmux block', () => {
    const oldBlock = [
      VMUX_TMUX_CONFIG_START,
      'old vmux setting',
      VMUX_TMUX_CONFIG_END,
    ].join('\n');
    const existing = `set -g prefix C-a\n\n${oldBlock}\n\nset -g status off\n`;
    const result = upsertVmuxManagedTmuxConfigBlock(
      existing,
      buildVmuxManagedTmuxConfigBlock('dark')
    );

    expect(result.action).toBe('updated');
    expect(result.content).toContain('set -g prefix C-a');
    expect(result.content).toContain('set -g status off');
    expect(result.content).not.toContain('old vmux setting');
  });

  it('writes a timestamped backup before modifying an existing config', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vmux-managed-config-'));

    try {
      await fs.writeFile(path.join(homeDir, '.tmux.conf'), 'set -g mouse off\n', 'utf-8');
      const result = await writeVmuxManagedTmuxConfig(
        homeDir,
        'dark',
        new Date('2026-04-24T12:34:56.000Z')
      );

      expect(result.action).toBe('inserted');
      expect(result.backupPath).toContain('.tmux.conf.vmux-backup-2026-04-24T12-34-56-000Z');
      expect(result.backupPath).toBeDefined();
      expect(await fs.readFile(result.backupPath!, 'utf-8')).toBe('set -g mouse off\n');
      expect(hasVmuxManagedTmuxConfigBlock(await fs.readFile(result.configPath, 'utf-8'))).toBe(true);
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });
});
