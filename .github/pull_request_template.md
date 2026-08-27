## Summary

<!-- What does this change do, and why? Link the Linear issue (project "Dietai desktop"). -->

## Changes

<!-- Bullet the meaningful changes. Keep the diff scoped to the task. -->

## Definition of Done

<!-- Per .agent/SOP/definition_of_done.md — check what you actually ran; call out anything skipped and why. -->

- [ ] `bun run verify` green (prisma generate · lint · typecheck · unit tests · nutrition eval)
- [ ] Conditional gates for touched areas run (schema migration / i18n en·es·pl / build / e2e): <!-- list or n/a -->
- [ ] Tests added or extended (regression test if this fixes a bug)
- [ ] Security invariants walked for server-boundary changes (`serverAction` runtime, ownership re-check, Zod at boundary, no email exposure) — or n/a
- [ ] `.agent/` docs + README index updated; ADR added for architectural decisions — or n/a
- [ ] Diff is clean: no debug artifacts, no unrelated refactors, generated files regenerated not hand-edited

## Verification evidence

<!-- Paste the tail of the real gate output (test counts, exit status). Unverified work is not done. -->

```
```

## Notes for reviewers

<!-- Risks, rollback path if this needs a rollout SOP, follow-ups filed in Linear. -->
