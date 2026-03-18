## Type

<!-- feat | fix | refactor | docs | chore | style | test -->

## Summary

<!-- What does this PR do and why? -->

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
- [ ] `CHANGELOG.md` updated (for releases)
