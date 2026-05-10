import { describe, expect, it } from 'vitest';

describe('side panel responsive helpers', () => {
  it('uses a compact rail width when the side panel is collapsed', async () => {
    const sidePanel = await import('../src/utils/sidePanel.js');

    expect(sidePanel.getSidePanelWidth(true)).toBe(4);
    expect(sidePanel.getSidePanelWidth(false)).toBe(40);
  });

  it('starts collapsed for narrow mobile-sized terminals', async () => {
    const sidePanel = await import('../src/utils/sidePanel.js');

    expect(sidePanel.shouldUseCompactSidePanel(89)).toBe(true);
    expect(sidePanel.shouldUseCompactSidePanel(139)).toBe(true);
    expect(sidePanel.shouldUseCompactSidePanel(140)).toBe(false);
  });

  it('does not auto-collapse narrow terminals after a manual side panel override', async () => {
    const sidePanel = await import('../src/utils/sidePanel.js');

    expect(sidePanel.shouldAutoCollapseSidePanel(89, false)).toBe(true);
    expect(sidePanel.shouldAutoCollapseSidePanel(89, true)).toBe(false);
  });
});
