import { describe, expect, it } from 'vitest';
import type { ComuxPane } from '../src/types.js';
import {
  getBulkVisibilityAction,
  getProjectVisibilityAction,
  getVisiblePanes,
  partitionPanesByProject,
  syncHiddenStateFromCurrentWindow,
} from '../src/utils/paneVisibility.js';

function pane(id: string, hidden = false, projectRoot = '/repo-a'): ComuxPane {
  return {
    id,
    slug: `pane-${id}`,
    prompt: `prompt-${id}`,
    paneId: `%${id.replace('comux-', '')}`,
    hidden,
    projectRoot,
  };
}

describe('paneVisibility', () => {
  it('syncs hidden flags from the active window pane list', () => {
    const panes = [
      pane('comux-1', true),
      pane('comux-2', false),
      pane('comux-3', false),
    ];

    const synced = syncHiddenStateFromCurrentWindow(panes, ['%2']);

    expect(synced.map((entry) => entry.hidden)).toEqual([true, false, true]);
  });

  it('preserves hidden flags when no current window pane list is available', () => {
    const panes = [
      pane('comux-1', true),
      pane('comux-2', false),
    ];

    const synced = syncHiddenStateFromCurrentWindow(panes, []);

    expect(synced).toEqual(panes);
  });

  it('chooses hide-others when any other pane is visible', () => {
    const panes = [
      pane('comux-1', false),
      pane('comux-2', false),
      pane('comux-3', true),
    ];

    expect(getBulkVisibilityAction(panes, panes[0])).toBe('hide-others');
  });

  it('chooses show-others when all other panes are hidden', () => {
    const panes = [
      pane('comux-1', false),
      pane('comux-2', true),
      pane('comux-3', true),
    ];

    expect(getBulkVisibilityAction(panes, panes[0])).toBe('show-others');
  });

  it('returns only visible panes', () => {
    const panes = [
      pane('comux-1', false),
      pane('comux-2', true),
      pane('comux-3', false),
    ];

    expect(getVisiblePanes(panes).map((entry) => entry.id)).toEqual([
      'comux-1',
      'comux-3',
    ]);
  });

  it('partitions panes by project root', () => {
    const panes = [
      pane('comux-1', false, '/repo-a'),
      pane('comux-2', true, '/repo-a'),
      pane('comux-3', false, '/repo-b'),
    ];

    const { projectPanes, otherPanes } = partitionPanesByProject(
      panes,
      '/repo-a',
      '/fallback'
    );

    expect(projectPanes.map((entry) => entry.id)).toEqual(['comux-1', 'comux-2']);
    expect(otherPanes.map((entry) => entry.id)).toEqual(['comux-3']);
  });

  it('chooses focus-project when other projects are still visible', () => {
    const panes = [
      pane('comux-1', false, '/repo-a'),
      pane('comux-2', false, '/repo-a'),
      pane('comux-3', false, '/repo-b'),
    ];

    expect(getProjectVisibilityAction(panes, '/repo-a', '/fallback')).toBe('focus-project');
  });

  it('chooses focus-project when selected project has hidden panes', () => {
    const panes = [
      pane('comux-1', false, '/repo-a'),
      pane('comux-2', true, '/repo-a'),
      pane('comux-3', true, '/repo-b'),
    ];

    expect(getProjectVisibilityAction(panes, '/repo-a', '/fallback')).toBe('focus-project');
  });

  it('chooses show-all when the selected project is already focused', () => {
    const panes = [
      pane('comux-1', false, '/repo-a'),
      pane('comux-2', false, '/repo-a'),
      pane('comux-3', true, '/repo-b'),
    ];

    expect(getProjectVisibilityAction(panes, '/repo-a', '/fallback')).toBe('show-all');
  });
});
