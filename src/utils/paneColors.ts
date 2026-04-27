import path from 'path';
import type { VmuxPane, VmuxThemeName, SidebarProject } from '../types.js';
import { isVmuxThemeName, normalizeVmuxTheme } from '../theme/themePalette.js';
import { getPaneProjectRoot } from './paneProject.js';
import { getSidebarProjectColorTheme } from './sidebarProjects.js';
import { SettingsManager } from './settingsManager.js';

type ProjectThemeCache = Map<string, VmuxThemeName>;

function getCacheKey(projectRoot: string): string {
  return path.resolve(projectRoot);
}

export function resolveProjectColorTheme(
  projectRoot: string,
  sidebarProjects: SidebarProject[],
  cache: ProjectThemeCache = new Map()
): VmuxThemeName {
  const cacheKey = getCacheKey(projectRoot);
  const cachedTheme = cache.get(cacheKey);
  if (cachedTheme) {
    return cachedTheme;
  }

  const resolvedTheme = getSidebarProjectColorTheme(sidebarProjects, projectRoot)
    || normalizeVmuxTheme(new SettingsManager(projectRoot).getSettings().colorTheme);

  cache.set(cacheKey, resolvedTheme);
  return resolvedTheme;
}

export function getPaneColorTheme(
  pane: VmuxPane,
  sidebarProjects: SidebarProject[],
  fallbackProjectRoot: string,
  cache: ProjectThemeCache = new Map()
): VmuxThemeName {
  if (isVmuxThemeName(pane.colorTheme)) {
    return pane.colorTheme;
  }

  return resolveProjectColorTheme(
    getPaneProjectRoot(pane, fallbackProjectRoot),
    sidebarProjects,
    cache
  );
}

export function syncPaneColorThemes(
  panes: VmuxPane[],
  sidebarProjects: SidebarProject[],
  fallbackProjectRoot: string
): VmuxPane[] {
  const projectThemeCache: ProjectThemeCache = new Map();
  let changed = false;

  const updatedPanes = panes.map((pane) => {
    const colorTheme = resolveProjectColorTheme(
      getPaneProjectRoot(pane, fallbackProjectRoot),
      sidebarProjects,
      projectThemeCache
    );

    if (pane.colorTheme === colorTheme) {
      return pane;
    }

    changed = true;
    return {
      ...pane,
      colorTheme,
    };
  });

  return changed ? updatedPanes : panes;
}
