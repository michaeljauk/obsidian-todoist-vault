## Type

<!-- feat | fix | refactor | docs | chore | style | test -->

## Summary

<!-- What does this PR do and why? -->

## Breaking Changes

<!-- Does this change the file format, frontmatter fields, or setting keys in a way that affects existing vaults? -->

- [ ] No breaking changes
- [ ] Yes — describe migration path:

## Testing

<!-- How was this tested? -->

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun test` passes (if renderer.ts changed)
- [ ] Manually verified in Obsidian vault (if sync/api/main changed)

## Checklist

- [ ] Commit message follows `type(scope): description` convention
- [ ] New settings touch all three places (interface, defaults, UI)
- [ ] No Node.js built-ins imported (`fs`, `path`, etc.)
- [ ] `AGENTS.md` updated (if architecture, data flow, or file format changed)
- [ ] `CHANGELOG.md` updated (for releases)
