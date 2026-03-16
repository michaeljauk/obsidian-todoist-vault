# Changelog

All notable changes to Todoist Vault Sync are documented here.

## [1.0.0] — 2026-03-16

Initial release.

### Features

- **Automatic sync** — pulls Todoist projects and tasks on a configurable interval (default: every 15 minutes) and writes them as `.md` files into a vault folder
- **Project filter** — optionally sync only a subset of Todoist projects by name
- **Bidirectional sync** — checking off a task in Obsidian completes it in Todoist; unchecking reopens it
- **Sections** — each Todoist section becomes a `## heading` in the markdown file
- **Subtasks** — child tasks are rendered as indented checkboxes under their parent
- **Visible meta badges** — optional inline badges for due date (`📅`), recurrence (`🔁`), and priority (`🔴 🟠 🟡`)
- **Description callouts** — task descriptions rendered as collapsible `[!desc]` callout blocks
- **Frontmatter** — configurable frontmatter fields: project URL, color, tags, favorite/shared flags, and custom YAML fields
- **File naming** — configurable prefix/suffix for generated filenames; stable identity via `todoist_project_id` frontmatter (renaming prefix/suffix does not create duplicate files)
- **Task deep links** — optional `todoist://` URI links on task lines
- **Obsidian-compatible HTTP** — uses `requestUrl` adapter so the plugin works within Obsidian's security sandbox (no native `fetch` to external hosts)
- **Pagination** — all Todoist API calls are fully paginated; large projects are handled correctly

### Architecture

- `api.ts` — Todoist REST client with Obsidian-compatible fetch adapter
- `parser.ts` — parses existing vault files to extract checkbox states for bidirectional sync
- `renderer.ts` — pure function: project data → markdown string
- `sync.ts` — orchestrates fetch → diff → render → write cycle
- `settings.ts` — settings interface, defaults, and settings tab UI
