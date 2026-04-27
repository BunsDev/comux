import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createInterface } from 'node:readline/promises';

/**
 * Migrates legacy dmux configuration to vmux on first run.
 * Detects .dmux/ project config and ~/.dmux/ global state,
 * and offers to copy them to .vmux/ and ~/.vmux/ respectively.
 */
export async function migrateDmuxConfigIfNeeded(projectRoot: string): Promise<void> {
  const projectDmuxDir = path.join(projectRoot, '.dmux');
  const projectVmuxDir = path.join(projectRoot, '.vmux');
  const globalDmuxDir = path.join(os.homedir(), '.dmux');
  const globalVmuxDir = path.join(os.homedir(), '.vmux');

  const [projectDmuxExists, projectVmuxExists, globalDmuxExists, globalVmuxExists] =
    await Promise.all([
      dirExists(projectDmuxDir),
      dirExists(projectVmuxDir),
      dirExists(globalDmuxDir),
      dirExists(globalVmuxDir),
    ]);

  const needsProjectMigration = projectDmuxExists && !projectVmuxExists;
  const needsGlobalMigration = globalDmuxExists && !globalVmuxExists;

  if (!needsProjectMigration && !needsGlobalMigration) {
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (needsProjectMigration) {
      const answer = await rl.question(
        `vmux detected a legacy .dmux/ directory in this project.\n` +
        `Migrate config to .vmux/? (y/N): `
      );
      if (answer.trim().toLowerCase() === 'y') {
        await copyDir(projectDmuxDir, projectVmuxDir);
        console.log(`Migrated .dmux/ → .vmux/`);
      }
    }

    if (needsGlobalMigration) {
      const answer = await rl.question(
        `vmux detected a legacy ~/.dmux/ directory.\n` +
        `Migrate global state to ~/.vmux/? (y/N): `
      );
      if (answer.trim().toLowerCase() === 'y') {
        await copyDir(globalDmuxDir, globalVmuxDir);
        console.log(`Migrated ~/.dmux/ → ~/.vmux/`);
      }
    }
  } finally {
    rl.close();
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
