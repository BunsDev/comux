# Comux Desktop MVP

Comux is the visual cockpit for local agent work. Coven owns harness sessions, PTYs, logs, and project boundaries; Comux presents that runtime as a calm desktop app.

## Product shape

- **VMUX energy:** multi-session sidebar, live panes, quick launcher, project-aware cockpit.
- **Cleaner shell:** Apple/Codex/ChatGPT-inspired restraint, dark glass, low chrome, strong hierarchy.
- **Runtime bridge:** Tauri calls `bridge_config`, then connects to the local Comux daemon over `ws://127.0.0.1:${port}` using the token in `~/.config/comux/token`.

## Current slice

- Tauri v2 app scaffold in `src-tauri/`.
- Vue dashboard shell with glass cockpit styling.
- Preview mode when no daemon is reachable.
- Live bridge hooks for `panes.list`, `coven.sessions.list`, `coven.sessions.launch`, and `coven.sessions.open`.

## Next slice

1. Stream Coven session output into the center transcript panel.
2. Add input/interrupt/kill controls for running sessions.
3. Add pane split/resize behavior closer to VMUX.
4. Persist app layout and selected project.
