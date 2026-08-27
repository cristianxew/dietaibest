# SOP — Definition of Done & Quality Gates

**Last Updated:** 2026-08-27
**Purpose:** The operational checklist every change must pass before it is declared complete, a PR is opened, or work is reported as finished. This is the enforcement arm of the [Engineering Quality Standards](../System/engineering_standards.md).

A change that has not passed these gates is **in progress**, not done — no matter how much code exists.

---

## 1. Always-on gates (every change)

Run from the repo root:

```bash
bun run verify
```

`verify` runs, in order, failing fast:

| # | Gate | Standalone command | Catches |
|---|---|---|---|
| 1 | Prisma client generation | `bunx prisma generate` | Stale/missing generated client |
| 2 | Lint | `bun run lint` | Style, React/hooks misuse, dead imports |
| 3 | Typecheck | `bun run typecheck` (`tsc --noEmit`, strict) | Type errors the build would also reject |
| 4 | Unit tests | `bun run test:unit` | Behavior regressions |
| 5 | Nutrition eval | `bun run test:eval:nutrition` | Golden-recipe nutrition drift (deterministic, no network) |

All five must exit 0. Lint warnings in files you touched should be fixed, not accumulated — the `warn` severity exists for legacy code, not new code.

## 2. Conditional gates (based on what you touched)

Check your diff (`git diff --stat main...HEAD`) against this table and run every row that matches:

| If you touched… | Additional gate |
|---|---|
| `prisma/schema.prisma` | Migration created via `bunx prisma migrate dev --name <desc>` and committed (never `db push` for shared envs). Update [database_schema.md](../System/database_schema.md). Consider backfill + rollback (see [url-import-dedup-rollout.md](./url-import-dedup-rollout.md) as the reference). |
| User-facing text / UI components | Strings via next-intl keys present in **all** of `messages/en.json`, `messages/es.json`, `messages/pl.json` (no hardcoded copy). Run the i18n parity unit test; the `ui-translation-validator` agent can verify. |
| `src/actions/`, `src/app/api/`, auth, middleware, visibility/sharing | Walk the [security invariants](../System/engineering_standards.md#repo-security-invariants) explicitly: `serverAction` runtime, ownership re-check, Zod at the boundary, no email exposure, explicit public routes. |
| Nutrition pipeline (`src/lib/nutrition/`, `src/lib/nutrients/`, unit registry, canonicalizer) | Extend/adjust the golden-recipe eval when behavior intentionally changes ([nutrition_units.md](../System/nutrition_units.md)); for engine rollouts, the live eval per [nutrition-llm-rollout.md](./nutrition-llm-rollout.md). |
| Chat agent (tools, prompt, guardrails) | Tool schema + guardrail tests in `tests/unit/chat/`; respect the no-execute contract and [ADR 0001](../../docs/adr/0001-system-prompt-is-sole-medical-refusal-classifier.md) (refusal eval). |
| `package.json` deps, `next.config.ts`, `Dockerfile`, build tooling | `bun run build` locally. For new/bumped deps: `bun audit` — do not introduce known critical/high advisories. |
| Payments / entitlements | Stripe flows covered by unit tests; webhook signature verification untouched or re-tested; idempotency preserved. |
| Critical user journeys (auth, recipe create/import, meal plan) | Relevant `e2e/` specs still pass: `bun run e2e` (needs a running env — see [TESTING.md](../../TESTING.md)). |

## 3. Non-code completion criteria

- [ ] **Tests added** for new behavior; **regression test** added for any bug fixed.
- [ ] **Docs updated**: relevant `.agent/System/` or `.agent/SOP/` docs, plus the [.agent/README.md](../README.md) index if files were added. Architectural decisions → new ADR in `docs/adr/`.
- [ ] **Traceability**: Linear issue referenced (project "Dietai desktop"); PRD in `.agent/Tasks/` updated if scope changed.
- [ ] **Diff hygiene**: no debug artifacts (`console.log`, commented-out code, dead files), no drive-by refactors outside the task, generated files regenerated (not hand-edited).
- [ ] **Honest report**: the completion message/PR states which gates ran and their real results. Anything skipped or failing is called out explicitly, never implied green.

## 4. When a gate fails

1. **Fix the root cause.** Never skip/disable the failing test, loosen the rule, or silence the error to pass (see [Prohibited shortcuts](../System/engineering_standards.md#prohibited-shortcuts)).
2. A test that fails intermittently is a **defect**: root-cause it or file a Linear issue with the failure output — do not delete or retry-loop it into green.
3. If the failure is pre-existing on `main` (not caused by your change), do not hide it and do not silently fix the world: state it in the PR, file an issue, and keep your diff scoped.
4. If you believe the gate itself is wrong (over-strict rule, outdated golden fixture), changing the gate is its **own reviewed change** with justification — never a side-effect of a feature PR.

## 5. Copy-paste checklist for PRs / completion reports

```markdown
### Definition of Done
- [ ] `bun run verify` green (lint · typecheck · unit · nutrition eval)
- [ ] Conditional gates for touched areas run (schema / i18n / security / build / e2e): …
- [ ] Tests added or extended (regression test if bug fix)
- [ ] Security invariants walked (if server boundary touched)
- [ ] Docs updated (.agent System/SOP/Tasks + README index / ADR)
- [ ] Diff clean: no debug artifacts, no unrelated changes
- [ ] Honest report: real gate output included
```

The `/quality-gates` skill automates sections 1–2 and renders this table.

---

## Related docs

- [Engineering Quality Standards](../System/engineering_standards.md) — why these gates exist, standards mapping
- [TESTING.md](../../TESTING.md) — how to write and run each test level
- [Server Action Runtime SOP](./server-action-runtime.md) — the secure action pattern the security gate expects
- [.github/pull_request_template.md](../../.github/pull_request_template.md) — the PR-side mirror of this checklist
