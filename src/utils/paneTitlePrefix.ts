import type { ComuxPane, SidebarProject } from '../types.js';
import { getComuxThemeAccent } from '../theme/colors.js';
import { getPaneColorTheme } from './paneColors.js';

export const PANE_TITLE_BUSY_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;
export const PANE_TITLE_IDLE_MARKER = '⠿';
export const TMUX_PANE_TITLE_PREFIX_FORMAT = '#{?@comux_title_prefix,#{@comux_title_prefix} ,}';
const ACTIVE_TITLE_STYLE_CONDITION = '#{&&:#{pane_active},#{!=:#{@comux_active_border_style},}}';
export const TMUX_PANE_TITLE_LABEL_FORMAT = `#{?${ACTIVE_TITLE_STYLE_CONDITION},#[#{@comux_active_border_style}],}#{?@comux_title_label,#{@comux_title_label},#{s|__comux__.*$||:pane_title}}#{?${ACTIVE_TITLE_STYLE_CONDITION},#[default],}`;

function isBusyPane(pane: ComuxPane): boolean {
  return pane.agentStatus === 'working';
}

export function getPaneTitlePrefixValue(
  pane: ComuxPane,
  sidebarProjects: SidebarProject[],
  fallbackProjectRoot: string,
  spinnerFrameIndex: number = 0
): string {
  const themeName = getPaneColorTheme(pane, sidebarProjects, fallbackProjectRoot);
  const marker = isBusyPane(pane)
    ? PANE_TITLE_BUSY_FRAMES[spinnerFrameIndex % PANE_TITLE_BUSY_FRAMES.length]
    : PANE_TITLE_IDLE_MARKER;
  return `#[fg=${getComuxThemeAccent(themeName)}]${marker}#[default]`;
}

export function paneNeedsAnimatedTitlePrefix(pane: ComuxPane): boolean {
  return isBusyPane(pane);
}
