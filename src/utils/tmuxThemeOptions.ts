import type { VmuxThemeName } from '../types.js';
import {
  getVmuxThemePalette,
  TMUX_COLORS,
} from '../theme/colors.js';

export type TmuxSessionThemeOption = readonly [
  option: string,
  value: string,
];

export function buildTmuxSessionThemeOptions(
  themeName: VmuxThemeName
): TmuxSessionThemeOption[] {
  const activeBorder = getVmuxThemePalette(themeName).activeBorder;

  return [
    ['window-style', 'fg=default,bg=default'],
    ['window-active-style', 'fg=default,bg=default'],
    ['pane-border-style', `fg=colour${TMUX_COLORS.inactiveBorder}`],
    ['pane-active-border-style', `fg=colour${activeBorder}`],
    ['status-style', `fg=colour${activeBorder},bg=colour236`],
  ];
}
