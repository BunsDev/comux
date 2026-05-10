import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComuxPane } from '../types.js';
import { createCovenClient, type CovenClient } from '../daemon/bridge.js';
import type { CovenSessionEvent } from '../daemon/protocol.js';
import {
  buildDesktopUseStateFromEvents,
  emptyDesktopUsePaneState,
  getDesktopUseSessionId,
  isDesktopUsePane,
  type DesktopUsePaneState,
} from '../utils/covenDesktopUse.js';

export type DesktopUseStateMap = Map<string, DesktopUsePaneState>;

export interface UseCovenDesktopUseOptions {
  intervalMs?: number;
}

const MAX_CACHED_EVENTS_PER_SESSION = 200;

export interface DesktopUseLoadCache {
  eventsBySessionId: Map<string, CovenSessionEvent[]>;
  sinceBySessionId: Map<string, string>;
}

export function createDesktopUseLoadCache(): DesktopUseLoadCache {
  return {
    eventsBySessionId: new Map(),
    sinceBySessionId: new Map(),
  };
}

export async function loadCovenDesktopUseStates(
  desktopPanes: ComuxPane[],
  client: Pick<CovenClient, 'getSession' | 'listEvents'>,
  cache: DesktopUseLoadCache = createDesktopUseLoadCache(),
): Promise<DesktopUseStateMap> {
  const next = new Map<string, DesktopUsePaneState>();
  const panesBySessionId = new Map<string, ComuxPane[]>();

  for (const pane of desktopPanes) {
    const sessionId = getDesktopUseSessionId(pane);
    if (!sessionId) {
      next.set(pane.id, emptyDesktopUsePaneState(pane.id, undefined, 'No Coven session attached'));
      continue;
    }
    const panes = panesBySessionId.get(sessionId) ?? [];
    panes.push(pane);
    panesBySessionId.set(sessionId, panes);
  }

  pruneDesktopUseLoadCache(cache, new Set(panesBySessionId.keys()));

  await Promise.all([...panesBySessionId.entries()].map(async ([sessionId, panes]) => {
    try {
      const since = cache.sinceBySessionId.get(sessionId);
      const [session, newEvents] = await Promise.all([
        client.getSession?.(sessionId),
        client.listEvents?.(sessionId, since ? { since } : undefined) ?? Promise.resolve([]),
      ]);
      const events = mergeCachedEvents(cache.eventsBySessionId.get(sessionId) ?? [], newEvents);
      cache.eventsBySessionId.set(sessionId, events);
      const latestCreatedAt = events.at(-1)?.createdAt;
      if (latestCreatedAt) cache.sinceBySessionId.set(sessionId, latestCreatedAt);
      for (const pane of panes) {
        next.set(pane.id, buildDesktopUseStateFromEvents(pane.id, sessionId, events, session));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const pane of panes) {
        next.set(pane.id, emptyDesktopUsePaneState(pane.id, sessionId, message));
      }
    }
  }));

  return next;
}

function pruneDesktopUseLoadCache(cache: DesktopUseLoadCache, activeSessionIds: Set<string>): void {
  for (const sessionId of cache.eventsBySessionId.keys()) {
    if (!activeSessionIds.has(sessionId)) cache.eventsBySessionId.delete(sessionId);
  }
  for (const sessionId of cache.sinceBySessionId.keys()) {
    if (!activeSessionIds.has(sessionId)) cache.sinceBySessionId.delete(sessionId);
  }
}

function mergeCachedEvents(previousEvents: CovenSessionEvent[], newEvents: CovenSessionEvent[]): CovenSessionEvent[] {
  const byId = new Map<string, CovenSessionEvent>();
  for (const event of previousEvents) byId.set(event.id, event);
  for (const event of newEvents) byId.set(event.id, event);
  return [...byId.values()]
    .sort((lhs, rhs) => lhs.createdAt.localeCompare(rhs.createdAt) || lhs.id.localeCompare(rhs.id))
    .slice(-MAX_CACHED_EVENTS_PER_SESSION);
}

export function useCovenDesktopUse(
  panes: ComuxPane[],
  options: UseCovenDesktopUseOptions = {},
): DesktopUseStateMap {
  const desktopPanes = useMemo(
    () => panes.filter(isDesktopUsePane),
    [panes],
  );
  const [state, setState] = useState<DesktopUseStateMap>(() => new Map());
  const cacheRef = useRef<DesktopUseLoadCache>(createDesktopUseLoadCache());

  useEffect(() => {
    if (desktopPanes.length === 0) {
      cacheRef.current = createDesktopUseLoadCache();
      setState(new Map());
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const intervalMs = options.intervalMs ?? 2_000;
    const client = createCovenClient();

    const schedule = () => {
      if (!cancelled) {
        timer = setTimeout(() => void load(), intervalMs);
      }
    };

    const load = async () => {
      const next = await loadCovenDesktopUseStates(desktopPanes, client, cacheRef.current);
      if (!cancelled) {
        setState(next);
        schedule();
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [desktopPanes, options.intervalMs]);

  return state;
}

export default useCovenDesktopUse;
