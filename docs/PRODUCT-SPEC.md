# comux Product Spec

- **Status:** early public product
- **Package:** `comux`
- **One-liner:** comux is a project-scoped cockpit for coordinating parallel coding agents in visible terminal workspaces.

## Thesis

Parallel coding agents are useful only when the work stays visible, scoped, and recoverable.

comux gives developers one cockpit for launching agent lanes, watching terminals, keeping branches isolated, and bringing work back through explicit review. It carries forward the proven VMUX primitives — tmux panes, git worktrees, agent launchers, and merge flows — with cleaner comux branding and a smaller public surface for now.

> Full autonomy, inside a room you chose.

## Product shape

```text
CLI / OpenMeow / future UI
          │
          ▼
    comux control API
          │
          ▼
   local comux daemon
          │
          ├─ projects
          ├─ tmux panes
          ├─ git worktrees
          ├─ agent launchers
          ├─ Coven sessions
          └─ status / attention events
```

## Core model

- **Project** — an explicit repo/workspace launched into comux.
- **Cockpit** — the visible terminal control surface.
- **Pane** — one terminal workspace, often backed by a worktree and agent process.
- **Worktree** — an isolated git checkout for a task or branch.
- **Agent** — Claude, Codex, OpenCode, Gemini, or another configured coding CLI.
- **Conductor** — a human, OpenClaw familiar, Cody/OpenMeow, or bridge process coordinating work.
- **Coven session** — an optional Coven-managed harness session that comux can launch or open when a local Coven daemon is available.

## Target user

comux is for developers and maintainers who want multiple coding agents working at once without losing track of branches, terminals, tests, blockers, or handoffs.

The early user is comfortable with terminal tools and wants:

- parallel agent work without branch conflicts;
- terminal-level visibility;
- explicit merge/PR/review control;
- project-scoped autonomy;
- a future path for OpenMeow/OpenClaw/Coven orchestration.

## Product pillars

### 1. Project-scoped autonomy

A user starts comux from a chosen project. Automation stays inside that room unless the user explicitly opens another one.

### 2. Visible execution

Every worker should be inspectable as a terminal pane. No mysterious hidden jobs as the primary experience.

### 3. Worktree isolation

Parallel work should not trample the main checkout. Coding lanes default toward branch/worktree isolation.

### 4. Explicit merge and PR flow

comux helps with merge, PR, and cleanup flows, but review remains human-legible and approval-driven.

### 5. Bridge-friendly local control

OpenMeow, OpenClaw, Coven, and future clients should talk to a structured local control layer instead of blind terminal puppeteering.

## What to carry forward from VMUX

Carry forward:

- tmux pane orchestration;
- git worktree isolation;
- agent launcher registry;
- project/pane metadata;
- file browser and pane visibility controls;
- attention/completion heuristics;
- merge and PR workflow learnings;
- lifecycle hooks.

Simplify for comux v0:

- keep the README and public story compact;
- focus on CLI/core/daemon behavior first;
- avoid over-explaining native app or multi-client ambitions before they are real;
- treat OpenMeow and Coven as integration paths, not required setup.

Leave behind:

- old product name/history as the main story;
- hidden automation that is hard to inspect or interrupt;
- assumptions that every user wants the full historical VMUX surface on day one.

## v0 scope

### Included now / near-term

- Public npm package `comux`.
- TypeScript + Ink tmux cockpit.
- Project-scoped tmux session.
- Pane/worktree creation.
- Agent launcher registry.
- Pane file browser and visibility controls.
- Merge/PR-oriented pane menu flows.
- Local daemon/control bridge.
- Coven session list/open/launch integration when a local Coven daemon is running.
- Smoke docs and contributor loop.

### Not yet

- Full native desktop cockpit.
- Cloud terminals.
- Team collaboration.
- Hosted agent orchestration.
- Marketplace/plugin story.
- Broad public claims about stable automation policies.

## Bridge rules

The bridge must stay conservative:

- operate on explicitly launched project roots;
- reject out-of-project paths;
- prefer worktree-backed coding lanes;
- expose bounded pane capture/status APIs;
- avoid push, merge, publish, delete, or external actions without explicit approval;
- keep secrets and infrastructure URLs out of UI copy and logs.

## First demo loop

1. Open a repo in comux.
2. Press `n` and describe a coding task.
3. Pick Codex, Claude, or another configured agent.
4. comux creates an isolated worktree and terminal pane.
5. The agent works visibly.
6. Open the pane menu with `m` to inspect, merge, create a PR, or close.
7. If Coven is running, open or launch a Coven-managed session from the bridge path.

If this loop is boringly reliable, comux is doing its job.

## Relationship to OpenMeow, OpenClaw, and Coven

- **OpenMeow** is the lightweight intake surface: toss the task.
- **Cody/OpenClaw** is the conductor: decide what needs doing and report back.
- **Coven** is the harness substrate: run and expose managed coding sessions.
- **comux** is the cockpit: keep the visible terminal/worktree control plane understandable.

These integrations should make comux more useful, but comux must remain valuable as a standalone CLI.
