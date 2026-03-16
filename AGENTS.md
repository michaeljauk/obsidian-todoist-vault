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
├── main.ts       Plugin entry point — lifecycle, command registration, interval scheduling
├── api.ts        Obsidian-compatible Todoist REST client (custom fetch adapter + pagination)
├── settings.ts   TodoistVaultSettings interface + DEFAULT_SETTINGS + PluginSettingTab UI
├── sync.ts       Orchestrator — fetches data, runs bidirectional sync, calls renderer, writes files
├── renderer.ts   Pure functions: project data → markdown string
└── parser.ts     Parses existing file content to extract task checkbox states for bidirectional sync
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

Methods: `getProjects()`, `getSections(projectId)`, `getTasks(projectId)`, `closeTask(taskId)`, `reopenTask(taskId)`.

### `parser.ts`

```ts
parseTaskStates(content: string): Map<string, boolean>
```

Regex: `/^\s*- \[([ xX])\] .+<!-- id:(\S+)/gm`

Matches any checkbox line (`- [ ]` or `- [x]`) that has a `<!-- id:... -->` comment. Returns a map of `taskId → isChecked`. Used exclusively by `sync.ts` during the bidirectional sync phase to compare local checkbox state against Todoist's task completion state.

### `renderer.ts`

Pure module — no side effects, no Obsidian API imports. Takes project data and returns a markdown string as a checkbox list with optional badge lines and description callout blocks.

### `sync.ts`

Orchestrates one full sync cycle:
1. Fetch all projects, apply `projectFilter`
2. For each project, fetch sections and tasks in parallel (`Promise.all`)
3. If `bidirectionalSync`: read existing file, parse states, close/reopen changed tasks
4. Render project to string via `renderProject()`
5. Write file (create or modify)

File identity uses `todoist_project_id` from frontmatter — if `filePrefix`/`fileSuffix` changed, scans the folder for a file with matching frontmatter and renames it rather than creating a duplicate.

---

## File Format Spec

```markdown
---
todoist_project_id: "123456"
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
| `includeCompleted` | boolean | `false` |
| `bidirectionalSync` | boolean | `false` |
| `taskDeepLinks` | boolean | `false` |
| `showVisibleMeta` | boolean | `true` |
| `showDescription` | boolean | `true` |
| `filePrefix` | string | `''` |
| `fileSuffix` | string | `''` |
| `frontmatter` | FrontmatterSettings | see code |

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

There are currently **no automated tests**. Manual vault testing is the verification method.

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
