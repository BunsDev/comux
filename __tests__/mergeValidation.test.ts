import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'child_process';
import { getGitStatus } from '../src/utils/mergeValidation.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('mergeValidation', () => {
  beforeEach(() => {
    vi.mocked(execSync).mockReset();
  });

  it('ignores vmux metadata directories when checking git status', () => {
    vi.mocked(execSync).mockReturnValue(
      '?? .vmux/\nM  .vmux/worktrees/feature-a\n'
    );

    const status = getGitStatus('/repo');

    expect(status).toEqual({
      hasChanges: false,
      files: [],
      summary: '',
    });
  });

  it('ignores untracked hook scaffolding but preserves real hook changes', () => {
    vi.mocked(execSync).mockReturnValue(
      [
        '?? .vmux-hooks/',
        '?? .vmux-hooks/AGENTS.md',
        '?? .vmux-hooks/examples/pre_merge.example',
        ' M .vmux-hooks/pre_merge',
        '?? .vmux-hooks/custom_hook',
      ].join('\n')
    );

    const status = getGitStatus('/repo');

    expect(status).toEqual({
      hasChanges: true,
      files: [
        '.vmux-hooks/pre_merge',
        '.vmux-hooks/custom_hook',
      ],
      summary: ' M .vmux-hooks/pre_merge\n?? .vmux-hooks/custom_hook',
    });
  });

  it('keeps non-vmux files in the dirty-state result', () => {
    vi.mocked(execSync).mockReturnValue(
      ' M src/index.ts\nM package.json\n'
    );

    const status = getGitStatus('/repo');

    expect(status).toEqual({
      hasChanges: true,
      files: ['src/index.ts', 'package.json'],
      summary: 'M src/index.ts\nM package.json',
    });
  });
});
