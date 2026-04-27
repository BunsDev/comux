# comux smoke test

Run the build, doctor, and package checks from the comux checkout:

```bash
pnpm install --ignore-scripts
pnpm build
node ./comux doctor --json
npm pack --dry-run --json
```

For the interactive cockpit smoke, use a disposable git repository outside the
comux checkout so worktree creation cannot touch the project under test. Replace
`/path/to/comux/checkout/comux` with the path to the `comux` executable in your
checkout, or use an installed `comux` binary after packaging:

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

Expected behavior:

- `doctor --json` reports tmux and git checks.
- `npm pack --dry-run --json` includes `docs/SMOKE.md`.
- The interactive command opens the terminal cockpit for the disposable project.
- Creating a pane creates an isolated git worktree.
- Closing comux leaves no orphaned controller process.
