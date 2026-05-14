import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import stripAnsi from 'strip-ansi';
import PanesGrid from '../src/components/panes/PanesGrid.js';
import type { CovenSessionsLoadState } from '../src/utils/covenSessions.js';

const READY_STATE: CovenSessionsLoadState = {
  status: 'ready',
  source: 'coven sessions --json',
  loadedAt: '2026-04-28T12:00:00.000Z',
  sessions: [
    {
      id: 'session-1',
      projectRoot: '/repo',
      harness: 'codex',
      title: 'Fix tests',
      status: 'running',
    },
    {
      id: 'session-2',
      projectRoot: '/repo',
      harness: 'codex',
      title: 'Archived plan',
      status: 'archived',
      archivedAt: '2026-04-28T12:02:00.000Z',
    },
  ],
};

describe('Coven sessions panel', () => {
  it('renders scoped Coven sessions in the project side panel', () => {
    const { lastFrame } = render(
      <PanesGrid
        panes={[]}
        selectedIndex={0}
        activeProjectRoot="/repo"
        isLoading={false}
        themeName="purple"
        projectThemeByRoot={new Map([['/repo', 'purple']])}
        sidebarProjects={[]}
        fallbackProjectRoot="/repo"
        fallbackProjectName="repo"
        covenSessionsState={READY_STATE}
      />
    );

    const frame = stripAnsi(lastFrame() ?? '');
    expect(frame).toContain('☾ Coven sessions');
    expect(frame).toContain('[o]pen');
    expect(frame).toContain('[codex] Fix tests · running');
    expect(frame).toContain('[codex] Archived plan · archived');
    expect(frame).toContain('[o] open Archived plan');
  });

  it('renders a compact unavailable state without failing the pane grid', () => {
    const state: CovenSessionsLoadState = {
      status: 'unavailable',
      sessions: [],
      reason: 'coven CLI not found',
      loadedAt: '2026-04-28T12:00:00.000Z',
    };

    const { lastFrame } = render(
      <PanesGrid
        panes={[]}
        selectedIndex={0}
        activeProjectRoot="/repo"
        isLoading={false}
        themeName="purple"
        projectThemeByRoot={new Map([['/repo', 'purple']])}
        sidebarProjects={[]}
        fallbackProjectRoot="/repo"
        fallbackProjectName="repo"
        covenSessionsState={state}
      />
    );

    expect(stripAnsi(lastFrame() ?? '')).toContain('☾ Coven unavailable: coven CLI not found');
  });
});
