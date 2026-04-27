# comux

**comux** is a project-scoped agent cockpit for coordinating coding work across terminal sessions.

> Full autonomy, inside a room you chose.

comux is where your OpenClaw familiar can conduct Claude, Codex, Gemini, and other coding agents in visible terminal workspaces. Each project is explicitly launched, each coding lane can live in its own git worktree, and every agent action stays inspectable.

## Why

AI coding agents are most useful when they can work in parallel. But parallel agents need coordination: branches, terminals, tests, blockers, approvals, and handoffs.

comux gives that work a cockpit.

- **Project-scoped autonomy** — agents only roam inside projects you launch.
- **Visible terminals** — no mysterious background jobs you cannot inspect.
- **Worktree isolation** — parallel coding lanes without trampling your main checkout.
- **Conductor workflow** — your OpenClaw familiar can launch agents, watch progress, and report back.
- **OpenMeow-ready** — toss coding work from the notch; Cody takes it into comux.

## Product shape

```text
OpenMeow / CLI / future UI
          │
          ▼
   comux control API
          │
          ▼
 local comux daemon
          │
          ├─ projects
          ├─ terminal panes
          ├─ git worktrees
          ├─ coding-agent launchers
          └─ status / attention events
```

## First demo loop

1. Toss a coding task from OpenMeow to Cody.
2. Cody opens the project in comux.
3. comux creates an isolated worker pane.
4. Codex, Claude, or another coding agent works in the pane.
5. Cody reports back when work is blocked, ready, or needs approval.
6. You can jump into comux for full terminal visibility.

## Local smoke test

See [`docs/SMOKE.md`](./docs/SMOKE.md) for the current local verification loop.

## Status

`comux` is in early public development. The current package contains the TypeScript CLI/core port and local smoke path for the project-scoped agent cockpit.

See [`docs/PRODUCT-SPEC.md`](./docs/PRODUCT-SPEC.md) for the current direction.
