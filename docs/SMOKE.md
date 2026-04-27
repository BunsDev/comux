# comux smoke test

Run these commands from a git repository on a machine with tmux installed:

```bash
pnpm install --ignore-scripts
pnpm build
node ./comux doctor --json
node ./comux
```

Expected behavior:

- `doctor --json` reports tmux and git checks.
- `node ./comux` opens the terminal cockpit for the current project.
- Creating a pane creates an isolated git worktree.
- Closing comux leaves no orphaned controller process.
