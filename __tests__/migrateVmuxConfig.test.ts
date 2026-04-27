import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { migrateVmuxConfigIfNeeded } from '../src/utils/migrateVmuxConfig.js';

describe('migrateVmuxConfigIfNeeded', () => {
  it('copies legacy .vmux/vmux.config.json into .comux/comux.config.json when .comux is missing', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'comux-vmux-migration-'));

    try {
      const legacyDir = join(projectRoot, '.vmux');
      await mkdir(legacyDir, { recursive: true });
      const legacyConfig = {
        projectName: 'legacy-project',
        panes: [{ id: 'pane-1', title: 'Legacy pane' }],
      };
      writeFileSync(join(legacyDir, 'vmux.config.json'), JSON.stringify(legacyConfig, null, 2), 'utf-8');

      const result = await migrateVmuxConfigIfNeeded(projectRoot);

      const migratedConfigPath = join(projectRoot, '.comux', 'comux.config.json');
      expect(JSON.parse(readFileSync(migratedConfigPath, 'utf-8'))).toEqual(legacyConfig);
      expect(result.migrated).toBe(true);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('does not overwrite existing .comux/comux.config.json', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'comux-vmux-migration-'));

    try {
      const legacyDir = join(projectRoot, '.vmux');
      const comuxDir = join(projectRoot, '.comux');
      await mkdir(legacyDir, { recursive: true });
      await mkdir(comuxDir, { recursive: true });

      const existingConfig = { projectName: 'comux-project', panes: [] };
      const legacyConfig = { projectName: 'legacy-project', panes: [{ id: 'pane-1' }] };
      const comuxConfigPath = join(comuxDir, 'comux.config.json');

      writeFileSync(join(legacyDir, 'vmux.config.json'), JSON.stringify(legacyConfig, null, 2), 'utf-8');
      writeFileSync(comuxConfigPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      const result = await migrateVmuxConfigIfNeeded(projectRoot);

      expect(JSON.parse(readFileSync(comuxConfigPath, 'utf-8'))).toEqual(existingConfig);
      expect(result.migrated).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
