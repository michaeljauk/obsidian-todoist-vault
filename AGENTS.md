# AGENTS.md — Todoist Vault Sync

> **Self-improving document.** If you are an AI agent working in this repo and you discover anything incorrect, outdated, or missing here, update this file as part of your task. Add a one-line entry to the [Changelog](#changelog) at the bottom.
>
> This file is intentionally public — keep it free of personal data, private API tokens, internal company references, and private file paths.

---

## Project at a Glance

An **Obsidian community plugin** (not a web app, not a monorepo) that pulls Todoist projects and tasks and writes them as real `.md` files into the vault.

- **Runtime:** Bun 1.3.10 (enforced — do not use npm or yarn)
- **Language:** TypeScript (ES2018 target, strict null checks)
- **Bundler:** esbuild → single CJS `main.js` (Obsidian loads this)
- **Obsidian API version:** minimum 1.4.0
- **Todoist SDK:** `@doist/todoist-api-typescript` v7.1.1

---

## Architecture

```
src/
├── main.ts       Plugin entry point — lifecycle, commands, ribbon icon, status bar, intervals
├── api.ts        Obsidian-compatible Todoist REST client (custom fetch adapter + pagination)
├── settings.ts   TodoistVaultSettings interface + DEFAULT_SETTINGS + PluginSettingTab UI
├── sync.ts       Orchestrator — fetches data, runs bidirectional sync, calls renderer, writes files
├── renderer.ts   Pure functions: project data → markdown string
└── parser.ts     Parses existing file content to extract task checkbox states for bidirectional sync
styles.css        Status bar hover state, status dot colors, pulse animation
```

### Data Flow

```
Todoist REST API
      │
   api.ts  (getProjects / getSections / getTasks — all paginated)
      │
   sync.ts (filter projects → optional bidir check → render → vault write)
      │
renderer.ts  (renderProject → markdown string)
      │
   Obsidian Vault (TFile create / modify)
```

Bidirectional flow:

```
Vault file (existing content)
      │
   parser.ts  (parseTaskStates → Map<taskId, boolean>)
      │
   sync.ts  (compare local state vs Todoist state → closeTask / reopenTask)
```

---

## Module Details

### `api.ts`

Wraps `@doist/todoist-api-typescript` with an **Obsidian-compatible fetch adapter**.

Obsidian's security sandbox blocks the browser's native `fetch` from reaching external URLs. The `obsidianFetch` adapter uses `requestUrl` (Obsidian's allowed HTTP method) to proxy all SDK requests. All methods use cursor-based pagination and collect all pages before returning.

Methods: `getProjects()`, `getSections(projectId)`, `getTasks(projectId)`, `getCompletedTasks(projectId, since, until)`, `closeTask(taskId)`, `reopenTask(taskId)`.

**Important:** `getTasks` returns only **active** (non-completed) tasks. Completed tasks require a separate `getCompletedTasks(projectId, since, until)` call, which paginates `getCompletedTasksByCompletionDate` and collects all pages. The `since`/`until` window is determined by `sync.ts` based on `completedFetchMode`. The Todoist API enforces a ~3-month window per request; `sync.ts` handles longer ranges by chunking via `fetchCompletedChunked`.

### `parser.ts`

```ts
parseTaskStates(content: string): Map<string, boolean>
```

Regex: `/^\s*- \[([ xX])\] .+<!-- id:(\S+)/gm`

Matches any checkbox line (`- [ ]` or `- [x]`) that has a `<!-- id:... -->` comment. Returns a map of `taskId → isChecked`. Used exclusively by `sync.ts` during the bidirectional sync phase to compare local checkbox state against Todoist's task completion state.

### `renderer.ts`

Pure module — no side effects, no Obsidian API imports. Takes project data and returns a `RenderResult`:

```ts
export interface RenderResult {
  projectContent: string       // always present — the main project file content
  archiveContent: string | null // non-null only for 'archive-file' and 'archive-folder' modes
}
```

`renderProject()` partitions tasks into `activeTasks` and `completedTasks`, then builds content according to `completedMode`. For `archive-section` mode, completed tasks are appended under a `## Completed` heading (with `###` sub-headings for sections). For `archive-file`/`archive-folder` modes, the archive content is built by the private `buildArchiveContent()` helper (same frontmatter including `todoist_project_id`, plus a completed-tasks-only view).

### `sync.ts`

Exports `runSync(app, settings, syncState): Promise<SyncState>`. `SyncState` has three fields, all persisted in `data.json` by `main.ts`:
- `completedTaskIds`: task IDs completed at the end of the last sync — used to detect user-driven checkbox changes
- `lastCompletedFetchAt`: ISO timestamp of last completed-task fetch — used in `incremental` mode
- `completedTasksCache`: per-project accumulated `Task[]` — used in `incremental` mode so the archive stays complete even though each sync only fetches the delta

Orchestrates one full sync cycle:
1. Ensure sync folder exists; for `archive-folder` mode also ensure the archive subfolder exists
2. Fetch all projects, apply `projectFilter`
3. For each project, fetch sections and active tasks in parallel (`Promise.all`)
4. If `completedMode !== 'hide'`, fetch completed tasks according to `completedFetchMode`:
   - `lookback`: fetch `completedLookbackDays` days back from now
   - `incremental`: fetch delta since `lastCompletedFetchAt`, merge into per-project cache
   - `all`: fetch entire history in 3-month chunks via `fetchCompletedChunked`
   - On HTTP 429, shows an Obsidian `Notice` and continues with active tasks only
5. If `bidirectionalSync`: read existing file, parse states, compare against `syncState` to close/reopen only genuinely user-changed tasks (reopen only when `completedMode !== 'hide'`)
6. Render project via `renderProject()` → `RenderResult`
7. Write main project file (create or modify)
8. If `result.archiveContent !== null`, write the archive file (create or modify) at the archive path
9. After all projects: call `cleanupOrphanedArchiveFiles()` — scans the sync folder and all immediate subfolders for files with `todoist_is_archive: true` frontmatter that were **not** written in this sync cycle and trashes them. Also removes empty subfolders left behind.
10. Return updated `SyncState`

**Archive path logic:**
- `archive-file`: `{syncFolder}/{filePrefix}{projectName}{archiveFileSuffix}.md`
- `archive-folder`: `{syncFolder}/{archiveFolder}/{filePrefix}{projectName}{fileSuffix}.md`

File identity uses `todoist_project_id` from frontmatter. The shared `findAndMoveFileByProjectId()` helper scans a folder for a file with matching frontmatter and renames it to the target path. For `archive-file` mode, the main file path is passed as `excludePath` to avoid matching the main file when scanning for the archive file (both share the same `todoist_project_id`).

---

## File Format Spec

```markdown
---
todoist_project_id: "123456"
todoist_is_archive: true                                 ← archive files only (used by cleanup logic)
todoist_url: "https://todoist.com/app/project/123456"   ← optional (includeUrl)
todoist_color: "blue"                                    ← optional (includeColor)
tags:                                                    ← optional (includeTags)
  - todoist
todoist_is_favorite: false                               ← optional (includeIsFavorite)
todoist_is_shared: false                                 ← optional (includeIsShared)
# custom YAML lines from frontmatter.customFields        ← optional
---

# Project Name

## Section Name

- [ ] Task content <!-- id:abc123 due:2026-03-15 p1 -->
  `📅 Mar 15` `🔴 p1`                                   ← visible meta (showVisibleMeta)
  > [!desc]- Description                                 ← description callout (showDescription)
  > Description text here

- [ ] Recurring task <!-- id:def456 recur:every day -->
  `📅 Mar 16` `🔁 every day`

  - [ ] Subtask <!-- id:sub789 -->                       ← indented child task

## Inbox

- [ ] Unsectioned task <!-- id:ghi789 p2 -->
```

**Inline comment format:** `<!-- id:<taskId> [due:<YYYY-MM-DD>] [recur:<string>] [p1|p2|p3] -->`

The `recur` field is the raw `task.due.string` from Todoist (e.g. `"every day at 10am"`, `"every 2 weeks"`).

**Priority mapping** (Todoist API is inverted — priority 4 is the highest):

| API `priority` | Display label | Badge |
|---|---|---|
| 4 | p1 (urgent) | `🔴 p1` |
| 3 | p2 | `🟠 p2` |
| 2 | p3 | `🟡 p3` |
| 1 | p4 (default) | _(no badge)_ |

Formula: `p${5 - task.priority}` converts API value to display label.

---

## Settings Interface

Defined in `settings.ts`. **When adding a new setting, update all three places in one commit:** `TodoistVaultSettings` interface, `DEFAULT_SETTINGS` object, and `display()` UI method.

| Field | Type | Default |
|-------|------|---------|
| `apiToken` | string | `''` |
| `syncFolder` | string | `'tasks'` |
| `syncIntervalMinutes` | number | `15` |
| `projectFilter` | string[] | `[]` |
| `completedMode` | `CompletedMode` | `'hide'` |
| `completedFetchMode` | `CompletedFetchMode` | `'lookback'` |
| `completedLookbackDays` | number | `30` |
| `archiveFileSuffix` | string | `' Archive'` |
| `archiveFolder` | string | `'archive'` |
| `bidirectionalSync` | boolean | `false` |
| `taskDeepLinks` | boolean | `false` |
| `showVisibleMeta` | boolean | `true` |
| `showDescription` | boolean | `true` |
| `filePrefix` | string | `''` |
| `fileSuffix` | string | `''` |
| `frontmatter` | FrontmatterSettings | see code |

`CompletedMode` values: `'hide'` · `'inline'` · `'archive-section'` · `'archive-file'` · `'archive-folder'`

`CompletedFetchMode` values: `'lookback'` · `'incremental'` · `'all'`

**Migration:** users upgrading from v1.x (which had `includeCompleted: boolean`) are automatically migrated on first load — `true` → `'inline'`, `false` → `'hide'`.

`FrontmatterSettings` sub-object: `includeUrl`, `includeColor`, `includeTags`, `includeIsFavorite`, `includeIsShared`, `customFields`.

---

## Key Invariants

1. **Todoist is source of truth for content.** The plugin never writes task content, due dates, or priority back to Todoist — only task completion state (via `closeTask` / `reopenTask`).
2. **`todoist_project_id` in frontmatter is the stable file identity.** If `filePrefix`/`fileSuffix` change, `sync.ts` scans for the old file by frontmatter and renames it rather than creating a duplicate.
3. **`renderer.ts` is pure.** No side effects, no Obsidian API calls. Keep it that way — it makes the render logic easy to reason about and test.
4. **`main.js` is a build artifact.** Never edit it by hand; always regenerated by `bun run build`.
5. **Task IDs are permanent.** Todoist task IDs never change even if task content is edited. The inline `<!-- id:... -->` comment survives content updates between syncs.

---

## Development Workflow

```bash
bun install          # install deps
bun run dev          # watch mode — rebuilds main.js on save
bun run build        # production build
bun run typecheck    # tsc --noEmit
bun run lint         # eslint
bun run format       # prettier --write
```

### Testing in Obsidian

1. Run `bun run build`
2. Copy (or symlink) `main.js` + `manifest.json` into:
   ```
   <your-vault>/.obsidian/plugins/obsidian-todoist-vault/
   ```
3. In Obsidian: **Settings → Community plugins → Reload plugins**

Run tests with `bun test` (or `bun run test`). Test files live alongside source as `*.test.ts`. Currently `renderer.ts` is covered — it is the only pure module and the natural place for unit tests. `sync.ts`, `api.ts`, and `main.ts` depend on the Obsidian API and are tested manually via vault.

### Releasing

1. Update `CHANGELOG.md` with the new version's changes
2. Run `bun version <new-version>` — this bumps `package.json`, runs `version-bump.mjs` (syncs `manifest.json` + `versions.json`), and stages both files
3. Commit: `chore(release): bump version to <new-version>`
4. Push and tag — **tag must be bare semver, no `v` prefix** (Obsidian rejects `v1.0.0`):
   ```bash
   git push origin main
   git tag 1.0.0
   git push origin 1.0.0
   ```
5. The release workflow (`.github/workflows/release.yml`) triggers automatically, builds `main.js`, and creates a GitHub Release with `main.js` + `manifest.json` as assets
6. Verify at `github.com/michaeljauk/obsidian-todoist-vault/releases` that both assets are attached before submitting to the store

### Commit Convention

Commits are linted by `commitlint`. Format: `type(scope): description`.

| Type | When |
|------|------|
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `docs` | Documentation only |
| `chore` | Tooling, deps, config |
| `style` | Formatting only |
| `test` | Tests only |

Scopes map to source modules:

| Scope | File(s) |
|-------|---------|
| `api` | `src/api.ts` |
| `settings` | `src/settings.ts` |
| `sync` | `src/sync.ts` |
| `renderer` | `src/renderer.ts` |
| `parser` | `src/parser.ts` |
| `main` | `src/main.ts` |
| `build` | `esbuild.config.mjs`, `tsconfig.json` |
| `deps` | `package.json`, `bun.lock` |
| `docs` | `README.md`, `AGENTS.md`, `docs/` |

Examples: `feat(settings): add priority filter`, `fix(sync): prevent duplicate files on prefix change`, `docs(readme): fix bidirectional sync description`.

---

## Obsidian API Patterns Used

- `app.vault.getFolderByPath(path)` — check if folder exists
- `app.vault.createFolder(path)` — create folder
- `app.vault.getFileByPath(path)` — get TFile or null
- `app.vault.read(file)` — read raw string content
- `app.vault.modify(file, content)` — overwrite file
- `app.vault.create(path, content)` — create new file
- `app.metadataCache.getFileCache(file)` — access frontmatter
- `app.fileManager.renameFile(file, newPath)` — rename/move file
- `app.fileManager.trashFile(file)` — move file (or empty folder) to system trash; used by `cleanupOrphanedArchiveFiles`
- `this.addStatusBarItem()` — creates a status bar element (bottom right); returns `HTMLElement`
- `this.addRibbonIcon(icon, title, callback)` — adds a ribbon icon (left sidebar)
- `window.setInterval` / `window.clearInterval` — used directly (not `this.registerInterval`) so the plugin can track the ID and clear it manually in `onunload()`

---

## Common Pitfalls

- **Do not import Node.js built-ins** (`fs`, `path`, etc.) — Obsidian plugins run in a sandboxed browser-like environment. Use the Obsidian Vault API instead.
- **Do not use the browser's native `fetch`** for external requests — use `requestUrl` from Obsidian API (already handled in `api.ts` via the `obsidianFetch` adapter).
- **Do not use `normalizePath` on absolute paths** — only vault-relative paths.
- **Priority is inverted in the Todoist API:** `priority: 4` = p1 (urgent). Use `p${5 - task.priority}` to get the display label.
- **`fileSuffix`/`filePrefix` rename flow** — if you change filename construction in `sync.ts`, also update the frontmatter scan fallback that finds files by `todoist_project_id`.
- **Adding a setting requires touching three places** — interface, defaults, and UI. See [`docs/contributing.md`](docs/contributing.md).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-16 | Initial AGENTS.md created |
| 2026-03-16 | Full sweep: added module details, fixed file format, expanded pitfalls, corrected deep link URL type |
| 2026-03-16 | Removed table layout; updated commit convention to require scopes |
| 2026-03-17 | Updated sync.ts section to document SyncState parameter/return value (added in 1.0.3) |
| 2026-03-17 | Fixed README version badge (1.0.1 → 1.0.3); fixed contributing.md plugin folder path (obsidian-todoist-vault → todoist-vault-sync) |
| 2026-03-18 | Replaced `includeCompleted` with `completedMode` (5 options); added archive file/folder/section support; updated renderer.ts and sync.ts sections |
| 2026-03-18 | Fixed completed task fetching: `getTasks` returns active tasks only; added `getCompletedTasks` using `getCompletedTasksByCompletionDate` API |
| 2026-03-18 | Added configurable `completedFetchMode` (lookback/incremental/all); chunked fetching for 3-month API window; rate limit Notice on 429; updated SyncState, settings table, and module docs |
| 2026-03-18 | Added `bun test` unit tests for `renderer.ts` (29 tests); added `test` script to package.json |
| 2026-03-18 | Added GitHub PR template; updated contributing.md and README.md to reflect completedMode enum and bun test |
| 2026-03-18 | Added status bar indicator (clickable, status dot, hover state), ribbon sync icon, styles.css; updated Obsidian API patterns, architecture tree, release workflow |
| 2026-03-18 | Full sweep: added cleanupOrphanedArchiveFiles step to sync.ts section; added todoist_is_archive to file format spec; added trashFile to Obsidian API patterns; fixed README bidirectional sync outdated "Show completed tasks" terminology |
