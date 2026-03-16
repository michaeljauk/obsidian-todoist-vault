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
- Subtasks are rendered as indented nested list items
- Inline `<!-- id: due: p1 -->` metadata — invisible in reading view, parseable for sync
- **Metadata badges:** due date, priority, recurrence, and labels shown inline below each task
- **Task descriptions** rendered as collapsible callout blocks (list) or table column
- **Task deep links:** wrap task titles in links that open the task directly in Todoist
- **Bidirectional sync** (opt-in): check a task in Obsidian → it closes in Todoist on next sync
- Configurable sync interval (default 15 min) + manual "Sync now" command
- Whitelist specific projects or sync everything
- Configurable filename prefix/suffix to avoid collisions with other notes
- Optional display of completed tasks as `- [x]`

## File Format

```markdown
---
todoist_project_id: "123456"
todoist_url: "https://todoist.com/app/project/123456"
todoist_color: "blue"
tags:
  - todoist
---

# Project Name

## Section Name

- [ ] Task content <!-- id:abc123 due:2026-03-15 p1 -->
  `📅 Mar 15` `🔴 p1`

- [ ] Recurring task <!-- id:def456 recur:every day -->
  `📅 Mar 16` `🔁 every day`

## Inbox

- [ ] Unsectioned task <!-- id:ghi789 p2 -->
  `🟠 p2`
  - [ ] Subtask <!-- id:jkl012 -->
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

> **Security:** Your API token is stored unencrypted in your vault's plugin data directory (`.obsidian/plugins/obsidian-todoist-vault/data.json`). Protect your vault accordingly.

## Settings

### Connection

| Setting | Default | Description |
|---------|---------|-------------|
| API Token | — | Todoist API token |

### Sync

| Setting | Default | Description |
|---------|---------|-------------|
| Sync Folder | `tasks` | Vault folder for task files (created automatically) |
| Filename prefix | _(empty)_ | Prepended to every synced filename, e.g. `📋 ` → `📋 Work.md` |
| Filename suffix | _(empty)_ | Appended before `.md`, e.g. ` tasks` → `Work tasks.md` |
| Sync Interval | `15` min | Background polling interval (minimum 1) |
| Project Filter | _(all)_ | Comma-separated project names to include; empty = all |

### Output

| Setting | Default | Description |
|---------|---------|-------------|
| Show completed tasks | off | Render completed tasks as `- [x]` |
| Show metadata badges | on | Show due date, priority, recurrence, and labels below each task |
| Show task descriptions | on | Render task descriptions as collapsible callouts |
| Task deep links | off | Wrap task titles in links that open the task in Todoist |
| Bidirectional sync | off | Checking a checkbox in Obsidian closes the task in Todoist on next sync |

### Frontmatter

| Setting | Default | Description |
|---------|---------|-------------|
| Include project URL | on | Add `todoist_url` to frontmatter |
| Include project color | on | Add `todoist_color` to frontmatter |
| Include tags | on | Add `tags: [todoist]` to frontmatter |
| Include is_favorite | off | Add `todoist_is_favorite` to frontmatter |
| Include is_shared | off | Add `todoist_is_shared` to frontmatter |
| Custom fields | _(empty)_ | Raw YAML lines appended to frontmatter, one per line |

## Bidirectional Sync

Enable **Bidirectional sync** in settings. On the next sync cycle, any task you have checked in Obsidian will be closed in Todoist, and any task you have unchecked (when "Show completed tasks" is on) will be reopened.

> **Note:** Only the checkbox state is synced back. Task content, due dates, etc. are not written to Todoist. Todoist is the source of truth for task content.
>
> **Note:** Reopening a task (unchecking a completed one) only works when **Show completed tasks** is enabled — otherwise completed tasks aren't written to the file and can't be detected.

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

See [`docs/contributing.md`](docs/contributing.md) for how to add new settings or render features.

## License

MIT
