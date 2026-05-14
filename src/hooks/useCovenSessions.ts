import { useEffect, useMemo, useState } from 'react';
import type { SidebarProject } from '../types.js';
import {
  filterCovenSessionsForProjectRoots,
  listCovenSessionsFromDaemon,
  listCovenSessionsFromCli,
  type CovenSessionsLoadState,
} from '../utils/covenSessions.js';

export interface UseCovenSessionsOptions {
  enabled?: boolean;
  refreshMs?: number;
  command?: string;
}

const INITIAL_COVEN_STATE: CovenSessionsLoadState = {
  status: 'empty',
  sessions: [],
  source: 'coven sessions --json',
  loadedAt: '',
};

export function useCovenSessions(
  sessionProjectRoot: string,
  sidebarProjects: SidebarProject[],
  options: UseCovenSessionsOptions = {},
): CovenSessionsLoadState {
  const enabled = options.enabled ?? !isVitest();
  const refreshMs = options.refreshMs ?? 15_000;
  const [state, setState] = useState<CovenSessionsLoadState>(INITIAL_COVEN_STATE);

  const projectRoots = useMemo(() => {
    const roots = [sessionProjectRoot];
    for (const project of sidebarProjects) {
      roots.push(project.projectRoot);
    }
    return Array.from(new Set(roots.filter(Boolean)));
  }, [sessionProjectRoot, sidebarProjects]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const load = async () => {
      const result = options.command
        ? await listCovenSessionsFromCli({ command: options.command })
        : await listCovenSessionsFromDaemon();
      if (cancelled) return;

      if (result.status === 'unavailable') {
        setState(result);
        return;
      }

      const sessions = await filterCovenSessionsForProjectRoots(result.sessions, projectRoots);
      if (cancelled) return;

      const loadedAt = result.loadedAt;
      setState(sessions.length > 0
        ? { status: 'ready', sessions, source: result.source, loadedAt }
        : { status: 'empty', sessions: [], source: result.source, loadedAt });
    };

    void load();
    const timer = setInterval(() => {
      void load();
    }, refreshMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, options.command, projectRoots, refreshMs]);

  return state;
}

function isVitest(): boolean {
  return typeof process !== 'undefined' && !!process.env.VITEST_WORKER_ID;
}

export default useCovenSessions;
