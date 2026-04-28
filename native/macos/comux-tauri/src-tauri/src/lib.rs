use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use once_cell::sync::Lazy;
use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{
    webview::WebviewBuilder, AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Url,
    WebviewUrl,
};

const BROWSER_LABEL_PREFIX: &str = "comux-browser-";

fn safe_browser_label(label: Option<String>) -> String {
    let raw = label.unwrap_or_else(|| "default".to_string());
    let safe: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(64)
        .collect();
    format!("{}{}", BROWSER_LABEL_PREFIX, if safe.is_empty() { "default" } else { &safe })
}

// ----------------------------------------------------------------------------
// Multi-PTY backend
// ----------------------------------------------------------------------------

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

static SESSIONS: Lazy<Mutex<HashMap<String, PtySession>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize, Deserialize)]
pub struct StartOptions {
    pub thread_id: String,
    pub project_root: Option<String>,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    /// Extra environment variables on top of the inherited environment.
    pub env: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PtyDataEvent {
    pub thread_id: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PtyExitEvent {
    pub thread_id: String,
    pub code: Option<i32>,
}

#[tauri::command]
fn pty_start(app: AppHandle, options: StartOptions) -> Result<(), String> {
    let thread_id = options.thread_id.clone();

    {
        let guard = SESSIONS.lock();
        if guard.contains_key(&thread_id) {
            return Err(format!("thread '{}' already running", thread_id));
        }
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: options.rows.unwrap_or(40),
            cols: options.cols.unwrap_or(120),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let command = options
        .command
        .unwrap_or_else(|| "/bin/zsh".to_string());
    let args = options.args.unwrap_or_else(|| vec!["-l".to_string()]);
    let mut cmd = CommandBuilder::new(command);
    cmd.args(args);
    if let Some(root) = &options.project_root {
        cmd.cwd(root);
    }
    // Build a sane child environment. When the .app is launched from
    // Finder/Dock, launchd hands us a stripped PATH that lacks
    // /opt/homebrew/bin, so vmux can't find tmux/git/gh/etc. Augment PATH
    // with the conventional locations, and provide reasonable defaults for
    // TERM / COLORTERM / LANG so xterm.js renders unicode + truecolor.
    let augmented_path = augmented_path();
    cmd.env("PATH", &augmented_path);
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("VMUX_TAURI", "1");
    cmd.env("VMUX_NATIVE_CONTAINER", "1");
    if std::env::var("LANG").is_err() {
        cmd.env("LANG", "en_US.UTF-8");
    }
    if std::env::var("LC_ALL").is_err() {
        cmd.env("LC_ALL", "en_US.UTF-8");
    }
    if let Some(extra_env) = options.env {
        for (k, v) in extra_env {
            // Empty-string values are treated as "unset this variable" so the
            // JS layer can scrub TMUX (which tmux uses to detect nesting).
            if v.is_empty() {
                cmd.env_remove(&k);
            } else {
                cmd.env(k, v);
            }
        }
    }
    // Always make sure TMUX is unset unless something downstream explicitly
    // wants it. Inheriting it from the Tauri parent process makes nested-tmux
    // checks misfire.
    cmd.env_remove("TMUX");
    // Tauri is launched through pnpm during development, which can leave npm's
    // prefix variables in the inherited environment. nvm refuses to initialize
    // when npm_config_prefix is set, so scrub these at the PTY boundary before
    // launching user shells or project commands.
    cmd.env_remove("npm_config_prefix");
    cmd.env_remove("NPM_CONFIG_PREFIX");
    cmd.env_remove("PREFIX");

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let exit_thread_id = thread_id.clone();
    let app_for_exit = app.clone();
    std::thread::spawn(move || {
        let status = child.wait();
        {
            let mut guard = SESSIONS.lock();
            guard.remove(&exit_thread_id);
        }
        let code = status.ok().and_then(|s| {
            // ExitStatus is opaque; best-effort extraction.
            #[allow(unused_variables)]
            let success = s.success();
            None
        });
        let _ = app_for_exit.emit(
            "pty:exit",
            PtyExitEvent {
                thread_id: exit_thread_id,
                code,
            },
        );
    });

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let data_thread_id = thread_id.clone();
    let app_for_data = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let payload = PtyDataEvent {
                        thread_id: data_thread_id.clone(),
                        bytes: buf[..n].to_vec(),
                    };
                    let _ = app_for_data.emit("pty:data", payload);
                }
                Err(_) => break,
            }
        }
    });

    {
        let mut guard = SESSIONS.lock();
        guard.insert(
            thread_id,
            PtySession {
                master: pair.master,
                writer: Arc::new(Mutex::new(writer)),
            },
        );
    }

    Ok(())
}

