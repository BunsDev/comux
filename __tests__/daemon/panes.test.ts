import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listPanes } from '../../src/daemon/panes.js';
import { updatePaneMeta } from '../../src/daemon/index.js';

let tempRoots: string[] = [];

async function writeConfig(config: unknown): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'vmux-daemon-panes-'));
  tempRoots.push(root);
  const vmuxDir = path.join(root, '.vmux');
  await mkdir(vmuxDir, { recursive: true });
  await writeFile(path.join(vmuxDir, 'vmux.config.json'), JSON.stringify(config, null, 2));
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
  tempRoots = [];
});

describe('daemon pane config helpers', () => {
  it('lists tmux pane identifiers while preserving vmux ids as fallback titles', async () => {
    const root = await writeConfig({
      panes: [
        {
          id: 'vmux-2',
          paneId: '%3',
          worktreeDir: '/repo/worktree',
          branch: 'feature',
          agent: 'codex',
        },
      ],
    });

    await expect(listPanes(root)).resolves.toEqual([
      {
        id: '%3',
        cwd: '/repo/worktree',
        branch: 'feature',
        agent: 'codex',
        title: 'vmux-2',
        lastActivity: undefined,
      },
    ]);
  });

  it('updates pane metadata by tmux pane id from panes.list results', async () => {
    const root = await writeConfig({
      panes: [
        {
          id: 'vmux-2',
          paneId: '%3',
          title: 'old title',
          agent: 'codex',
        },
      ],
    });

    await updatePaneMeta(root, '%3', { title: 'new title', agent: 'claude' });

    const raw = await readFile(path.join(root, '.vmux', 'vmux.config.json'), 'utf8');
    expect(JSON.parse(raw)).toMatchObject({
      panes: [{ id: 'vmux-2', paneId: '%3', title: 'new title', agent: 'claude' }],
    });
  });
});
