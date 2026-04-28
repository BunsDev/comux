# comux Documentation

This directory holds the public docs for comux: the tmux/worktree cockpit for parallel coding agents and Coven-managed sessions.

## Start here

- [Product spec](PRODUCT-SPEC.md) — product thesis, scope, and integration model.
- [Smoke test](SMOKE.md) — package, CLI, interactive cockpit, and Coven bridge checks.
- [Contributing](../CONTRIBUTING.md) — maintainer dogfood loop and release checklist.

## Documentation stance

Keep comux docs in parity with VMUX-style clarity while staying specific to comux:

- Short public-facing README first.
- Concrete install and quick-start commands.
- Keyboard shortcuts that match the current app.
- Explicit tmux/worktree/agent value proposition.
- Clear relationship to Coven/OpenCoven without making Coven required setup.
- No old VMUX package names or private history as the main story.

## Canonical language

- Product/package/command: **comux** / `comux`
- Runtime surface: **tmux cockpit** or **terminal cockpit**
- Isolation unit: **pane + git worktree + branch**
- OpenCoven relationship: **Coven is the harness substrate; comux is the cockpit**
- Release package: `comux` on npm
