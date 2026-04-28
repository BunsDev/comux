import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import path from 'node:path';

export type CovenSessionVisibilityStatus =
  | 'created'
  | 'starting'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'killed'
  | 'orphaned'
  | string;

export interface CovenSessionVisibility {
  id: string;
  projectRoot: string;
  cwd?: string;
  harness?: string;
  title?: string;
  status?: CovenSessionVisibilityStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type CovenSessionsLoadState =
  | {
      status: 'ready';
      sessions: CovenSessionVisibility[];
      source: 'coven sessions --json';
      loadedAt: string;
    }
  | {
      status: 'empty';
      sessions: [];
      source: 'coven sessions --json';
      loadedAt: string;
    }
  | {
      status: 'unavailable';
      sessions: [];
      reason: string;
      loadedAt: string;
    };

export interface ListCovenSessionsOptions {
  command?: string;
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export function parseCovenSessionsJson(stdout: string): CovenSessionVisibility[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  const parsed = JSON.parse(trimmed) as unknown;
  const rawSessions = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.sessions)
      ? parsed.sessions
      : [];

  return rawSessions.flatMap((raw) => {
    const session = normalizeCovenSession(raw);
    return session ? [session] : [];
  });
}

export async function listCovenSessionsFromCli(
  options: ListCovenSessionsOptions = {},
): Promise<CovenSessionsLoadState> {
  const command = options.command || 'coven';
  const timeoutMs = options.timeoutMs ?? 1_500;

  try {
    const stdout = await execFileText(command, ['sessions', '--json'], {
      cwd: options.cwd,
      timeout: timeoutMs,
      env: options.env,
    });
    const sessions = parseCovenSessionsJson(stdout);
    const loadedAt = new Date().toISOString();
    return sessions.length > 0
      ? { status: 'ready', sessions, source: 'coven sessions --json', loadedAt }
      : { status: 'empty', sessions: [], source: 'coven sessions --json', loadedAt };
  } catch (error) {
    return {
      status: 'unavailable',
      sessions: [],
      reason: describeCovenUnavailable(error),
      loadedAt: new Date().toISOString(),
    };
  }
}

export async function filterCovenSessionsForProjectRoots(
  sessions: CovenSessionVisibility[],
  projectRoots: string[],
): Promise<CovenSessionVisibility[]> {
  const scopedRoots = await realpathExisting(projectRoots);
  if (scopedRoots.length === 0) return [];

  const visible: CovenSessionVisibility[] = [];
  for (const session of sessions) {
    const candidateRoot = session.projectRoot || session.cwd;
    if (!candidateRoot) continue;

    const realSessionRoot = await realpathExistingOne(candidateRoot);
    if (!realSessionRoot) continue;

    if (scopedRoots.some((root) => isPathInsideOrEqual(root, realSessionRoot))) {
      visible.push({ ...session, projectRoot: realSessionRoot });
    }
  }

  return visible;
}

export function groupCovenSessionsByProject(
  sessions: CovenSessionVisibility[],
): Map<string, CovenSessionVisibility[]> {
  const grouped = new Map<string, CovenSessionVisibility[]>();
  for (const session of sessions) {
    const root = path.resolve(session.projectRoot);
    const current = grouped.get(root) || [];
    current.push(session);
    grouped.set(root, current);
  }
  return grouped;
}

export function isPathInsideOrEqual(parent: string, candidate: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(candidate));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function normalizeCovenSession(raw: unknown): CovenSessionVisibility | null {
  if (!isRecord(raw)) return null;

  const id = stringValue(raw.id);
  const projectRoot = stringValue(raw.projectRoot) || stringValue(raw.project_root) || stringValue(raw.root);
  if (!id || !projectRoot) return null;

  return {
    id,
    projectRoot,
    cwd: stringValue(raw.cwd),
    harness: stringValue(raw.harness),
    title: stringValue(raw.title) || id,
    status: stringValue(raw.status),
    createdAt: stringValue(raw.createdAt) || stringValue(raw.created_at),
    updatedAt: stringValue(raw.updatedAt) || stringValue(raw.updated_at),
  };
}

function execFileText(
  command: string,
  args: string[],
  options: { cwd?: string; timeout: number; env?: NodeJS.ProcessEnv },
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeout,
      env: options.env,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function realpathExisting(paths: string[]): Promise<string[]> {
  const unique = Array.from(new Set(paths.filter(Boolean).map((value) => path.resolve(value))));
  const resolved = await Promise.all(unique.map(realpathExistingOne));
  return resolved.filter((value): value is string => !!value);
}

async function realpathExistingOne(value: string): Promise<string | null> {
  try {
    return await realpath(value);
  } catch {
    return null;
  }
}

function describeCovenUnavailable(error: unknown): string {
  if (isRecord(error)) {
    const code = stringValue(error.code);
    if (code === 'ENOENT') return 'coven CLI not found';
    if (code === 'ETIMEDOUT') return 'coven sessions --json timed out';

    const signal = stringValue(error.signal);
    if (signal === 'SIGTERM') return 'coven sessions --json timed out';

    const message = stringValue(error.message);
    if (message) return message.split('\n')[0] || 'coven sessions --json failed';
  }

  return error instanceof Error
    ? error.message.split('\n')[0] || 'coven sessions --json failed'
    : 'coven sessions --json unavailable';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
