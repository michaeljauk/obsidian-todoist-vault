# Changelog

All notable changes to Todoist Vault Sync are documented here.

## [1.2.0] — 2026-03-18

### Added

- **Status bar indicator** — shows sync status ("Todoist synced Xm ago", "Todoist syncing…", "Todoist sync failed") with a colored dot (green = idle, pulsing blue = syncing, red = error). Click to trigger a manual sync.
- **Ribbon sync icon** — `refresh-cw` icon in the left ribbon for quick manual sync access.
- **Project filter accepts IDs** — `projectFilter` now matches by project ID in addition to name, so filters survive project renames.

### Internal

- Extracted `RenderOptions` interface; unified `renderTask`/`renderTaskTree` into a single code path.
- `buildChildrenMap` now called once per `buildTaskLines` rather than per task.
- Incremental completed-task cache trimmed to the 2-year history cap to prevent unbounded `data.json` growth.
- `parser.ts` regex hardened to require `<!-- id:` prefix, preventing false matches on other HTML comments.
- Duplicate sync folder creation removed from `main.ts` (already handled in `sync.ts`).

## [1.1.0] — 2026-03-18

### Added

- **Completed task archiving** — configurable `completedMode` setting with five options: `hide`, `inline`, `archive-section`, `archive-file`, and `archive-folder`. Switching modes automatically cleans up previously written archive files.
- **Configurable fetch strategy** — `completedFetchMode` setting: `lookback` (N days back), `incremental` (delta since last sync, cached per project), or `all` (full history in 3-month chunks).
- **Rate limit notice** — an Obsidian notice is shown when the Todoist API returns HTTP 429 during a completed task fetch; active tasks continue to sync normally.
- **Status bar indicator** — shows sync status text ("synced Xm ago", "syncing…", "sync failed") with a colored dot (green = idle, pulsing blue = syncing, red = error, gray = waiting). Click to trigger a manual sync.
- **Ribbon sync icon** — `refresh-cw` icon in the left ribbon for quick manual sync access.
- **Plugin stylesheet** — new `styles.css` with status bar hover state, status dot colors, and pulse animation.

### Fixed

- Completed task fetching now correctly uses the `getCompletedTasksByCompletionDate` endpoint (`getTasks` only returns active tasks).
- Long date ranges (> 3 months) are automatically chunked to stay within the Todoist API window limit.

### Internal

- Added `bun test` unit tests for `renderer.ts` covering all `completedMode` variants, frontmatter, task formatting, sections, and descriptions.
- CI now runs `format:check` and `bun test` in addition to typecheck and lint.
- Release workflow is gated on passing the full check suite.

## [1.0.3] — 2026-03-17

### Fixed

- Bidirectional sync: added `SyncState` persistence to prevent stale checkbox state from incorrectly re-closing tasks that Todoist reopened, or re-opening tasks that were just completed externally. The set of completed task IDs is now tracked across syncs and stored in plugin data.

## [1.0.2] — 2026-03-17

### Fixed

- Rephrased 13 UI strings to pass the Obsidian review bot's sentence-case check (bot uses a default brand list that excludes third-party names)
- Simplified command name from "Sync Todoist now" to "Sync now" (Obsidian prefixes commands with the plugin name automatically)
- Simplified frontmatter setting descriptions to be self-explanatory without referencing specific frontmatter key names

## [1.0.1] — 2026-03-16

### Fixed

- Removed unnecessary type assertion in Obsidian fetch adapter (`api.ts`)
- Replaced `console.log` with `console.debug` for plugin lifecycle messages
- Fixed async Promise-in-void warning in polling interval callback
- Removed `[TodoistVault]` prefix from user-facing `Notice` messages
- Fixed 20 sentence-case violations in UI strings (settings labels, descriptions, placeholders)
- Added `eslint-plugin-obsidianmd` to enforce Obsidian plugin lint rules locally

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
