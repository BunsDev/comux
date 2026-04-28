# comux smoke test

Use this loop to verify the current public CLI/core path.

## Package checks

From the comux checkout:

```bash
pnpm install --ignore-scripts
pnpm run typecheck
pnpm run test
pnpm run build
node ./comux doctor --json
npm pack --dry-run --json
```

Expected:

- TypeScript and tests pass.
- `doctor --json` reports tmux and git checks.
- `usable` is `true` when there are no blocking errors.
- `healthy` may be `false` if only recommended setup warnings remain.
- `npm pack --dry-run --json` includes the README and docs files intended for npm.

## Interactive cockpit smoke

Use a disposable git repository outside the comux checkout so worktree creation cannot touch the project under test.

Replace `/path/to/comux/checkout/comux` with the executable from your checkout, or use an installed `comux` binary after packaging.

```bash
rm -rf /tmp/comux-smoke
mkdir -p /tmp/comux-smoke
cd /tmp/comux-smoke

git init
git config user.email smoke@example.com
git config user.name "comux smoke"
echo '# smoke' > README.md
git add README.md
git commit -m "init smoke repo"

node /path/to/comux/checkout/comux
# or, if installed:
comux
```

Expected:

- comux opens the terminal cockpit for the disposable project.
- `n` creates an agent/worktree pane.
- `t` creates a plain terminal pane.
- `u` opens rituals.
- `f` opens the file browser for a worktree pane.
- `m` opens the pane menu.
- `h` / `H` hide and restore pane visibility.
- `p` adds another project to the sidebar.
- `r` can reopen a closed worktree.
- Closing comux leaves no orphaned controller process.

## Merge / PR smoke

Use only disposable branches for this check.

Expected:

- A worktree pane can be reviewed from the pane menu.
- Merge and PR actions remain explicit menu choices.
- comux does not push, merge, publish, delete, or clean up work without a user action.
- Hooks can run on worktree create / pre-merge / post-merge when configured.

## Coven bridge smoke

When a local Coven daemon is available for the same project:

- comux can list/open Coven sessions through the daemon bridge.
- launching a Coven session is scoped to the current project root.
- out-of-project `cwd` values are rejected before work starts.
- opening a Coven session creates a pane that runs `coven attach <session-id>`.

Keep this smoke conservative: it should prove project scoping and visibility, not hidden automation.
