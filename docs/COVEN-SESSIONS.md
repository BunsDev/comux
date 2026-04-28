# Coven session visibility

comux treats Coven as an optional local runtime. The first integration slice is deliberately thin: comux can render a read-only Coven sessions section in the side panel when a future `coven sessions --json` command is available.

## Adapter boundary

The TUI calls:

```bash
coven sessions --json
```

If the command is missing, unsupported, invalid JSON, or too slow, comux keeps running and shows a compact unavailable state. No unpublished Coven APIs are imported.

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
      "updatedAt": "2026-04-28T12:03:00.000Z"
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
    "updated_at": "2026-04-28T12:03:00.000Z"
  }
]
```

Required fields for comux visibility are `id` and `projectRoot`/`project_root`. Everything else is optional and rendered opportunistically.

## Current UI behavior

- Sessions are filtered to the active comux project roots before rendering.
- Sessions whose project roots cannot be verified are hidden.
- The side panel renders a small `☾ Coven sessions` section under each project with matching sessions.
- Empty and unavailable states are non-fatal and stay inside the side panel.

Future slices can add selection, attach/open actions, and live event timelines without changing this adapter boundary.
