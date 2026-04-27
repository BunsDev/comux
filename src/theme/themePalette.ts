import type { ComuxThemeName } from '../types.js';

export const COMUX_THEME_NAMES = [
  'red',
  'blue',
  'yellow',
  'orange',
  'green',
  'purple',
  'cyan',
  'magenta',
] as const satisfies readonly ComuxThemeName[];

export const DEFAULT_COMUX_THEME: ComuxThemeName = 'orange';

export const COMUX_THEME_LABELS: Record<ComuxThemeName, string> = {
  red: 'Crimson',
  blue: 'Indigo',
  yellow: 'Gold',
  orange: 'Brand Purple',
  green: 'Graphite',
  purple: 'Violet',
  cyan: 'Lilac',
  magenta: 'Orchid',
};

export function isComuxThemeName(value: unknown): value is ComuxThemeName {
  return typeof value === 'string' && (COMUX_THEME_NAMES as readonly string[]).includes(value);
}

export function normalizeComuxTheme(value: unknown): ComuxThemeName {
  return isComuxThemeName(value) ? value : DEFAULT_COMUX_THEME;
}

export function getComuxThemeLabel(value: unknown): string {
  return COMUX_THEME_LABELS[normalizeComuxTheme(value)];
}
