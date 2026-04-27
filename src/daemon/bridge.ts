import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AGENT_IDS, buildAgentCommand, buildInitialPromptCommand, type AgentName } from '../utils/agentLaunch.js';
import { buildPromptReadAndDeleteSnippet, writePromptFile } from '../utils/promptStore.js';
import type { ComuxConfig } from '../types.js';
import type { PaneStatusResult, PaneSummary, ProjectSummary } from './protocol.js';

export const DEFAULT_CAPTURE_LINES = 200;
export const MAX_CAPTURE_LINES = 2_000;

export interface ScopeCheckResult {
  projectRoot: string;
  requestedCwd: string;
}

export interface BridgeSpawnRequest {
  requestId: string;
  cwd: string;
  agent?: string;
  title?: string;
  prompt?: string;
  branch?: string;
}

export interface BridgeSpawnDeps {
  tmuxSessionExists: (name: string) => boolean;
  createTmuxPane: (sessionName: string, cwd: string, title?: string) => string;
  sendTmuxCommand: (paneId: string, command: string) => void;
}

export interface BridgeSpawnResult {
  id: string;
  pane: PaneSummary;
  worktreePath: string;
  branch: string;
}

export interface BridgeError {
  code: string;
  message: string;
}

interface RawConfigPane extends Record<string, unknown> {
  id?: string;
  paneId?: string;
  slug?: string;
  title?: string;
  displayName?: string;
  worktreePath?: string;
  worktreeDir?: string;
  cwd?: string;
  branch?: string;
  branchName?: string;
  agent?: string;
  agentStatus?: string;
  needsAttention?: boolean;
  lastUpdated?: string;
}

interface BridgeConfig extends Omit<Partial<ComuxConfig>, 'panes'> {
  panes?: RawConfigPane[];
}

export function isPathInsideOrEqual(parent: string, candidate: string): boolean {
  const rel = path.relative(parent, candidate);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

export async function resolveScopedCwd(projectRoot: string, cwd?: string): Promise<ScopeCheckResult> {
  const rootReal = await realpath(projectRoot);
  const requestedPath = cwd ? path.resolve(rootReal, cwd) : rootReal;
  let requestedReal: string;
  try {
    requestedReal = await realpath(requestedPath);
  } catch {
    throw new Error(`cwd does not exist inside the comux project root`);
  }

  if (!isPathInsideOrEqual(rootReal, requestedReal)) {
    throw new Error(`cwd is outside the comux project root`);
  }

  return { projectRoot: rootReal, requestedCwd: requestedReal };
}

export async function buildScopedProject(
  projectRoot: string,
  cwd?: string,
  options: { title?: string; autonomyProfile?: string } = {},
): Promise<ProjectSummary> {
  const scoped = await resolveScopedCwd(projectRoot, cwd);
  return {
    id: scoped.projectRoot,
    root: scoped.projectRoot,
    cwd: scoped.projectRoot,
    title: options.title || path.basename(scoped.projectRoot),
    autonomyProfile: options.autonomyProfile,
  };
}

export async function listScopedProjects(projectRoot: string): Promise<ProjectSummary[]> {
  return [await buildScopedProject(projectRoot)];
}

export function boundedLineCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CAPTURE_LINES;
  return Math.min(MAX_CAPTURE_LINES, Math.max(1, Math.trunc(value)));
}

export function tailTextLines(text: string, requestedLines: unknown): string {
  const lines = boundedLineCount(requestedLines);
  const normalized = text.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n');
  return parts.slice(-lines).join('\n');
}

export function capturePaneText(
  paneId: string,
  requestedLines: unknown,
  capture: (id: string) => Buffer,
): { id: string; text: string; lines: number } {
  const lines = boundedLineCount(requestedLines);
  const text = capture(paneId).toString('utf8');
  return { id: paneId, text: tailTextLines(text, lines), lines };
}

