import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const mainJs = readFileSync(join(repoRoot, 'native/macos/comux-tauri/web/main.js'), 'utf8');
const stylesCss = readFileSync(join(repoRoot, 'native/macos/comux-tauri/web/styles.css'), 'utf8');
const tauriLib = readFileSync(join(repoRoot, 'native/macos/comux-tauri/src-tauri/src/lib.rs'), 'utf8');

describe('Tauri desktop tab shortcuts', () => {
  it('routes Command+T based on the last focused desktop surface', () => {
    expect(mainJs).toContain('var activeSurface = "terminal";');
    expect(mainJs).toContain('function createContextualTab()');
    expect(mainJs).toContain('markActiveSurface("terminal")');
    expect(mainJs).toContain('markActiveSurface("browser")');
    expect(mainJs).toContain('if (activeSurface === "browser") openBlankBrowserTab(); else spawnDefaultThread();');
  });

  it('lets embedded browser webviews request a new browser tab with Command+T', () => {
    expect(tauriLib).toContain('browser:shortcut-new-tab');
    expect(tauriLib).toContain('event.key.toLowerCase() === "t"');
    expect(mainJs).toContain('listen("browser:shortcut-new-tab"');
  });

  it('keeps browser tabs thin and collapsible under narrow browser panes', () => {
    expect(stylesCss).toMatch(/--browser-tab-h:\s*22px;/);
    expect(stylesCss).toMatch(/grid-template-rows:\s*var\(--browser-bar-h\) var\(--browser-tab-h\) 1fr;/);
    expect(stylesCss).toMatch(/\.browser-tab\s*\{[\s\S]*?min-width:\s*34px;[\s\S]*?flex:\s*1 1 118px;/);
    expect(stylesCss).toMatch(/\.browser-tab-title\s*\{[\s\S]*?min-width:\s*0;/);
  });
});
