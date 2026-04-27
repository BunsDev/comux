import type { ComuxThemeName } from '../types.js';
import {
  getComuxThemePalette,
  TMUX_COLORS,
} from '../theme/colors.js';

export type TmuxSessionThemeOption = readonly [
  option: string,
  value: string,
];

export function buildTmuxSessionThemeOptions(
  themeName: ComuxThemeName
): TmuxSessionThemeOption[] {
  const activeBorder = getComuxThemePalette(themeName).activeBorder;

  return [
    ['window-style', 'fg=default,bg=default'],
    ['window-active-style', 'fg=default,bg=default'],
    ['pane-border-style', `fg=colour${TMUX_COLORS.inactiveBorder}`],
    ['pane-active-border-style', `fg=colour${activeBorder}`],
    ['status-style', `fg=colour${activeBorder},bg=colour236`],
  ];
}
