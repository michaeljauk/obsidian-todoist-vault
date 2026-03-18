# Todoist Vault Sync

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/michaeljauk)

An Obsidian community plugin that syncs your Todoist projects and tasks to **real markdown files** in your vault.

![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-purple) ![Version](https://img.shields.io/github/manifest-json/v/michaeljauk/obsidian-todoist-vault) ![License](https://img.shields.io/badge/license-MIT-green) ![Min Obsidian](https://img.shields.io/badge/Obsidian-1.4.0%2B-blueviolet)

Unlike query-based plugins, this writes actual `.md` files so they:

- Work offline once synced
- Appear in search results and backlinks
- Are queryable with [Dataview](https://blacksmithgu.github.io/obsidian-dataview/)
- Are indexed by [Smart Connections](https://smartconnections.app/) alongside your notes
- Sync seamlessly across any vault sync solution (iCloud, Obsidian Sync, Syncthing, Dropbox, git — your choice)

---

## 🚀 Features

- **📁 One file per project** — each Todoist project becomes a dedicated `.md` file
- **🗂️ Sections as headings** — sections become `##` headings; unsectioned tasks go under `## Inbox`
- **🔀 Subtask nesting** — subtasks rendered as indented nested list items
- **🏷️ Rich metadata badges** — due date, priority, recurrence, and labels shown inline below each task
- **📝 Task descriptions** — rendered as collapsible callout blocks
- **🔗 Task deep links** — wrap task titles in links that open directly in Todoist
- **↔️ Bidirectional sync** — check a task in Obsidian → it closes in Todoist on next sync
- **⏱️ Configurable sync interval** — default 15 min, plus a manual "Sync now" command
- **🔄 Status bar indicator** — live sync status with colored dot (green/pulsing/red); click to trigger manual sync
- **🔁 Ribbon sync icon** — quick-access refresh icon in the left ribbon
- **🔍 Project filter** — whitelist specific projects or sync everything
- **✏️ Filename prefix/suffix** — avoid collisions with other notes in your vault
- **✅ Completed tasks** — five modes: hide, show inline, archive section, archive file, or archive folder; configurable fetch strategy (lookback, incremental, or full history)
- **📋 Rich frontmatter** — project URL, color, tags, favorites, shared status, and custom YAML fields

---

## 📦 Installation

### From Community Plugins (recommended)

1. Open Obsidian → **Settings → Community plugins → Browse**
2. Search for **Todoist Vault Sync**
3. Install and enable

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/michaeljauk/obsidian-todoist-vault/releases)
2. Copy all three files into `<vault>/.obsidian/plugins/todoist-vault-sync/`
3. Enable the plugin in **Settings → Community plugins**

---

## ⚙️ Setup

1. Get your API token: Todoist → **Settings → Integrations → Developer → API token**
2. Open plugin settings → paste token → configure sync folder and interval
3. Run **Todoist Vault Sync: Sync now** from the command palette for an immediate sync

> **Security:** Your API token is stored unencrypted in your vault's plugin data directory (`.obsidian/plugins/todoist-vault-sync/data.json`). Protect your vault accordingly.

---

## 🛠️ Settings

### Connection

| Setting | Default | Description |
|---------|---------|-------------|
| API Token | — | Your Todoist API token |

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
| Completed tasks mode | `hide` | How to handle completed tasks — see below |
| Completed fetch mode | `lookback` | Which completed tasks to fetch — `lookback` (N days back), `incremental` (delta since last sync, cached per project), `all` (full history up to 2 years, chunked) |
| Lookback window | `30` | Days to look back when fetch mode is `lookback` (max 89 — Todoist API limit). Also used as the bootstrap window for `incremental` mode. |
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

---

## 📄 File Format

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

### Priority Mapping

Todoist's API uses an inverted priority scale (4 = highest). The plugin converts to human-readable labels:

| Todoist `priority` | Label | Badge |
|--------------------|-------|-------|
| 4 | p1 (urgent) | `🔴 p1` |
| 3 | p2 | `🟠 p2` |
| 2 | p3 | `🟡 p3` |
| 1 | p4 (default) | _(no badge)_ |

---

## ↔️ Bidirectional Sync

Enable **Bidirectional sync** in settings. On the next sync cycle, any task you check in Obsidian will be closed in Todoist, and any task you uncheck (when **Completed tasks** mode is not `hide`) will be reopened.

> **Note:** Only checkbox state is synced back to Todoist. Task content, due dates, and priorities are not written back — Todoist is the source of truth for task content.
>
> **Note:** Reopening a task by unchecking it only works when **Completed tasks** mode is not `hide` — otherwise completed tasks aren't present in the file.

---

## 👩‍💻 Development

```bash
git clone https://github.com/michaeljauk/obsidian-todoist-vault
cd obsidian-todoist-vault
bun install

bun run build        # production build → main.js
bun run dev          # watch mode
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run format       # prettier
bun test             # unit tests (renderer.ts)
```

To test in a vault, copy (or symlink) `main.js`, `manifest.json`, and `styles.css` into:

```
<your-vault>/.obsidian/plugins/todoist-vault-sync/
```

Then reload plugins in Obsidian (**Settings → Community plugins → reload**).

See [`docs/contributing.md`](docs/contributing.md) for how to add new settings or render features.

---

## 🤝 Contributing

Contributions are welcome! Open an issue or submit a pull request on [GitHub](https://github.com/michaeljauk/obsidian-todoist-vault).

---

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by [Michael Jauk](https://github.com/michaeljauk)**

*Not officially affiliated with Todoist or Obsidian. Desktop only (Obsidian mobile is not supported).*