export async function resolveConfiguredPaneId(projectRoot: string, paneId: string): Promise<string> {
  const config = await readBridgeConfig(projectRoot);
  const pane = findRawPane(config, paneId);
  if (!pane) {
    throw bridgeError('pane_not_found', 'pane is not registered in this comux project');
  }
  return String(pane.paneId ?? pane.id ?? paneId);
}

export async function readPaneStatus(
  projectRoot: string,
  paneId: string,
  exists: (id: string) => boolean | undefined = () => undefined,
): Promise<PaneStatusResult> {
  const config = await readBridgeConfig(projectRoot);
  const pane = findRawPane(config, paneId);
  if (!pane) {
    return { id: paneId, status: 'unknown' };
  }

  const tmuxPaneId = String(pane.paneId ?? pane.id ?? paneId);
  const existsValue = exists(tmuxPaneId);
  const summary = rawPaneToSummary(pane, projectRoot);

  return {
    id: tmuxPaneId,
    exists: existsValue,
    status: typeof pane.agentStatus === 'string' ? pane.agentStatus : 'unknown',
    pane: summary,
    metadata: {
      comuxId: typeof pane.id === 'string' ? pane.id : undefined,
      title: typeof pane.title === 'string' ? pane.title : typeof pane.displayName === 'string' ? pane.displayName : undefined,
      agent: typeof pane.agent === 'string' ? pane.agent : undefined,
      branch: typeof pane.branchName === 'string' ? pane.branchName : typeof pane.branch === 'string' ? pane.branch : undefined,
      cwd: String(pane.worktreePath ?? pane.worktreeDir ?? pane.cwd ?? projectRoot),
      needsAttention: typeof pane.needsAttention === 'boolean' ? pane.needsAttention : undefined,
      lastActivity: typeof pane.lastUpdated === 'string' ? pane.lastUpdated : undefined,
    },
  };
}

export async function spawnBridgePane(
  projectRoot: string,
  sessionName: string,
  request: BridgeSpawnRequest,
  deps: BridgeSpawnDeps = defaultSpawnDeps,
): Promise<BridgeSpawnResult> {
  const scoped = await resolveScopedCwd(projectRoot, request.cwd);
  if (!deps.tmuxSessionExists(sessionName)) {
    throw bridgeError('tmux_session_missing', 'comux tmux session is not running; start comux for this project first');
  }

  const agent = normalizeAgent(request.agent);
  const slug = await uniqueSlug(scoped.projectRoot, slugFromRequest(request));
  const branch = await resolveSpawnBranch(scoped.projectRoot, request.branch, slug);
  const worktreesRoot = await ensureGeneratedWorktreesRoot(scoped.projectRoot);
  const worktreePath = path.join(worktreesRoot, slug);
  assertGeneratedWorktreePath(scoped.projectRoot, worktreePath);

  createGitWorktree(scoped.projectRoot, worktreePath, branch);

  const title = request.title || slug;
  const paneId = deps.createTmuxPane(sessionName, worktreePath, title);
  const now = new Date().toISOString();
  const config = await readBridgeConfig(scoped.projectRoot);
  const pane: RawConfigPane = {
    id: `comux-${Date.now()}`,
    slug,
    title,
    displayName: title,
    prompt: request.prompt || '',
    paneId,
    projectRoot: scoped.projectRoot,
    projectName: path.basename(scoped.projectRoot),
    type: 'worktree',
    worktreePath,
    branchName: branch,
    branch,
    agent,
    agentStatus: agent ? 'working' : 'idle',
    lastUpdated: now,
  };
  config.projectName = config.projectName || path.basename(scoped.projectRoot);
  config.projectRoot = scoped.projectRoot;
  config.settings = config.settings || {};
  config.panes = [...(Array.isArray(config.panes) ? config.panes : []), pane];
  config.lastUpdated = now;
  await writeBridgeConfig(scoped.projectRoot, config);

  if (agent) {
    const launchCommand = await buildLaunchCommand(scoped.projectRoot, slug, agent, request.prompt, config.settings?.permissionMode);
    deps.sendTmuxCommand(paneId, launchCommand);
  }

  return {
    id: paneId,
    pane: rawPaneToSummary(pane, scoped.projectRoot),
    worktreePath,
    branch,
  };
}

