# Contributing to comux

comux is developed while running comux itself. The goal is a fast, repeatable loop for maintainers and contributors without hiding work in background magic.

## Prerequisites

- Node.js 18+
- `pnpm`
- `tmux` 3.0+
- Git 2.20+

## Local development

1. Install dependencies:

```bash
pnpm install
```

2. Start comux in local dev mode:

```bash
pnpm dev
```

`pnpm dev` generates local hook docs, compiles TypeScript, and launches comux from `dist/index.js` with `COMUX_DEV=true`.

If setup or reload behavior looks wrong, run:

```bash
comux doctor
comux doctor --fix
```

## Recommended daily workflow

1. Keep one long-lived maintainer checkout for running local comux.
2. Create feature panes/worktrees from comux (`n`) for actual changes.
3. Iterate in feature worktree panes.
4. Use the pane menu (`m`) to merge, create a PR, close, or clean up.
5. Close panes with care when you want to preserve worktrees for later.

## Checks before a PR

```bash
pnpm run typecheck
pnpm run test
pnpm run build
npm pack --dry-run
```

For a fuller manual verification loop, see [`docs/SMOKE.md`](./docs/SMOKE.md).

## Pull request workflow

1. One pane/worktree per feature branch.
2. Keep docs and tests close to the behavior change.
3. Run the checks above before opening the PR.
4. If a change touches worktree, merge, bridge, or daemon behavior, include the relevant smoke notes in the PR description.

## Release checklist

```bash
pnpm run clean
pnpm run build
pnpm run typecheck
pnpm run test
npm pack --dry-run
```

Do not publish, tag, push protected branches, or merge release work without explicit maintainer approval.
