import fs from 'fs/promises';
import path from 'path';

export type VmuxMigrationResult = {
  migrated: boolean;
  reason: 'comux-config-exists' | 'legacy_config_missing' | 'legacy-config-copied';
  sourcePath: string;
  targetPath: string;
};

export async function migrateVmuxConfigIfNeeded(projectRoot: string): Promise<VmuxMigrationResult> {
  const targetPath = path.join(projectRoot, '.comux', 'comux.config.json');
  const sourcePath = path.join(projectRoot, '.vmux', 'vmux.config.json');

  if (await fileExists(targetPath)) {
    return {
      migrated: false,
      reason: 'comux-config-exists',
      sourcePath,
      targetPath,
    };
  }

  if (!await fileExists(sourcePath)) {
    return {
      migrated: false,
      reason: 'legacy_config_missing',
      sourcePath,
      targetPath,
    };
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await fs.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      return {
        migrated: false,
        reason: 'comux-config-exists',
        sourcePath,
        targetPath,
      };
    }
    throw error;
  }

  return {
    migrated: true,
    reason: 'legacy-config-copied',
    sourcePath,
    targetPath,
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
