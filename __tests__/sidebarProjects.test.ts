import path from 'path';
import { describe, expect, it } from 'vitest';
import type { SidebarProject } from '../src/types.js';
import {
  AUTO_SIDEBAR_PROJECT_COLOR_THEME_VALUE,
  addSidebarProject,
  getAutoSidebarProjectColorTheme,
  getSidebarProjectColorThemeSettingValue,
  getSidebarProjectDisplayName,
  normalizeSidebarProjects,
  setSidebarProjectColorTheme,
  setSidebarProjectColorThemeSettingValue,
  setSidebarProjectName,
} from '../src/utils/sidebarProjects.js';

const repo = (name: string) => path.resolve(`/${name}`);

describe('sidebarProjects', () => {
  it('preserves explicit metadata for the session project during normalization', () => {
    const normalized = normalizeSidebarProjects(
      [
        {
          projectRoot: '/repo-main',
          projectName: 'Main App',
          colorTheme: 'cyan',
          colorThemeSource: 'manual',
        },
        {
          projectRoot: '/repo-api',
          projectName: 'API',
          colorTheme: 'red',
          colorThemeSource: 'auto',
        },
      ],
      [],
      '/repo-main',
      'repo-main'
    );

    expect(normalized).toEqual([
      {
        projectRoot: repo('repo-main'),
        projectName: 'Main App',
        colorTheme: 'cyan',
        colorThemeSource: 'manual',
      },
      {
        projectRoot: repo('repo-api'),
        projectName: 'API',
        colorTheme: 'red',
        colorThemeSource: 'auto',
      },
    ]);
  });

  it('chooses the first unused session color when the preferred theme is already taken', () => {
    const existingProjects: SidebarProject[] = [
      { projectRoot: repo('repo-main'), projectName: 'repo-main' },
      { projectRoot: repo('repo-api'), projectName: 'repo-api', colorTheme: 'red' },
    ];

    const assignedTheme = getAutoSidebarProjectColorTheme(
      existingProjects,
      { projectRoot: repo('repo-web') },
      (projectRoot) => {
        if (projectRoot === repo('repo-main') || projectRoot === repo('repo-web')) {
          return 'orange';
        }

        return undefined;
      }
    );

    expect(assignedTheme).toBe('blue');
  });

  it('sets and clears a session-scoped project color theme', () => {
    const projects: SidebarProject[] = addSidebarProject(
      [{ projectRoot: repo('repo-main'), projectName: 'repo-main' }],
      {
        projectRoot: '/repo-api',
        projectName: 'repo-api',
        colorTheme: 'green',
        colorThemeSource: 'auto',
      }
    );

    expect(setSidebarProjectColorTheme(projects, repo('repo-api'), 'magenta', 'manual')).toEqual([
      { projectRoot: repo('repo-main'), projectName: 'repo-main' },
      {
        projectRoot: repo('repo-api'),
        projectName: 'repo-api',
        colorTheme: 'magenta',
        colorThemeSource: 'manual',
      },
    ]);

    expect(setSidebarProjectColorTheme(projects, repo('repo-api'), undefined)).toEqual([
      { projectRoot: repo('repo-main'), projectName: 'repo-main' },
      { projectRoot: repo('repo-api'), projectName: 'repo-api' },
    ]);
  });

  it('renames a sidebar project without losing theme metadata', () => {
    const projects: SidebarProject[] = [
      { projectRoot: repo('repo-main'), projectName: 'repo-main' },
      {
        projectRoot: repo('repo-api'),
        projectName: 'repo-api',
        colorTheme: 'red',
        colorThemeSource: 'manual',
      },
    ];

    expect(setSidebarProjectName(projects, repo('repo-api'), 'API')).toEqual([
      { projectRoot: repo('repo-main'), projectName: 'repo-main' },
      {
        projectRoot: repo('repo-api'),
        projectName: 'API',
        colorTheme: 'red',
        colorThemeSource: 'manual',
      },
    ]);
  });

  it('resolves custom project names for new pane metadata', () => {
    const projects: SidebarProject[] = [
      { projectRoot: repo('repo-main'), projectName: 'Main App' },
      { projectRoot: repo('repo-api'), projectName: 'API' },
    ];

    expect(getSidebarProjectDisplayName(projects, repo('repo-api'))).toBe('API');
    expect(getSidebarProjectDisplayName(projects, repo('repo-missing'), 'Fallback')).toBe('Fallback');
    expect(getSidebarProjectDisplayName(projects, repo('repo-missing'))).toBe('repo-missing');
  });

  it('reports auto and explicit project color settings distinctly', () => {
    const projects: SidebarProject[] = [
      { projectRoot: repo('repo-main'), projectName: 'repo-main', colorTheme: 'orange' },
      {
        projectRoot: repo('repo-api'),
        projectName: 'repo-api',
        colorTheme: 'blue',
        colorThemeSource: 'auto',
      },
      {
        projectRoot: repo('repo-web'),
        projectName: 'repo-web',
        colorTheme: 'purple',
        colorThemeSource: 'manual',
      },
    ];

    expect(
      getSidebarProjectColorThemeSettingValue(
        projects,
        repo('repo-api'),
        (projectRoot) => projectRoot === repo('repo-api') ? 'orange' : undefined
      )
    ).toBe(AUTO_SIDEBAR_PROJECT_COLOR_THEME_VALUE);

    expect(
      getSidebarProjectColorThemeSettingValue(projects, repo('repo-web'))
    ).toBe('purple');

    expect(
      getSidebarProjectColorThemeSettingValue(projects, repo('repo-main'))
    ).toBe(AUTO_SIDEBAR_PROJECT_COLOR_THEME_VALUE);
  });

  it('applies auto, inherit, and explicit project color theme selections', () => {
    const projects: SidebarProject[] = [
      { projectRoot: repo('repo-main'), projectName: 'repo-main', colorTheme: 'orange' },
      { projectRoot: repo('repo-api'), projectName: 'repo-api', colorTheme: 'red' },
    ];

    expect(
      setSidebarProjectColorThemeSettingValue(
        projects,
        repo('repo-api'),
        AUTO_SIDEBAR_PROJECT_COLOR_THEME_VALUE,
        () => 'orange'
      )
    ).toEqual([
      { projectRoot: repo('repo-main'), projectName: 'repo-main', colorTheme: 'orange' },
      {
        projectRoot: repo('repo-api'),
        projectName: 'repo-api',
        colorTheme: 'red',
        colorThemeSource: 'auto',
      },
    ]);

    expect(
      setSidebarProjectColorThemeSettingValue(projects, repo('repo-api'), '')
    ).toEqual([
      { projectRoot: repo('repo-main'), projectName: 'repo-main', colorTheme: 'orange' },
      { projectRoot: repo('repo-api'), projectName: 'repo-api' },
    ]);

    expect(
      setSidebarProjectColorThemeSettingValue(projects, repo('repo-api'), 'cyan')
    ).toEqual([
      { projectRoot: repo('repo-main'), projectName: 'repo-main', colorTheme: 'orange' },
      {
        projectRoot: repo('repo-api'),
        projectName: 'repo-api',
        colorTheme: 'cyan',
        colorThemeSource: 'manual',
      },
    ]);
  });
});
