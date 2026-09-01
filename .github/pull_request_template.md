## Summary

<!-- What does this change do, and why? Link the Linear issue (project "Dietai desktop"). -->

## Changes

<!-- Bullet the meaningful changes. Keep the diff scoped to the task. -->

## Definition of Done

<!-- Mirrors .agent/SOP/definition_of_done.md §5 — check what you actually ran; call out anything skipped and why. -->

- [ ] `bun run verify:full` green (prisma generate · lint ratchet · typecheck · unit · nutrition eval · build)
- [ ] Conditional gates for touched areas run (schema migration / i18n en·es·pl / security invariants / payments / e2e): <!-- list or n/a -->
- [ ] Tests added or extended (regression test if this fixes a bug)
- [ ] Docs updated (.agent System/SOP/Tasks + README index / ADR) — or n/a
- [ ] Traceability: Linear issue referenced
- [ ] Diff clean: no debug artifacts, no unrelated refactors, generated files regenerated not hand-edited
- [ ] Honest report: real gate output included below, review-only items flagged as such

## Verification evidence

<!-- Paste the tail of the real gate output (test counts, exit status). Unverified work is not done.
     Review-only criteria (security invariants, docs, traceability) are judgement calls — say so
     rather than presenting them as passing gates. -->

```
```

## Notes for reviewers

<!-- Risks, rollback path if this needs a rollout SOP, follow-ups filed in Linear. -->
