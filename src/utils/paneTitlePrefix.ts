import type { VmuxPane, SidebarProject } from '../types.js';
import { getVmuxThemeAccent } from '../theme/colors.js';
import { getPaneColorTheme } from './paneColors.js';

export const PANE_TITLE_BUSY_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;
export const PANE_TITLE_IDLE_MARKER = '⠿';
export const TMUX_PANE_TITLE_PREFIX_FORMAT = '#{?@vmux_title_prefix,#{@vmux_title_prefix} ,}';
const ACTIVE_TITLE_STYLE_CONDITION = '#{&&:#{pane_active},#{!=:#{@vmux_active_border_style},}}';
export const TMUX_PANE_TITLE_LABEL_FORMAT = `#{?${ACTIVE_TITLE_STYLE_CONDITION},#[#{@vmux_active_border_style}],}#{?@vmux_title_label,#{@vmux_title_label},#{s|__vmux__.*$||:pane_title}}#{?${ACTIVE_TITLE_STYLE_CONDITION},#[default],}`;

function isBusyPane(pane: VmuxPane): boolean {
  return pane.agentStatus === 'working';
}

export function getPaneTitlePrefixValue(
  pane: VmuxPane,
  sidebarProjects: SidebarProject[],
  fallbackProjectRoot: string,
  spinnerFrameIndex: number = 0
): string {
  const themeName = getPaneColorTheme(pane, sidebarProjects, fallbackProjectRoot);
  const marker = isBusyPane(pane)
    ? PANE_TITLE_BUSY_FRAMES[spinnerFrameIndex % PANE_TITLE_BUSY_FRAMES.length]
    : PANE_TITLE_IDLE_MARKER;
  return `#[fg=${getVmuxThemeAccent(themeName)}]${marker}#[default]`;
}

export function paneNeedsAnimatedTitlePrefix(pane: VmuxPane): boolean {
  return isBusyPane(pane);
}
