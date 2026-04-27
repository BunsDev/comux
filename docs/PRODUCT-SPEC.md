# comux Product Spec

**Status:** early product direction  
**Package:** `comux`  
**Product thesis:** comux is the project-scoped cockpit where your OpenClaw familiar coordinates coding agents in visible terminal workspaces.

## Why comux exists

Coding with agents is powerful, but it gets chaotic fast. One agent is easy to follow. Five agents across three repos, each with its own branch, terminal, tests, blockers, and approvals, becomes a coordination problem.

comux exists to make that coordination visible, scoped, and trustworthy.

It gives the user one place to launch project work, watch agent terminals, understand status, and jump in when human judgment is needed. It is not another hidden background automation layer. It is the cockpit for agentic development work.

## Product promise

> Full autonomy, inside a room you chose.

A user explicitly launches a project into comux. Within that project boundary, their OpenClaw familiar or coding conductor can create terminal workspaces, spawn coding agents, run tests, inspect output, and summarize progress. Outside that boundary, nothing roams.

## Positioning

comux is a fresh public product, not just a renamed VMUX history. VMUX proved the primitives: tmux panes, isolated worktrees, agent launchers, and multi-project terminal control. comux should preserve the best of those primitives while presenting a cleaner product story and codebase.

### One-liner

comux is a project-scoped agent cockpit for coordinating coding work across terminal sessions.

### Slightly longer

comux lets your OpenClaw familiar conduct Claude, Codex, Gemini, and other coding agents in visible terminal workspaces, with isolated git worktrees and explicit project-level autonomy.

### OpenMeow integration line

OpenMeow is the toss. Cody is the conductor. comux is the cockpit.

## Core mental model

- **Project:** an explicit repo/workspace the user has launched into comux.
- **Cockpit:** the visible comux surface for project tabs, terminal panes, worktrees, agents, and status.
- **Pane:** one terminal workspace, usually backed by a git worktree and optionally an agent process.
- **Conductor:** the user’s OpenClaw agent or subagent that coordinates work inside the project.
- **Worker agent:** Claude, Codex, Gemini, OpenCode, or another coding CLI running inside a pane.
- **Autonomy profile:** the project-level permission envelope that defines what the conductor can do without asking.

## Target user

comux is for developers who are ready to use multiple AI coding agents but do not want the work to disappear into invisible background jobs.

The early user is a power user or maintainer who:

- works across multiple repos;
- wants parallel agent work without branch conflicts;
- wants terminal-level visibility;
- needs approvals, diffs, and status summaries;
- values speed but does not want reckless autonomy.

## Product pillars

### 1. Explicit project launch

The user chooses when a project enters comux.

A launched project defines the room where autonomy is allowed. The conductor should not wander across the filesystem or operate on unrelated repos.

### 2. Visible agent workspaces

Agent work should be inspectable.

comux shows panes, branches, worktrees, agent identities, last activity, and attention state. The user can always jump into the terminal and intervene.

### 3. Conductor-first orchestration

The user should not have to babysit every worker agent.

A conductor — such as Cody from OpenMeow or the user’s primary OpenClaw familiar — can create panes, send scoped prompts, watch output, detect blockers, and report back with concise summaries.

### 4. Worktree isolation

Parallel agent work should not trample the main checkout.

Each coding pane should get a branch/worktree by default. Merging, PR creation, and cleanup stay explicit and reviewable.

### 5. Permissioned autonomy

comux should make autonomy configurable instead of vague.

Autonomy is granted per project and enforced at the bridge/control layer. Destructive and external actions stay gated.

## Autonomy profiles

### Observe

- Read panes, output, metadata, and diffs.
- Summarize and advise.
- No commands or writes.

### Assist

- Create panes.
- Launch worker agents.
- Send prompts.
- Ask before edits or state-changing commands.

### Autopilot

- Create panes and worktrees.
- Run tests and typechecks.
- Allow worker agents to edit inside scoped worktrees.
- Prepare commits or PR-shaped summaries.
- Ask before push, merge, delete, or external actions.

### Trusted

- Broad autonomy inside repo policy.
- Still respects global hard gates, protected branches, secrets policy, and external-action approval.

## Architecture direction

comux should separate a local control plane from user-facing clients.

