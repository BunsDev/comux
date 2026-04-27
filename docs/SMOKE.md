# comux smoke test

Run the build, doctor, and package checks from the comux checkout:

```bash
pnpm install --ignore-scripts
pnpm build
node ./comux doctor --json
npm pack --dry-run --json
```

For the interactive cockpit smoke, use a disposable git repository so worktree
creation does not touch the comux checkout. Point to the built comux checkout or
use an installed `comux` binary:

```bash
git init comux-smoke
cd comux-smoke
node ../comux/comux
# or, if installed:
comux
```

Expected behavior:

- `doctor --json` reports tmux and git checks.
- `npm pack --dry-run --json` includes `docs/SMOKE.md`.
- The interactive command opens the terminal cockpit for the disposable project.
- Creating a pane creates an isolated git worktree.
- Closing comux leaves no orphaned controller process.
