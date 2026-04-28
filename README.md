<h1 align="center">comux</h1>

<h3 align="center">Parallel coding agents with tmux and worktrees</h3>

<p align="center">
  Coordinate Claude, Codex, and other coding agents in visible, project-scoped terminal workspaces.<br/>
  Branch, develop, inspect, and merge — all in parallel.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/comux"><strong>npm</strong></a>
  ·
  <a href="https://github.com/BunsDev/comux/issues"><strong>Issues</strong></a>
</p>

---

## Install

```sh
npm install -g comux
```

Or try it without a global install:

```sh
npm exec comux@latest -- doctor --json
```

## Quick Start

```sh
cd /path/to/your/project
comux
```

Press `n` to create a new pane, type a prompt, pick one or more agents, and comux handles the terminal pane, git worktree, branch, and agent launch.

Use `t` for a plain terminal pane. Open the selected pane menu with `m` when you want to inspect, merge, create a PR, attach another agent, or clean up.

New to tmux? Run:

```sh
comux doctor
comux doctor --fix
```

`comux doctor` checks tmux, git, clipboard/navigation support, comux session styling, and the comux-managed tmux config block. `--fix` applies safe repairs, backs up an existing `~/.tmux.conf`, and only edits the block between `# >>> comux` and `# <<< comux`.

## What it does

comux creates a tmux pane for each task. Work panes get their own git worktree and branch so agents can work in isolation while you keep full terminal visibility.

- **Worktree isolation** — one branch and working copy per coding lane.
- **Agent support** — launch coding CLIs from a shared registry instead of juggling terminals by hand.
- **Visible execution** — every worker lives in a terminal you can inspect or take over.
- **Project scope** — comux starts from an explicit project root and keeps automation tied to that room.
- **Smart merging** — review, merge, PR, and cleanup flows stay explicit.
- **File browser** — inspect a pane's worktree, search files, and preview code or diffs without leaving comux.
- **Pane controls** — hide, isolate, rename, close, or reopen work without losing the project shape.
- **Coven bridge** — open and launch Coven-managed sessions from comux when a local Coven daemon is available.
- **Lifecycle hooks** — run scripts on worktree create, pre-merge, post-merge, and more.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `n` | New agent/worktree pane |
| `t` | New terminal pane |
| `j` / `Enter` | Jump to selected pane |
| `m` | Open selected pane menu |
| `f` | Browse files in selected pane's worktree |
| `x` | Close pane |
| `h` | Hide/show selected pane |
| `H` | Hide/show all other panes |
| `P` | Show only the selected project's panes, then show all |
| `p` | Create GitHub PR from a worktree pane |
| `a` | Add another agent to a worktree |
| `A` | Add a terminal to a worktree |
| `b` | Create a child worktree from a worktree |
| `q` | Quit |

When focus is inside a work pane, tmux receives your keys instead of comux. Use `Ctrl-b` then `Left Arrow` to return to the comux sidebar. When mouse events are enabled, click a pane/worktree row to select it and double-click a pane/worktree name or project header to edit it inline.

## Requirements

- tmux 3.0+
- Node.js 18+
- Git 2.20+
- At least one supported coding-agent CLI, such as Claude Code, Codex, OpenCode, Gemini CLI, or another configured launcher
- OpenRouter API key (optional, for AI branch names, status analysis, and commit messages)

## Docs

- [Product spec](./docs/PRODUCT-SPEC.md)
- [Smoke test](./docs/SMOKE.md)
- [Contributing](./CONTRIBUTING.md)

## Status

comux is early public software. The current package is the simplified public successor to the VMUX terminal/worktree engine: focused on the CLI, tmux cockpit, worktree isolation, local daemon bridge, and Coven integration path.

## License

MIT
