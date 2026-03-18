# Contributing

## Prerequisites

- [Bun](https://bun.sh) 1.3+ (the only supported package manager)
- An Obsidian vault for manual testing

```bash
git clone https://github.com/michaeljauk/obsidian-todoist-vault
cd obsidian-todoist-vault
bun install
```

## Development Loop

```bash
bun run dev        # watch mode — rebuilds main.js on every save
bun run typecheck  # type-check without emitting
bun run lint       # eslint
bun run format     # prettier --write
```

To load the plugin in Obsidian, symlink (or copy) `main.js`, `manifest.json`, and `styles.css` into your vault:

```
<your-vault>/.obsidian/plugins/todoist-vault-sync/
```

After each rebuild, go to **Settings → Community plugins → Reload plugins** in Obsidian. There are no automated tests — verification is manual.

## Commit Convention

Commits are enforced by `commitlint`. Format: `type(scope): description`.

Valid types: `feat`, `fix`, `refactor`, `docs`, `chore`, `style`, `test`.

Scopes map to source modules: `api`, `settings`, `sync`, `renderer`, `parser`, `main`, `build`, `deps`, `docs`.

Examples:
```
feat(settings): add priority filter
fix(sync): prevent duplicate files on prefix change
docs(readme): fix bidirectional sync description
```

---

## How to Add a New Setting

Settings span three locations that must be updated together:

**1. `src/settings.ts` — interface**
```ts
export interface TodoistVaultSettings {
  // ...existing fields...
  myNewSetting: boolean  // add here
}
```

**2. `src/settings.ts` — default value**
```ts
export const DEFAULT_SETTINGS: TodoistVaultSettings = {
  // ...existing defaults...
  myNewSetting: false  // add here
}
```

**3. `src/settings.ts` — `display()` UI**

Add a `new Setting(containerEl)` block under the appropriate section heading (`Connection`, `Sync`, `Output`, `Frontmatter`, `Actions`). Match the style of the existing settings.

Then use `this.plugin.settings.myNewSetting` in `sync.ts` or `renderer.ts` as needed.

---

## How to Add a New Render Feature

All markdown generation lives in `src/renderer.ts`. It is a **pure module** — no Obsidian API imports, no side effects. Keep it that way.

The main export is `renderProject(project, sections, tasks, ...settings)`. If your feature depends on a new setting, add it to the function signature and thread it through the call site in `src/sync.ts`.

---

## Key Files Quick Reference

| File | Role |
|------|------|
| `src/main.ts` | Plugin lifecycle, commands, ribbon icon, status bar, intervals |
| `src/api.ts` | Todoist REST client (fetch adapter + pagination) |
| `src/settings.ts` | Settings interface, defaults, UI |
| `src/sync.ts` | Sync orchestrator — reads vault, calls API, writes files |
| `src/renderer.ts` | Pure markdown renderer |
| `src/parser.ts` | Parses existing files to extract checkbox states |
| `styles.css` | Status bar hover state, status dot colors, pulse animation |
| `main.js` | Build artifact — never edit by hand |

See [`AGENTS.md`](../AGENTS.md) for the full architecture reference.

---

## Releasing

Releases are cut by the maintainer. The full process is documented in [`AGENTS.md → Releasing`](../AGENTS.md). In short: update `CHANGELOG.md`, bump the version, push a bare semver tag (`1.0.0` — no `v` prefix), and the release workflow handles the rest.