export function tmuxPaneExists(paneId: string): boolean | undefined {
  try {
    execFileSync('tmux', ['display-message', '-p', '-t', paneId, '#{pane_id}'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function createTmuxPane(sessionName: string, cwd: string, title?: string): string {
  const paneId = execFileSync('tmux', [
    'split-window',
    '-d',
    '-P',
    '-F',
    '#{pane_id}',
    '-t',
    sessionName,
    '-c',
    cwd,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

  if (title) {
    try {
      execFileSync('tmux', ['select-pane', '-t', paneId, '-T', title], { stdio: 'ignore' });
    } catch {
      // Title is cosmetic; the pane id is still usable.
    }
  }

  return paneId;
}

export function sendTmuxCommand(paneId: string, command: string): void {
  execFileSync('tmux', ['send-keys', '-t', paneId, command, 'C-m'], { stdio: 'ignore' });
}

export const defaultSpawnDeps: BridgeSpawnDeps = {
  tmuxSessionExists: (name) => {
    try {
      execFileSync('tmux', ['has-session', '-t', name], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },
  createTmuxPane,
  sendTmuxCommand,
};

async function readBridgeConfig(projectRoot: string): Promise<BridgeConfig> {
  const configPath = bridgeConfigPath(projectRoot);
  try {
    const raw = await readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as BridgeConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {
      projectName: path.basename(projectRoot),
      projectRoot,
      panes: [],
      settings: {},
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function writeBridgeConfig(projectRoot: string, config: BridgeConfig): Promise<void> {
  const configPath = bridgeConfigPath(projectRoot);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

function bridgeConfigPath(projectRoot: string): string {
  return path.join(projectRoot, '.comux', 'comux.config.json');
}

function findRawPane(config: BridgeConfig, paneId: string): RawConfigPane | undefined {
  const panes = Array.isArray(config.panes) ? config.panes : [];
  return panes.find((pane) => pane.id === paneId || pane.paneId === paneId);
}

function rawPaneToSummary(pane: RawConfigPane, projectRoot: string): PaneSummary {
  const tmuxId = String(pane.paneId ?? pane.id ?? '');
  const title =
    typeof pane.title === 'string' ? pane.title :
    typeof pane.displayName === 'string' ? pane.displayName :
    typeof pane.slug === 'string' ? pane.slug :
    typeof pane.id === 'string' ? pane.id : undefined;

  return {
    id: tmuxId,
    cwd: String(pane.worktreePath ?? pane.worktreeDir ?? pane.cwd ?? projectRoot),
    branch: typeof pane.branchName === 'string' ? pane.branchName : typeof pane.branch === 'string' ? pane.branch : undefined,
    agent: typeof pane.agent === 'string' ? pane.agent : undefined,
    title,
    lastActivity: typeof pane.lastUpdated === 'string' ? pane.lastUpdated : undefined,
  };
}

function normalizeAgent(agent: string | undefined): AgentName | undefined {
  if (!agent) return undefined;
  if ((AGENT_IDS as readonly string[]).includes(agent)) return agent as AgentName;
  throw bridgeError('invalid_agent', `unsupported agent: ${agent}`);
}

function slugFromRequest(request: BridgeSpawnRequest): string {
  const source = request.title || request.branch || request.prompt || request.requestId || 'bridge-pane';
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/[/.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'bridge-pane';
}

async function uniqueSlug(projectRoot: string, baseSlug: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const slug = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`;
    const worktreePath = path.join(projectRoot, '.comux', 'worktrees', slug);
    try {
      await realpath(worktreePath);
    } catch {
      return slug;
    }
  }
  throw bridgeError('slug_exhausted', 'could not allocate a unique comux worktree slug');
}

async function resolveSpawnBranch(projectRoot: string, requestedBranch: string | undefined, slug: string): Promise<string> {
  const base = requestedBranch || `comux/${slug}`;
  if (!isValidBridgeBranchName(base)) {
    throw bridgeError('invalid_branch', 'branch must be a safe local git branch name');
  }

  if (requestedBranch) return base;

  for (let i = 0; i < 100; i++) {
    const branch = i === 0 ? base : `${base}-${i + 1}`;
    if (!gitBranchExists(projectRoot, branch)) return branch;
  }
  throw bridgeError('branch_exhausted', 'could not allocate a unique comux branch');
}

function createGitWorktree(projectRoot: string, worktreePath: string, branch: string): void {
  assertGeneratedWorktreePath(projectRoot, worktreePath);
  try {
    execFileSync('git', ['-C', projectRoot, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
    execFileSync('git', ['-C', projectRoot, 'worktree', 'prune'], { stdio: 'ignore' });
    if (gitBranchExists(projectRoot, branch)) {
      execFileSync('git', ['-C', projectRoot, 'worktree', 'add', worktreePath, branch], { stdio: 'pipe' });
    } else {
      execFileSync('git', ['-C', projectRoot, 'worktree', 'add', worktreePath, '-b', branch], { stdio: 'pipe' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw bridgeError('worktree_create_failed', `failed to create scoped worktree: ${message}`);
  }
}

function gitBranchExists(projectRoot: string, branch: string): boolean {
  try {
    execFileSync('git', ['-C', projectRoot, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isValidBridgeBranchName(branch: string): boolean {
  if (!branch || branch.includes('..') || branch.startsWith('/') || branch.endsWith('/') || branch.includes(' ')) {
    return false;
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) return false;
  try {
    execFileSync('git', ['check-ref-format', '--branch', branch], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function ensureGeneratedWorktreesRoot(projectRoot: string): Promise<string> {
  const worktreesRoot = path.join(projectRoot, '.comux', 'worktrees');
  await mkdir(worktreesRoot, { recursive: true });
  const rootReal = await realpath(projectRoot);
  const worktreesReal = await realpath(worktreesRoot);
  if (!isPathInsideOrEqual(rootReal, worktreesReal)) {
    throw bridgeError('invalid_worktree_path', 'project .comux/worktrees resolves outside the daemon project root');
  }
  return worktreesRoot;
}

function assertGeneratedWorktreePath(projectRoot: string, worktreePath: string): void {
  const worktreesRoot = path.join(projectRoot, '.comux', 'worktrees');
  if (!isPathInsideOrEqual(worktreesRoot, worktreePath) || worktreePath === worktreesRoot) {
    throw bridgeError('invalid_worktree_path', 'generated worktree path escaped the project .comux/worktrees directory');
  }
}

async function buildLaunchCommand(
  projectRoot: string,
  slug: string,
  agent: AgentName,
  prompt: string | undefined,
  permissionMode: ComuxConfig['settings']['permissionMode'],
): Promise<string> {
  if (!prompt || !prompt.trim()) {
    return buildAgentCommand(agent, permissionMode);
  }

  const promptFile = await writePromptFile(projectRoot, slug, prompt);
  return `${buildPromptReadAndDeleteSnippet(promptFile)}; ${buildInitialPromptCommand(
    agent,
    '"$COMUX_PROMPT_CONTENT"',
    permissionMode,
  )}`;
}

function bridgeError(code: string, message: string): Error & BridgeError {
  const error = new Error(message) as Error & BridgeError;
  error.code = code;
  error.message = message;
  return error;
}

export function bridgeErrorCode(error: unknown, fallback: string): string {
  return typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : fallback;
}

export function bridgeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
