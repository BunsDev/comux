import { useEffect, useMemo, useState } from 'react';
import type { ComuxPane } from '../types.js';
import { createCovenClient } from '../daemon/bridge.js';
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

export function useCovenDesktopUse(
  panes: ComuxPane[],
  options: UseCovenDesktopUseOptions = {},
): DesktopUseStateMap {
  const desktopPanes = useMemo(
    () => panes.filter(isDesktopUsePane),
    [panes],
  );
  const [state, setState] = useState<DesktopUseStateMap>(() => new Map());

  useEffect(() => {
    if (desktopPanes.length === 0) {
      setState(new Map());
      return;
    }

    let cancelled = false;
    const intervalMs = options.intervalMs ?? 2_000;
    const client = createCovenClient();

    const load = async () => {
      const next = new Map<string, DesktopUsePaneState>();
      for (const pane of desktopPanes) {
        const sessionId = getDesktopUseSessionId(pane);
        if (!sessionId) {
          next.set(pane.id, emptyDesktopUsePaneState(pane.id, undefined, 'No Coven session attached'));
          continue;
        }

        try {
          const [session, events] = await Promise.all([
            client.getSession?.(sessionId),
            client.listEvents?.(sessionId) ?? Promise.resolve([]),
          ]);
          next.set(pane.id, buildDesktopUseStateFromEvents(pane.id, sessionId, events, session));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          next.set(pane.id, emptyDesktopUsePaneState(pane.id, sessionId, message));
        }
      }

      if (!cancelled) {
        setState(next);
      }
    };

    void load();
    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [desktopPanes, options.intervalMs]);

  return state;
}

export default useCovenDesktopUse;
