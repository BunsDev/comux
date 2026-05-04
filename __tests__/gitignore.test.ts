import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureComuxRuntimeIgnored } from '../src/utils/gitignore.js';

describe('ensureComuxRuntimeIgnored', () => {
  it('adds the canonical .comux* entry to .gitignore', async () => {
    const repo = await fsp.mkdtemp(path.join(os.tmpdir(), 'comux-gitignore-'));

    try {
      fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules/');

      const result = ensureComuxRuntimeIgnored(repo);

      expect(result.addedEntries).toEqual(['.comux*']);
      expect(fs.readFileSync(path.join(repo, '.gitignore'), 'utf8')).toBe(
        'node_modules/\n.comux*\n'
      );
    } finally {
      await fsp.rm(repo, { recursive: true, force: true });
    }
  });

  it('adds .comux* when only one runtime path is already covered', async () => {
    const repo = await fsp.mkdtemp(path.join(os.tmpdir(), 'comux-gitignore-'));

    try {
      fs.writeFileSync(path.join(repo, '.gitignore'), '.comux/\n');

      const result = ensureComuxRuntimeIgnored(repo);

      expect(result.addedEntries).toEqual(['.comux*']);
      expect(fs.readFileSync(path.join(repo, '.gitignore'), 'utf8')).toBe('.comux/\n.comux*\n');
    } finally {
      await fsp.rm(repo, { recursive: true, force: true });
    }
  });

  it('is idempotent when .comux* already exists', async () => {
    const repo = await fsp.mkdtemp(path.join(os.tmpdir(), 'comux-gitignore-'));

    try {
      fs.writeFileSync(path.join(repo, '.gitignore'), '.comux*\n');

      const result = ensureComuxRuntimeIgnored(repo);

      expect(result.addedEntries).toEqual([]);
      expect(fs.readFileSync(path.join(repo, '.gitignore'), 'utf8')).toBe('.comux*\n');
    } finally {
      await fsp.rm(repo, { recursive: true, force: true });
    }
  });

  it('does not append .comux* when existing rules already cover runtime paths', async () => {
    const repo = await fsp.mkdtemp(path.join(os.tmpdir(), 'comux-gitignore-'));

    try {
      execSync('git init', { cwd: repo, stdio: 'pipe' });
      fs.writeFileSync(path.join(repo, '.gitignore'), '.comux/\n.comux-hooks/\n');

      const result = ensureComuxRuntimeIgnored(repo);

      expect(result.addedEntries).toEqual([]);
      expect(fs.readFileSync(path.join(repo, '.gitignore'), 'utf8')).toBe('.comux/\n.comux-hooks/\n');
    } finally {
      await fsp.rm(repo, { recursive: true, force: true });
    }
  });

  it('can be applied inside a freshly-created pane worktree', async () => {
    const repo = await fsp.mkdtemp(path.join(os.tmpdir(), 'comux-gitignore-repo-'));
    const worktreePath = path.join(repo, '.comux', 'worktrees', 'pane-a');

    try {
      execSync('git init', { cwd: repo, stdio: 'pipe' });
      fs.writeFileSync(path.join(repo, 'README.md'), '# Test repo\n');
      execSync('git add README.md', { cwd: repo, stdio: 'pipe' });
      execSync('git -c user.name=Comux -c user.email=comux@example.com -c commit.gpgsign=false commit -m init', {
        cwd: repo,
        stdio: 'pipe',
      });

      // Mirrors comux startup: the parent checkout may have local ignore edits
      // that a brand-new git worktree does not inherit from HEAD.
      fs.writeFileSync(path.join(repo, '.gitignore'), '.comux*\n');
      fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
      execSync(`git worktree add "${worktreePath}" -b pane-a`, { cwd: repo, stdio: 'pipe' });

      expect(fs.existsSync(path.join(worktreePath, '.gitignore'))).toBe(false);

      const result = ensureComuxRuntimeIgnored(worktreePath);

      expect(result.addedEntries).toEqual(['.comux*']);
      expect(fs.readFileSync(path.join(worktreePath, '.gitignore'), 'utf8')).toBe('.comux*\n');
    } finally {
      try {
        execSync(`git worktree remove --force "${worktreePath}"`, { cwd: repo, stdio: 'pipe' });
      } catch {}
      await fsp.rm(repo, { recursive: true, force: true });
    }
  });
});
