# Coven session visibility

comux treats Coven as an optional local runtime. The integration is deliberately thin: comux renders a Coven sessions section in the side panel and can open a session through `coven attach`, but Coven remains the session runtime.

## Adapter boundary

The TUI first calls:

```bash
coven sessions --json --all
```

If that is unsupported, comux falls back to:

```bash
coven sessions --json
```

If the command is missing, invalid JSON, or too slow, comux keeps running and shows a compact unavailable state. No unpublished Coven APIs are imported.

## Proposed JSON contract

Either top-level shape is accepted:

```json
{
  "sessions": [
    {
      "id": "session-123",
      "projectRoot": "/path/to/repo",
      "cwd": "/path/to/repo/packages/app",
      "harness": "codex",
      "title": "Fix failing tests",
      "status": "running",
      "createdAt": "2026-04-28T12:00:00.000Z",
      "updatedAt": "2026-04-28T12:03:00.000Z",
      "archivedAt": null
    }
  ]
}
```

or:

```json
[
  {
    "id": "session-123",
    "project_root": "/path/to/repo",
    "harness": "codex",
    "title": "Fix failing tests",
    "status": "running",
    "created_at": "2026-04-28T12:00:00.000Z",
    "updated_at": "2026-04-28T12:03:00.000Z",
    "archived_at": null
  }
]
```

Required fields for comux visibility are `id` and `projectRoot`/`project_root`. Everything else is optional and rendered opportunistically.

## Current UI behavior

- Sessions are filtered to the active comux project roots before rendering.
- Sessions whose project roots cannot be verified are hidden.
- The side panel renders a small `☾ Coven sessions` section under each project with matching running, completed, and archived sessions.
- The active project shows `[o]pen`; pressing `o` opens the latest matching session as a comux shell pane with `coven attach <session-id>`.
- Empty and unavailable states are non-fatal and stay inside the side panel.

Future slices can add per-session selection, summon/archive controls, and live event timelines without changing this adapter boundary.