```text
OpenMeow / CLI / future UI
          │
          ▼
   comux control API
          │
          ▼
 local comux daemon
          │
          ├─ project registry
          ├─ tmux/session manager
          ├─ worktree manager
          ├─ agent launcher registry
          ├─ pane status/attention events
          └─ approval/action log
```

### Daemon

The daemon owns privileged local automation:

- opening projects;
- creating panes;
- creating worktrees;
- launching agents;
- capturing terminal output;
- emitting status events;
- focusing or opening cockpit surfaces.

### Clients

Clients should stay thin:

- CLI for local power use;
- OpenMeow integration for toss-to-Cody flows;
- future Mac/web cockpit surface for richer visibility.

### OpenClaw integration

OpenClaw should integrate through a structured bridge, not by blind terminal puppeteering.

The conductor needs operations like:

- `projects.open`
- `panes.spawn`
- `panes.input`
- `panes.capture`
- `panes.status`
- `panes.kill`
- `events.subscribe`

## First demo loop

The first product demo should be narrow and real:

1. User opens OpenMeow.
2. User tosses: “Cody, fix this bug in open-meow.”
3. Cody asks comux to open the `open-meow` project.
4. comux creates a worker pane with an isolated worktree.
5. Cody launches Codex or Claude with a scoped prompt.
6. comux reports pane status and attention events.
7. Cody summarizes progress back to OpenMeow.
8. User can open comux to inspect the terminal.
9. Cody asks before merge/push/PR actions.

If this loop works, the product is real.

## What to carry forward from VMUX

Carry forward:

- tmux-pane orchestration;
- git worktree isolation;
- agent launcher registry;
- project/pane metadata;
- attention/completion heuristics;
- merge and PR workflow learnings;
- daemon/control API direction.

Leave behind:

- old product name/history;
- UI or architecture baggage that makes the public story harder to understand;
- assumptions that every user starts in a terminal;
- any hidden automation that is hard to inspect or interrupt.

## OpenMeow relationship

OpenMeow should drive adoption by making comux feel instantly useful from anywhere on macOS.

OpenMeow does not need to become a terminal UI. It should remain the zero-chrome intake surface:

- toss a coding task to Cody;
- pick/confirm the project;
- see compact status;
- jump to comux for full cockpit visibility.

Cody is the first conductor persona for this flow. Other users may have their own familiar or coding conductor, but the product pattern is the same.

## v0 scope

### Must have

- Public repo with clear README and product thesis.
- Local daemon/control API skeleton.
- Project open/create command.
- Pane spawn command backed by tmux.
- Worktree-per-pane default.
- Agent launcher for at least one worker agent.
- Pane capture/status command.
- Minimal OpenClaw/Cody bridge contract.

### Nice to have

- OpenMeow “Open in comux” action.
- Multiple agent launchers.
- Event stream for pane attention/completion.
- Simple project autonomy profile metadata.

### Not yet

- Teams/multi-user collaboration.
- Cloud-hosted terminals.
- Full web dashboard.
- Mobile client.
- Complex marketplace/plugin story.

## Trust and safety rules

- comux only operates on explicitly launched project roots.
- The conductor cannot silently expand scope to unrelated repos.
- Secrets, tokens, gateway URLs, and infrastructure URLs never appear in logs or UI copy.
- Dirty worktrees, destructive cleanup, force push, public posting, package publishing, and merges require explicit approval.
- Protected repo rules override project autonomy.
- Every conductor action should be explainable after the fact.

## Immediate next steps

The first public release is live as GitHub release `v0.0.1` and npm package `comux@0.0.1`. The next slice should make that release easier to trust and extend without implying the full cockpit is ready.

1. **First-user polish:** tighten the README, CLI help, `doctor` output, and local smoke path so a new user can understand what works today and where the product is headed.
2. **Test hygiene:** keep the TypeScript CLI/core port covered by fast, reliable tests and remove any brittle release-era assumptions from the suite.
3. **Cody/OpenMeow bridge slice:** build the smallest structured bridge that can hand a scoped coding task into comux and report status back.
4. **Release cadence:** document a lightweight versioning and release checklist for follow-up patches after `v0.0.1`.
5. **Native parity later:** keep native cockpit parity as a separate product track after the bridge and CLI foundations are stable.
