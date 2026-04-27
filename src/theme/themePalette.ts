import type { VmuxThemeName } from '../types.js';

export const VMUX_THEME_NAMES = [
  'red',
  'blue',
  'yellow',
  'orange',
  'green',
  'purple',
  'cyan',
  'magenta',
] as const satisfies readonly VmuxThemeName[];

export const DEFAULT_VMUX_THEME: VmuxThemeName = 'orange';

export const VMUX_THEME_LABELS: Record<VmuxThemeName, string> = {
  red: 'Crimson',
  blue: 'Indigo',
  yellow: 'Gold',
  orange: 'Brand Purple',
  green: 'Graphite',
  purple: 'Violet',
  cyan: 'Lilac',
  magenta: 'Orchid',
};

export function isVmuxThemeName(value: unknown): value is VmuxThemeName {
  return typeof value === 'string' && (VMUX_THEME_NAMES as readonly string[]).includes(value);
}

export function normalizeVmuxTheme(value: unknown): VmuxThemeName {
  return isVmuxThemeName(value) ? value : DEFAULT_VMUX_THEME;
}

export function getVmuxThemeLabel(value: unknown): string {
  return VMUX_THEME_LABELS[normalizeVmuxTheme(value)];
}
