# Todoist Vault Sync

An Obsidian plugin that syncs your [Todoist](https://todoist.com) projects and tasks to real Markdown
files in your vault. Unofficial, community-maintained.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/michaeljauk)

[![CI](https://github.com/michaeljauk/obsidian-todoist-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/michaeljauk/obsidian-todoist-vault/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/manifest-json/v/michaeljauk/obsidian-todoist-vault)](https://github.com/michaeljauk/obsidian-todoist-vault/releases)
[![Obsidian 1.4.0+](https://img.shields.io/badge/Obsidian-1.4.0%2B-blueviolet)](https://obsidian.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Why

Query-based Todoist plugins show your tasks in Obsidian, but the tasks are not in your files. This
plugin writes actual `.md` files instead, so your tasks:

- work offline after a sync
- appear in search results and backlinks
- can be queried with [Dataview](https://blacksmithgu.github.io/obsidian-dataview/)
- get indexed by [Smart Connections](https://smartconnections.app/) together with your notes
- sync with any vault sync method (iCloud, Obsidian Sync, Syncthing, Dropbox, git)

Typical use cases:

- Link tasks from project notes and daily notes
- Let an AI agent that reads your vault see your open tasks
- Keep a Markdown archive of completed tasks

## Features

- **One file per project.** Each Todoist project becomes its own `.md` file.
- **Sections as headings.** Sections become `##` headings. Tasks without a section go under `## Inbox`.
- **Nested subtasks.** Subtasks appear as indented list items.
- **Metadata badges.** Due date, priority, recurrence, and labels appear below each task.
- **Task descriptions** appear as collapsible callouts.
- **Deep links.** Task titles can link to the task in Todoist.
- **Two-way checkbox sync.** Check a task in Obsidian, and the next sync closes it in Todoist.
- **Sync interval.** Default 15 minutes, plus a manual "Sync now" command.
- **Status bar indicator.** A coloured dot shows the sync state (green, pulsing, red). Click it to sync.
- **Ribbon icon** for a manual sync.
- **Project filter.** Sync all projects, or only the ones you list.
- **Filename prefix and suffix** prevent collisions with other notes.
- **Completed tasks.** Five modes: hide, show inline, archive section, archive file, or archive
  folder. Three fetch strategies: lookback, incremental, or full history.
- **Frontmatter.** Project URL, colour, tags, favourite and shared status, and your own YAML fields.

Desktop only. Obsidian mobile is not supported.

## Installation

The plugin is not in the Obsidian community plugin directory. Install it by hand:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/michaeljauk/obsidian-todoist-vault/releases).
2. Copy the three files into `<vault>/.obsidian/plugins/todoist-vault-sync/`.
3. Enable the plugin in **Settings → Community plugins**.

## Setup

1. Get your API token in Todoist: **Settings → Integrations → Developer → API token**.
2. Open the plugin settings, paste the token, and set the sync folder and interval.
3. To sync at once, run **Todoist Vault Sync: Sync now** from the command palette.

> **Security:** The plugin stores your API token unencrypted in the plugin data file
> (`.obsidian/plugins/todoist-vault-sync/data.json`). Protect your vault accordingly.

## Settings

### Connection

| Setting | Default | Description |
|---------|---------|-------------|
| API Token | _(none)_ | Your Todoist API token |

### Sync

| Setting | Default | Description |
|---------|---------|-------------|
| Sync Folder | `tasks` | Vault folder for task files (created automatically) |
| Filename Prefix | _(empty)_ | Prepended to every synced filename, e.g. `📋 ` → `📋 Work.md` |
| Filename Suffix | _(empty)_ | Appended before `.md`, e.g. ` tasks` → `Work tasks.md` |
| Sync Interval | `15` min | Background polling interval (minimum 1) |
| Project Filter | _(all)_ | Comma-separated project names or IDs to include; empty = all. Project IDs are stable across renames. |

### Output

| Setting | Default | Description |
|---------|---------|-------------|
| Completed tasks mode | `hide` | What to do with completed tasks (see below) |
| Completed fetch mode | `lookback` | Which completed tasks to fetch: `lookback` (N days back), `incremental` (changes since the last sync, cached per project), `all` (full history up to 2 years, in chunks) |
| Lookback window | `30` | Days to look back when fetch mode is `lookback` (max 89, a Todoist API limit). Also used as the bootstrap window for `incremental` mode. |
| Archive file suffix | ` Archive` | Suffix added to archive filenames when mode is `archive-file` (e.g. `Work Archive.md`) |
| Archive folder name | `archive` | Subfolder inside the sync folder used when mode is `archive-folder` |
| Show metadata badges | on | Show due date, priority, recurrence, and labels below each task |
| Show task descriptions | on | Render task descriptions as collapsible callouts |
| Task deep links | off | Wrap task titles in links that open the task in Todoist |
| Bidirectional sync | off | Checking a checkbox in Obsidian closes the task in Todoist on next sync |

**Completed tasks mode** options:

| Mode | Behaviour |
|------|-----------|
| `hide` | Completed tasks are not shown |
| `inline` | Completed tasks appear as `- [x]` in each section alongside active tasks |
| `archive-section` | Completed tasks are appended under a `## Completed` heading at the bottom of the file |
| `archive-file` | Completed tasks are written to a separate `<Project> Archive.md` file in the same folder |
| `archive-folder` | Completed tasks are written to a separate file inside a dedicated archive subfolder |

### Frontmatter

| Setting | Default | Description |
|---------|---------|-------------|
| Include project URL | on | Add `todoist_url` to frontmatter |
| Include project color | on | Add `todoist_color` to frontmatter |
| Include tags | on | Add `tags: [todoist]` to frontmatter |
| Include is_favorite | off | Add `todoist_is_favorite` to frontmatter |
| Include is_shared | off | Add `todoist_is_shared` to frontmatter |
| Custom fields | _(empty)_ | Raw YAML lines appended to frontmatter, one per line |

## File format

Each synced project file looks like this:

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

### Priority mapping

The Todoist API uses an inverted priority scale (4 = highest). The plugin converts it to readable labels:

| Todoist `priority` | Label | Badge |
|--------------------|-------|-------|
| 4 | p1 (urgent) | `🔴 p1` |
| 3 | p2 | `🟠 p2` |
| 2 | p3 | `🟡 p3` |
| 1 | p4 (default) | _(no badge)_ |

## Two-way sync

Turn on **Bidirectional sync** in the settings. On the next sync, every task that you checked in
Obsidian closes in Todoist. Every task that you unchecked reopens, if the **Completed tasks** mode is
not `hide`.

> **Note:** Only the checkbox state goes back to Todoist. Content, due dates, and priorities do not.
> Todoist stays the source of truth for task content.
>
> **Note:** A task reopens on uncheck only if the **Completed tasks** mode is not `hide`. With
> `hide`, completed tasks are not in the file.

## Development

```bash
git clone https://github.com/michaeljauk/obsidian-todoist-vault
cd obsidian-todoist-vault
bun install

bun run build        # production build: main.js
bun run dev          # watch mode
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run format       # prettier
bun test             # unit tests (renderer.ts)
```

To test in a vault, copy or symlink `main.js`, `manifest.json`, and `styles.css` into:

```
<your-vault>/.obsidian/plugins/todoist-vault-sync/
```

Then reload the plugins in Obsidian (**Settings → Community plugins → reload**).

[`docs/contributing.md`](docs/contributing.md) explains how to add settings or render features.

## Contributing

Issues and pull requests are welcome on
[GitHub](https://github.com/michaeljauk/obsidian-todoist-vault).

## Disclaimer

Unofficial and not affiliated with Doist (Todoist) or Obsidian. "Todoist" and "Obsidian" are
trademarks of their owners.

## Support

Built by [Michael Jauk](https://github.com/michaeljauk). If this saves you time, consider
[buying me a coffee](https://buymeacoffee.com/michaeljauk).

## License

[MIT](./LICENSE) © Michael Jauk
