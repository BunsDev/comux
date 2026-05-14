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
- `doctor --json` reports `agent-cli-guidance` and `coven-guidance`.
- `usable` is `true` when there are no blocking errors.
- `healthy` may be `false` if only recommended setup warnings remain.
- `npm pack --dry-run --json` includes the README and docs files intended for npm.

## First-run onboarding smoke

Use this check when touching setup, doctor, agent discovery, or Coven docs.

```bash
pnpm run dev:doctor
node ./comux doctor
node ./comux doctor --json
```

Expected:

- Text output says whether comux can run, even when recommended setup warnings remain.
- If no supported agent CLI is detected, doctor explains that plain terminal panes still work and lists the supported agent CLIs.
- Doctor explains that Coven is optional for core tmux/worktree/agent/merge/PR workflows.
- JSON output includes stable check IDs for automation: `agent-cli-guidance` and `coven-guidance`.
- `comux doctor --fix` only applies safe tmux repairs and the managed tmux config block.

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

## Coven integration smoke

Run this section when Coven is installed locally and you want to verify the optional sessions panel.

Expected:

- `coven doctor` and the local Coven daemon/status command report a usable runtime.
- When Coven is running for the same project, the sidebar shows matching `☾ Coven sessions` entries.
- Pressing `o` on the active project opens the latest matching session as a visible comux pane with `coven attach <session-id>`.
- When Coven is not installed or not running, the active project shows the compact unavailable hint and comux keeps running.

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
