/**
 * Mock VmuxPane fixtures for testing
 */

import type { VmuxPane } from '../../src/types.js';

export function createMockPane(overrides?: Partial<VmuxPane>): VmuxPane {
  return {
    id: 'vmux-1',
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

export function createShellPane(overrides?: Partial<VmuxPane>): VmuxPane {
  return createMockPane({
    type: 'shell',
    worktreePath: undefined,
    ...overrides,
  });
}

export function createWorktreePane(overrides?: Partial<VmuxPane>): VmuxPane {
  return createMockPane({
    type: 'worktree',
    worktreePath: '/test/project/.vmux/worktrees/test-pane',
    ...overrides,
  });
}

export function createMultiplePanes(count: number): VmuxPane[] {
  return Array.from({ length: count }, (_, i) => createMockPane({
    id: `vmux-${i + 1}`,
    slug: `test-pane-${i + 1}`,
    paneId: `%${40 + i}`,
  }));
}