#[tauri::command]
fn pty_write(thread_id: String, bytes: Vec<u8>) -> Result<(), String> {
    let guard = SESSIONS.lock();
    let session = guard
        .get(&thread_id)
        .ok_or_else(|| format!("thread '{}' not found", thread_id))?;
    let mut writer = session.writer.lock();
    writer.write_all(&bytes).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn pty_resize(thread_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let guard = SESSIONS.lock();
    if let Some(session) = guard.get(&thread_id) {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn pty_stop(thread_id: String) {
    let mut guard = SESSIONS.lock();
    guard.remove(&thread_id);
}

#[tauri::command]
fn pty_list() -> Vec<String> {
    let guard = SESSIONS.lock();
    guard.keys().cloned().collect()
}

// ----------------------------------------------------------------------------
// Embedded browser pane (Tauri child webview)
// ----------------------------------------------------------------------------

fn ensure_browser(
    app: &AppHandle,
    label: &str,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    url: &str,
) -> Result<(), String> {
    if app.webviews().keys().any(|existing| existing == label) {
        return Ok(());
    }

    let main = app
        .get_window("main")
        .ok_or_else(|| "main window missing".to_string())?;

    let parsed_url = Url::parse(url).map_err(|e| e.to_string())?;
    let builder = WebviewBuilder::new(label, WebviewUrl::External(parsed_url));

    main.add_child(
        builder,
        LogicalPosition::new(x, y),
        LogicalSize::new(w.max(1.0), h.max(1.0)),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn hide_webview(webview: &tauri::Webview) -> Result<(), String> {
    webview
        .set_position(LogicalPosition::new(-10000.0, -10000.0))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(1.0, 1.0))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn browser_navigate(
    app: AppHandle,
    label: Option<String>,
    url: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    let label = safe_browser_label(label);
    ensure_browser(&app, &label, x, y, w, h, &url)?;
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "browser webview missing".to_string())?;
    let parsed_url = Url::parse(&url).map_err(|e| e.to_string())?;
    webview.navigate(parsed_url).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn browser_set_bounds(
    app: AppHandle,
    label: Option<String>,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    let label = safe_browser_label(label);
    if let Some(webview) = app.get_webview(&label) {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        webview
            .set_size(LogicalSize::new(w.max(1.0), h.max(1.0)))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn browser_hide(app: AppHandle, label: Option<String>) -> Result<(), String> {
    let label = safe_browser_label(label);
    if let Some(webview) = app.get_webview(&label) {
        hide_webview(&webview)?;
    }
    Ok(())
}

#[tauri::command]
fn browser_hide_all_except(app: AppHandle, label: Option<String>) -> Result<(), String> {
    let keep = label.map(|raw| safe_browser_label(Some(raw)));
    for (existing_label, webview) in app.webviews() {
        if existing_label.starts_with(BROWSER_LABEL_PREFIX) && Some(existing_label.clone()) != keep {
            hide_webview(&webview)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn browser_reload(app: AppHandle, label: Option<String>) -> Result<(), String> {
    let label = safe_browser_label(label);
    if let Some(webview) = app.get_webview(&label) {
        webview.reload().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn browser_eval(app: AppHandle, label: Option<String>, script: String) -> Result<(), String> {
    let label = safe_browser_label(label);
    if let Some(webview) = app.get_webview(&label) {
        webview.eval(&script).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ----------------------------------------------------------------------------
// Environment introspection so the JS layer can locate `node` + the bundled
// vmux entrypoint when the app is invoked from a worktree (dev mode).
// ----------------------------------------------------------------------------

#[derive(Serialize, Default)]
pub struct AppEnvironment {
    pub home: Option<String>,
    pub repo_root: Option<String>,
    pub vmux_entry: Option<String>,
    pub node_path: Option<String>,
    pub default_shell: String,
}

#[tauri::command]
fn app_environment() -> AppEnvironment {
    let home = std::env::var("HOME").ok();
    let default_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    // Try to find a `node` on PATH. portable-pty inherits the parent env, so
    // launching `node` from there should work even if PATH munging in spawn
    // misses common Homebrew paths.
    let node_path = which_on_path("node");

    // Heuristic: if the binary is being run from a built .app inside a
    // worktree, the worktree root is a couple of levels up from the .app.
    let repo_root = locate_vmux_repo();
    let vmux_entry = repo_root.as_ref().and_then(|root| {
        let candidate = format!("{}/dist/index.js", root);
        if std::path::Path::new(&candidate).exists() {
            Some(candidate)
        } else {
            None
        }
    });

    AppEnvironment {
        home,
        repo_root,
        vmux_entry,
        node_path,
        default_shell,
    }
}

// ----------------------------------------------------------------------------
// Agent harness skills/plugins discovery.
//
// Surfaces the slash commands that an agent harness running in a thread will
// recognise, so the Tauri command bar can autocomplete + invoke them. v1
// covers Claude Code: user/project skills, user/project commands, and
// plugin-supplied skills/commands. Other harnesses can be added by extending
// the match in `agent_skills`.
// ----------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct AgentSkillEntry {
    pub harness: String,
    /// Slash command name including leading slash, e.g. "/security-review"
    /// or "/myplugin:foo".
    pub name: String,
    pub description: String,
    /// "user" | "project" | "plugin"
    pub source: String,
    /// "user" / "project" for non-plugin entries; plugin name for plugins.
    pub origin: String,
    /// "skill" | "command"
    pub kind: String,
    pub path: String,
}

#[tauri::command]
fn agent_skills(harness: Option<String>, project_root: Option<String>) -> Vec<AgentSkillEntry> {
    let harness = harness.unwrap_or_else(|| "claude".to_string());
    let mut out: Vec<AgentSkillEntry> = vec![];
    if harness != "claude" {
        return out;
    }

    if let Ok(home) = std::env::var("HOME") {
        let user_root = Path::new(&home).join(".claude");
        if user_root.is_dir() {
            scan_claude_dir(&user_root, "user", "user", None, &mut out);
        }
        let plugins_root = user_root.join("plugins");
        if plugins_root.is_dir() {
            scan_claude_plugins(&plugins_root, &mut out);
        }
    }
    if let Some(pr) = project_root.as_deref() {
        let proj_claude = Path::new(pr).join(".claude");
        if proj_claude.is_dir() {
            scan_claude_dir(&proj_claude, "project", "project", None, &mut out);
        }
    }

    out.sort_by(|a, b| a.name.cmp(&b.name).then(a.source.cmp(&b.source)));
    out.dedup_by(|a, b| a.name == b.name && a.kind == b.kind);
    out
}

/// Scan a `.claude` (or plugin root) directory for `commands/*.md` and
/// `skills/<name>/SKILL.md`. `prefix` is prepended to the slash name for
/// plugin-supplied entries (`Some("myplugin")` → `/myplugin:foo`).
fn scan_claude_dir(
    root: &Path,
    source: &str,
    origin: &str,
    prefix: Option<&str>,
    out: &mut Vec<AgentSkillEntry>,
) {
    let commands_dir = root.join("commands");
    if commands_dir.is_dir() {
        if let Ok(rd) = std::fs::read_dir(&commands_dir) {
            for entry in rd.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                if path.extension().and_then(|s| s.to_str()) != Some("md") {
                    continue;
                }
                let stem = match path.file_stem().and_then(|s| s.to_str()) {
                    Some(s) if !s.is_empty() => s.to_string(),
                    _ => continue,
                };
                let name = match prefix {
                    Some(p) => format!("/{}:{}", p, stem),
                    None => format!("/{}", stem),
                };
                out.push(AgentSkillEntry {
                    harness: "claude".into(),
                    name,
                    description: read_md_description(&path).unwrap_or_default(),
                    source: source.into(),
                    origin: origin.into(),
                    kind: "command".into(),
                    path: path.to_string_lossy().to_string(),
                });
            }
        }
    }

    let skills_dir = root.join("skills");
    if skills_dir.is_dir() {
        if let Ok(rd) = std::fs::read_dir(&skills_dir) {
            for entry in rd.flatten() {
                let dir = entry.path();
                if !dir.is_dir() {
                    continue;
                }
                let skill_md = dir.join("SKILL.md");
                if !skill_md.is_file() {
                    continue;
                }
                let skill_name = match dir.file_name().and_then(|s| s.to_str()) {
                    Some(s) if !s.is_empty() => s.to_string(),
                    _ => continue,
                };
                let name = match prefix {
                    Some(p) => format!("/{}:{}", p, skill_name),
                    None => format!("/{}", skill_name),
                };
                out.push(AgentSkillEntry {
                    harness: "claude".into(),
                    name,
                    description: read_md_description(&skill_md).unwrap_or_default(),
                    source: source.into(),
                    origin: origin.into(),
                    kind: "skill".into(),
                    path: skill_md.to_string_lossy().to_string(),
                });
            }
        }
    }
}

/// Find every plugin under `~/.claude/plugins` that ships its own
/// `commands/` or `skills/` subtree, regardless of where Claude's plugin
/// installer actually placed it (layouts vary across versions:
/// `plugins/<name>/`, `plugins/repos/<marketplace>/<name>/`, etc.). We bound
/// the walk so we never recurse into node_modules or git history.
fn scan_claude_plugins(root: &Path, out: &mut Vec<AgentSkillEntry>) {
    fn walk(dir: &Path, depth: u32, plugin_hint: Option<&str>, out: &mut Vec<AgentSkillEntry>) {
        if depth > 4 {
            return;
        }
        let has_commands = dir.join("commands").is_dir();
        let has_skills = dir.join("skills").is_dir();
        let plugin_name = plugin_hint
            .map(|s| s.to_string())
            .or_else(|| {
                dir.file_name()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_string())
            })
            .unwrap_or_else(|| "plugin".to_string());
        if has_commands || has_skills {
            scan_claude_dir(dir, "plugin", &plugin_name, Some(&plugin_name), out);
            return;
        }
        let Ok(rd) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in rd.flatten() {
            let path: PathBuf = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or_default();
            if name.is_empty() || name.starts_with('.') || name == "node_modules" {
                continue;
            }
            walk(&path, depth + 1, None, out);
        }
    }
    walk(root, 0, None, out);
}

/// Pull a one-line description out of a markdown file. Prefers the
/// `description:` key in YAML frontmatter, then the first non-empty,
/// non-heading line.
fn read_md_description(path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;
    let mut iter = content.lines();
    let first = iter.next()?;
    if first.trim() == "---" {
        let mut in_fm = true;
        for line in iter.by_ref() {
            if line.trim() == "---" {
                in_fm = false;
                break;
            }
            if let Some(rest) = line.strip_prefix("description:") {
                let value = rest
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string();
                if !value.is_empty() {
                    return Some(truncate_oneline(&value));
                }
            }
        }
        if in_fm {
            return None;
        }
        for line in iter {
            let t = line.trim();
            if !t.is_empty() && !t.starts_with('#') {
                return Some(truncate_oneline(t));
            }
        }
        None
    } else {
        let t = first.trim();
        if !t.is_empty() && !t.starts_with('#') {
            return Some(truncate_oneline(t));
        }
        for line in iter {
            let t = line.trim();
            if !t.is_empty() && !t.starts_with('#') {
                return Some(truncate_oneline(t));
            }
        }
        None
    }
}

fn truncate_oneline(s: &str) -> String {
    let s = s.replace('\r', "");
    let one = s.lines().next().unwrap_or("").trim().to_string();
    if one.chars().count() > 160 {
        one.chars().take(157).collect::<String>() + "…"
    } else {
        one
    }
}

fn augmented_path() -> String {
    let existing = std::env::var("PATH").unwrap_or_default();
    let extras = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ];
    let mut parts: Vec<String> = extras.iter().map(|s| s.to_string()).collect();
    for p in existing.split(':') {
        if !p.is_empty() && !parts.iter().any(|existing| existing == p) {
            parts.push(p.to_string());
        }
    }
    // Plus common user-installed runtime managers on macOS.
    if let Ok(home) = std::env::var("HOME") {
        for suffix in [
            ".cargo/bin",
            ".local/bin",
            ".nvm/versions/node/v24.13.0/bin",
            ".volta/bin",
            ".bun/bin",
            ".rbenv/shims",
            ".pyenv/shims",
        ] {
            let candidate = format!("{}/{}", home, suffix);
            if std::path::Path::new(&candidate).is_dir()
                && !parts.iter().any(|p| p == &candidate)
            {
                parts.push(candidate);
            }
        }
    }
    parts.join(":")
}

fn which_on_path(binary: &str) -> Option<String> {
    for dir in augmented_path().split(':') {
        let candidate = std::path::Path::new(dir).join(binary);
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

fn locate_vmux_repo() -> Option<String> {
    // Walk up from the current executable looking for a directory that
    // contains both `dist/index.js` and `package.json`.
    let exe = std::env::current_exe().ok()?;
    let mut current = exe.parent()?.to_path_buf();
    for _ in 0..12 {
        let dist = current.join("dist").join("index.js");
        let pkg = current.join("package.json");
        if dist.is_file() && pkg.is_file() {
            return Some(current.to_string_lossy().to_string());
        }
        if !current.pop() {
            break;
        }
    }
    // Fall back to CWD walk.
    let cwd = std::env::current_dir().ok()?;
    let mut current = cwd;
    for _ in 0..12 {
        let dist = current.join("dist").join("index.js");
        let pkg = current.join("package.json");
        if dist.is_file() && pkg.is_file() {
            return Some(current.to_string_lossy().to_string());
        }
        if !current.pop() {
            break;
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            pty_start,
            pty_write,
            pty_resize,
            pty_stop,
            pty_list,
            browser_navigate,
            browser_set_bounds,
            browser_hide,
            browser_hide_all_except,
            browser_reload,
            browser_eval,
            app_environment,
            agent_skills,
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
                if let Some(window) = app.get_webview_window("main") {
                    let _ = apply_vibrancy(
                        &window,
                        NSVisualEffectMaterial::HudWindow,
                        Some(NSVisualEffectState::Active),
                        Some(10.0),
                    );
                }
            }
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
