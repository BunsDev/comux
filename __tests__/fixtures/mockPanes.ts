/**
 * Mock ComuxPane fixtures for testing
 */

import type { ComuxPane } from '../../src/types.js';

export function createMockPane(overrides?: Partial<ComuxPane>): ComuxPane {
  return {
    id: 'comux-1',
    slug: 'test-pane',
    prompt: 'test prompt',
    paneId: '%42',
    worktreePath: '/test/worktree/path',
    agent: 'claude',
    type: 'worktree',
    autopilot: false,
    ...overrides,
  };
}

export function createShellPane(overrides?: Partial<ComuxPane>): ComuxPane {
  return createMockPane({
    type: 'shell',
    worktreePath: undefined,
    ...overrides,
  });
}

export function createWorktreePane(overrides?: Partial<ComuxPane>): ComuxPane {
  return createMockPane({
    type: 'worktree',
    worktreePath: '/test/project/.comux/worktrees/test-pane',
    ...overrides,
  });
}

export function createMultiplePanes(count: number): ComuxPane[] {
  return Array.from({ length: count }, (_, i) => createMockPane({
    id: `comux-${i + 1}`,
    slug: `test-pane-${i + 1}`,
    paneId: `%${40 + i}`,
  }));
}
