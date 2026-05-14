import { mkdtemp, realpath, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filterCovenSessionsForProjectRoots,
  listCovenSessionsFromDaemon,
  parseCovenSessionsJson,
} from '../src/utils/covenSessions.js';

async function tempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

describe('coven session adapter', () => {
  it('parses array and snake_case sessions from coven sessions --json', () => {
    const sessions = parseCovenSessionsJson(JSON.stringify([
      {
        id: 'session-1',
        project_root: '/repo',
        harness: 'codex',
        title: 'Fix tests',
        status: 'running',
        created_at: '2026-04-28T12:00:00.000Z',
        updated_at: '2026-04-28T12:01:00.000Z',
      },
    ]));

    expect(sessions).toEqual([
      {
        id: 'session-1',
        projectRoot: '/repo',
        cwd: undefined,
        harness: 'codex',
        title: 'Fix tests',
        status: 'running',
        createdAt: '2026-04-28T12:00:00.000Z',
        updatedAt: '2026-04-28T12:01:00.000Z',
      },
    ]);
  });

  it('parses object responses and skips records without a verified session id/root', () => {
    const sessions = parseCovenSessionsJson(JSON.stringify({
      sessions: [
        { id: 'session-2', projectRoot: '/repo', title: 'Ship Coven panel' },
        { id: 'missing-root' },
        { projectRoot: '/repo' },
      ],
    }));

    expect(sessions.map((session) => session.id)).toEqual(['session-2']);
  });

  it('loads sessions from the current Coven daemon API by default', async () => {
    const result = await listCovenSessionsFromDaemon({
      client: {
        listSessions: async () => [
          {
            id: 'session-3',
            projectRoot: '/repo',
            harness: 'claude',
            title: 'Review branch',
            status: 'running',
            createdAt: '2026-05-10T08:00:00Z',
            updatedAt: '2026-05-10T08:01:00Z',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      status: 'ready',
      source: 'coven daemon API',
      sessions: [{ id: 'session-3', harness: 'claude' }],
    });
  });

  it('filters sessions to verified comux project roots', async () => {
    const root = await tempDir('comux-coven-root-');
    const child = await tempDir('comux-coven-root-child-');
    const outside = await tempDir('comux-coven-outside-');
    const realRoot = await realpath(root);

    // Put the child under the root without relying on symlinks.
    const nested = path.join(root, path.basename(child));
    await rename(child, nested);

    const visible = await filterCovenSessionsForProjectRoots([
      { id: 'inside', projectRoot: root, title: 'Inside' },
      { id: 'nested', projectRoot: nested, title: 'Nested' },
      { id: 'outside', projectRoot: outside, title: 'Outside' },
      { id: 'missing', projectRoot: path.join(root, 'nope'), title: 'Missing' },
    ], [root]);

    expect(realRoot).toBe(await realpath(root));
    expect(visible.map((session) => session.id)).toEqual(['inside', 'nested']);
  });
});
