# obsidian-todoist-vault

An Obsidian community plugin that syncs Todoist projects and tasks to **real markdown files** in your vault.

Unlike live-query plugins, this writes actual `.md` files so they're:
- Readable by AI agents (Claude) directly from the repo
- Tracked in git history
- Queryable with Dataview
- Indexed by Smart Connections

## File Format

One file per Todoist project, written to a configurable folder (default: `tasks/`):

```markdown
---
todoist_project_id: "123456"
todoist_synced_at: "2026-03-15T10:00:00Z"
---

# Project Name

## Section Name

- [ ] Task content <!-- id:abc123 due:2026-03-15 p1 -->
- [x] Completed task <!-- id:def456 -->

## Inbox

- [ ] Unsectioned task <!-- id:ghi789 p2 -->
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| API Token | — | Todoist API token (Settings → Integrations) |
| Sync Folder | `tasks` | Vault folder for task files |
| Sync Interval | `15` min | Polling interval |
| Project Filter | (all) | Comma-separated project names to include |
| Include Completed | off | Show `- [x]` completed tasks |

## Bidirectional Sync

Checking a task checkbox in Obsidian will close it in Todoist on the next sync.
This is always enabled — no toggle needed.

## Development

```bash
bun install
node esbuild.config.mjs production   # one-shot build
node esbuild.config.mjs              # watch mode
```

Symlinks in `~/brain/.obsidian/plugins/obsidian-todoist-vault/` point to `main.js` and `manifest.json` for live testing.
