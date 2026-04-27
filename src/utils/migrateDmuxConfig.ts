import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createInterface } from 'node:readline/promises';

/**
 * Migrates legacy dmux configuration to comux on first run.
 * Detects .dmux/ project config and ~/.dmux/ global state,
 * and offers to copy them to .comux/ and ~/.comux/ respectively.
 */
export async function migrateDmuxConfigIfNeeded(projectRoot: string): Promise<void> {
  const projectDmuxDir = path.join(projectRoot, '.dmux');
  const projectComuxDir = path.join(projectRoot, '.comux');
  const globalDmuxDir = path.join(os.homedir(), '.dmux');
  const globalComuxDir = path.join(os.homedir(), '.comux');

  const [projectDmuxExists, projectComuxExists, globalDmuxExists, globalComuxExists] =
    await Promise.all([
      dirExists(projectDmuxDir),
      dirExists(projectComuxDir),
      dirExists(globalDmuxDir),
      dirExists(globalComuxDir),
    ]);

  const needsProjectMigration = projectDmuxExists && !projectComuxExists;
  const needsGlobalMigration = globalDmuxExists && !globalComuxExists;

  if (!needsProjectMigration && !needsGlobalMigration) {
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    if (needsProjectMigration) {
      const answer = await rl.question(
        `comux detected a legacy .dmux/ directory in this project.\n` +
        `Migrate config to .comux/? (y/N): `
      );
      if (answer.trim().toLowerCase() === 'y') {
        await copyDir(projectDmuxDir, projectComuxDir);
        console.log(`Migrated .dmux/ → .comux/`);
      }
    }

    if (needsGlobalMigration) {
      const answer = await rl.question(
        `comux detected a legacy ~/.dmux/ directory.\n` +
        `Migrate global state to ~/.comux/? (y/N): `
      );
      if (answer.trim().toLowerCase() === 'y') {
        await copyDir(globalDmuxDir, globalComuxDir);
        console.log(`Migrated ~/.dmux/ → ~/.comux/`);
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
