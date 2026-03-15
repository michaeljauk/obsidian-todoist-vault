# Todoist Vault Sync

An Obsidian community plugin that syncs Todoist projects and tasks to **real markdown files** in your vault.

Unlike query-based plugins, this writes actual `.md` files so they:
- Work offline once synced
- Appear in search results and backlinks
- Are queryable with [Dataview](https://blacksmithgu.github.io/obsidian-dataview/)
- Are indexed by [Smart Connections](https://smartconnections.app/) alongside your notes
- Sync seamlessly across any vault sync solution (iCloud, Obsidian Sync, Syncthing, Dropbox, git — your choice)

## Features

- One markdown file per Todoist project
- Sections become `##` headings; unsectioned tasks go under `## Inbox`
- Inline `<!-- id: due: p1 -->` metadata — invisible in reading view, parseable for sync
- **Bidirectional sync**: check a task in Obsidian → it closes in Todoist on next sync
- Configurable sync interval (default 15 min) + manual "Sync now" command
- Whitelist specific projects or sync everything
- Optional display of completed tasks as `- [x]`

## File Format

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

## Installation

### From Community Plugins (recommended)

1. Open Obsidian → **Settings → Community plugins → Browse**
2. Search for **Todoist Vault Sync**
3. Install and enable

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/michaeljauk/obsidian-todoist-vault/releases)
2. Copy both files into `<vault>/.obsidian/plugins/obsidian-todoist-vault/`
3. Enable the plugin in **Settings → Community plugins**

## Setup

1. Get your API token: Todoist → **Settings → Integrations → Developer → API token**
2. Open plugin settings → paste token → configure sync folder and interval
3. Run **Todoist Vault Sync: Sync now** (command palette) to do an immediate sync

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| API Token | — | Todoist API token |
| Sync Folder | `tasks` | Vault folder for task files (created automatically) |
| Sync Interval | `15` min | Background polling interval |
| Project Filter | (all) | Comma-separated project names to include; empty = all |
| Include Completed | off | Show `- [x]` completed tasks in files |

## Bidirectional Sync

After you check a task checkbox in Obsidian, the plugin closes it in Todoist on the next sync cycle. This is always on — no toggle needed.

> **Note:** Only checking (completing) tasks is synced back. Edits to task content, due dates, etc. are not written to Todoist. This plugin treats Todoist as the source of truth for content.

## Development

```bash
git clone https://github.com/michaeljauk/obsidian-todoist-vault
cd obsidian-todoist-vault
bun install

bun run build        # production build → main.js
bun run dev          # watch mode
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run format       # prettier
```

To test in a vault, copy (or symlink) `main.js` and `manifest.json` into:

```
<your-vault>/.obsidian/plugins/obsidian-todoist-vault/
```

Then reload plugins in Obsidian (**Settings → Community plugins → reload**).

## License

MIT
