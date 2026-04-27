import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  formatTmuxDoctorJson,
  formatTmuxDoctorText,
  getTmuxDoctorExitCode,
  runTmuxDoctor,
  type TmuxDoctorRuntime,
} from '../src/utils/tmuxDoctor.js';
import { buildComuxManagedTmuxConfigBlock } from '../src/utils/tmuxManagedConfig.js';

function createRuntime(overrides: Partial<TmuxDoctorRuntime> = {}): TmuxDoctorRuntime {
  return {
    env: {},
    run(command, args) {
      if (command === 'tmux' && args.join(' ') === '-V') {
        return { status: 0, stdout: 'tmux 3.4\n', stderr: '' };
      }
      if (command === 'git' && args.join(' ') === '--version') {
        return { status: 0, stdout: 'git version 2.45.0\n', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: '' };
    },
    ...overrides,
  };
}

describe('tmux doctor', () => {
  it('reports healthy when dependencies and managed config are present', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comux-doctor-'));

    try {
      await fs.writeFile(
        path.join(homeDir, '.tmux.conf'),
        buildComuxManagedTmuxConfigBlock('dark'),
        'utf-8'
      );

      const result = await runTmuxDoctor({
        runtime: createRuntime({ homeDir }),
      });

      expect(result.canRun).toBe(true);
      expect(result.healthy).toBe(true);
      expect(getTmuxDoctorExitCode(result)).toBe(0);
      expect(JSON.parse(formatTmuxDoctorJson(result)).checks).toEqual(result.checks);
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it('returns a blocking error when tmux is missing', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comux-doctor-'));

    try {
      const result = await runTmuxDoctor({
        runtime: createRuntime({
          homeDir,
          run(command, args) {
            if (command === 'tmux' && args.join(' ') === '-V') {
              return { status: 1, stdout: '', stderr: 'not found' };
            }
            if (command === 'git' && args.join(' ') === '--version') {
              return { status: 0, stdout: 'git version 2.45.0\n', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: '' };
          },
        }),
      });

      expect(result.canRun).toBe(false);
      expect(result.checks.find((check) => check.id === 'tmux-version')?.severity).toBe('error');
      expect(getTmuxDoctorExitCode(result)).toBe(1);
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it('fixes missing managed config and live session options', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comux-doctor-'));
    const commands: string[] = [];

    try {
      const result = await runTmuxDoctor({
        fix: true,
        runtime: createRuntime({
          homeDir,
          env: { TMUX: '/tmp/tmux,1,0' },
          run(command, args) {
            commands.push(`${command} ${args.join(' ')}`);
            if (command === 'tmux' && args.join(' ') === '-V') {
              return { status: 0, stdout: 'tmux 3.4\n', stderr: '' };
            }
            if (command === 'git' && args.join(' ') === '--version') {
              return { status: 0, stdout: 'git version 2.45.0\n', stderr: '' };
            }
            if (command === 'tmux' && args.join(' ') === 'display-message -p #S') {
              return { status: 0, stdout: 'comux-test\n', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: '' };
          },
        }),
      });

      expect(result.fixed).toBe(true);
      expect(result.canRun).toBe(true);
      expect(await fs.readFile(path.join(homeDir, '.tmux.conf'), 'utf-8')).toContain('# >>> comux');
      expect(commands.some((command) => command.includes('set-option -q -t comux-test status-style'))).toBe(true);
      expect(commands.some((command) => command.includes('set-option -g mouse on'))).toBe(true);
      expect(commands.some((command) => command.includes('set-option -gq extended-keys on'))).toBe(true);
      expect(commands.some((command) => command.includes('source-file'))).toBe(true);
      expect(commands.some((command) => command.includes('terminal-overrides ,xterm-256color'))).toBe(true);
      expect(commands.some((command) => command.includes('bind-key -n M-M'))).toBe(true);
      expect(formatTmuxDoctorText(result)).toContain('Some warnings remain');
      expect(formatTmuxDoctorText(result)).not.toContain('Run comux doctor --fix to apply safe repairs.');
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it('does not mark all tmux checks fixed when only binding repair succeeds', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comux-doctor-'));

    try {
      await fs.writeFile(
        path.join(homeDir, '.tmux.conf'),
        buildComuxManagedTmuxConfigBlock('dark'),
        'utf-8'
      );

      const result = await runTmuxDoctor({
        fix: true,
        runtime: createRuntime({
          homeDir,
          env: { TMUX: '/tmp/tmux,1,0' },
          run(command, args) {
            const joinedArgs = args.join(' ');
            if (command === 'tmux' && joinedArgs === '-V') {
              return { status: 0, stdout: 'tmux 3.4\n', stderr: '' };
            }
            if (command === 'git' && joinedArgs === '--version') {
              return { status: 0, stdout: 'git version 2.45.0\n', stderr: '' };
            }
            if (command === 'tmux' && joinedArgs === 'display-message -p #S') {
              return { status: 0, stdout: 'comux-test\n', stderr: '' };
            }
            if (command === 'tmux' && joinedArgs.includes('bind-key -n M-M')) {
              return { status: 0, stdout: '', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: '' };
          },
        }),
      });

      const mouseCheck = result.checks.find((check) => check.id === 'tmux-mouse');
      expect(result.fixed).toBe(true);
      expect(mouseCheck?.severity).toBe('warning');
      expect(mouseCheck).not.toHaveProperty('fixed');
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });

  it('uses the configured comux theme for live session style fixes', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comux-doctor-'));
    const commands: string[] = [];

    try {
      await fs.writeFile(
        path.join(homeDir, '.tmux.conf'),
        buildComuxManagedTmuxConfigBlock('dark'),
        'utf-8'
      );

      const result = await runTmuxDoctor({
        fix: true,
        runtime: createRuntime({
          homeDir,
          env: { TMUX: '/tmp/tmux,1,0' },
          themeName: 'green',
          run(command, args) {
            commands.push(`${command} ${args.join(' ')}`);
            if (command === 'tmux' && args.join(' ') === '-V') {
              return { status: 0, stdout: 'tmux 3.4\n', stderr: '' };
            }
            if (command === 'git' && args.join(' ') === '--version') {
              return { status: 0, stdout: 'git version 2.45.0\n', stderr: '' };
            }
            if (command === 'tmux' && args.join(' ') === 'display-message -p #S') {
              return { status: 0, stdout: 'comux-test\n', stderr: '' };
            }
            return { status: 1, stdout: '', stderr: '' };
          },
        }),
      });

      expect(result.canRun).toBe(true);
      expect(commands.some((command) =>
        command.includes('pane-active-border-style fg=colour245')
      )).toBe(true);
      expect(commands.some((command) =>
        command.includes('status-style fg=colour245,bg=colour236')
      )).toBe(true);
      expect(commands.some((command) =>
        command.includes('pane-active-border-style fg=colour141')
      )).toBe(false);
    } finally {
      await fs.rm(homeDir, { recursive: true, force: true });
    }
  });
});
