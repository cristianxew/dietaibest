# SOP — Definition of Done & Quality Gates

**Last Updated:** 2026-09-01
**Purpose:** The operational checklist every change must pass before it is declared complete, a PR is opened, or work is reported as finished. This is the enforcement arm of the [Engineering Quality Standards](../System/engineering_standards.md), which is the source of truth for the rules themselves.

A change that has not passed these gates is **in progress**, not done — no matter how much code exists.

---

## 1. Always-on gates (every change)

Run from the repo root:

```bash
bun run verify        # fast loop, while iterating
bun run verify:full   # verify + build — required before declaring done
```

`verify` runs, in order, failing fast:

| # | Gate | Standalone command | Catches |
|---|---|---|---|
| 1 | Prisma client generation | `bunx prisma generate` | Stale/missing generated client (`src/generated/` is gitignored) |
| 2 | Lint ratchet | `bun run lint:ratchet` | Lint errors, and any rise in warning count above `.lint-baseline.json` |
| 3 | Typecheck | `bun run typecheck` (`tsc --noEmit`, strict) | Type errors across `src/`, `tests/`, `e2e/`, `scripts/` |
| 4 | Unit tests | `bun run test:unit` | Behavior regressions, i18n en/es/pl parity |
| 5 | Nutrition eval | `bun run test:eval:nutrition` | Golden-recipe nutrition drift (deterministic replay, no network) |

`verify:full` adds:

| # | Gate | Standalone command | Catches |
|---|---|---|---|
| 6 | Build | `bun run build` | `useSearchParams` without Suspense, server/client boundary violations, invalid route exports — errors `tsc` accepts but `next build` rejects |

Gates 1–5 are the CI **Verify** job (which literally runs `bun run verify`); gate 6 is the CI **Build** job. Both block. `bun run verify:full` is therefore the exact local equivalent of the blocking CI surface.

**On the lint ratchet:** it fails when the warning count rises above the committed baseline, so the legacy backlog stays tolerated while new warnings block. Fix the warnings your change introduced. Raising the baseline to get green is a prohibited shortcut; lowering it after genuinely fixing warnings (`bun run lint:ratchet -- --update`) is encouraged.

## 2. Conditional gates (based on what you touched)

Scope your diff first — prefer the first command that yields output, because `git diff main...HEAD` alone is empty for uncommitted work and for commits made on `main`, and fails outright on a shallow clone with no local `main`:

```bash
git status --porcelain
git fetch origin main --quiet 2>/dev/null || true
git diff --stat "$(git merge-base origin/main HEAD 2>/dev/null || git merge-base main HEAD 2>/dev/null)" HEAD
```

Then run every row that matches:

| If you touched… | Additional gate |
|---|---|
| `prisma/schema.prisma` | Migration created via `bunx prisma migrate dev --name <desc>` and committed (never `db push` for shared envs). Update [database_schema.md](../System/database_schema.md). Consider backfill + rollback (see [url-import-dedup-rollout.md](./url-import-dedup-rollout.md) as the reference). |
| User-facing text / UI components | Strings via next-intl keys in all of `messages/en.json`, `es.json`, `pl.json`. `tests/unit/i18n-parity.test.ts` enforces full-catalog parity and runs inside `test:unit` — if it fails, add the missing translations rather than deleting the English key. The `ui-translation-validator` agent additionally checks for hardcoded strings. |
| `src/actions/`, `src/app/api/`, auth, middleware, visibility/sharing | Walk the [security invariants](../System/engineering_standards.md#repo-security-invariants) explicitly: `serverAction` runtime, ownership re-check, Zod at the boundary, no email exposure, explicit public routes. **Review-only — no gate enforces these.** |
| Nutrition pipeline (`src/lib/nutrition/`, `src/lib/nutrients/`, unit registry, canonicalizer) | Extend/adjust the golden-recipe eval when behavior intentionally changes ([nutrition_units.md](../System/nutrition_units.md)). To refresh fixtures against the real USDA/Vertex APIs: `bun run eval:nutrition:record` (needs `FDC_API_KEY` + Vertex auth). Note `test:eval:nutrition:real` is a fixture **replay**, not a live run. |
| Chat agent (tools, prompt, guardrails) | Tool schema + guardrail tests in `tests/unit/chat/`; respect the no-execute contract. For system-prompt or refusal changes, run the live refusal eval: `bun run test:eval:refusal` (needs `ANTHROPIC_API_KEY`) — see [ADR 0001](../../docs/adr/0001-system-prompt-is-sole-medical-refusal-classifier.md). |
| `package.json` deps, `next.config.ts`, `Dockerfile`, build tooling | `bun run build` (already in `verify:full`). For new/bumped deps: `bun audit` — the tree carries a standing backlog, so compare against the pre-change output and do not introduce a **new** critical/high advisory. |
| Payments / entitlements | Stripe flows covered by unit tests; webhook signature verification untouched or re-tested; money-state transitions idempotent. Ranked #3 on the never-ship-untested list. |
| Critical user journeys (auth, recipe create/import, meal plan) | `bun run e2e` (needs a running env — see [TESTING.md](../../TESTING.md)). **Read the coverage gap first:** `e2e/` currently holds chat specs only — there is no auth or recipe-import spec, so a green e2e run says nothing about those journeys. Verify them manually and say so. |

## 3. Non-code completion criteria

- [ ] **Tests added** for new behavior; **regression test** added for any bug fixed.
- [ ] **Docs updated**: relevant `.agent/System/` or `.agent/SOP/` docs, plus the [.agent/README.md](../README.md) index if files were added. Architectural decisions → new ADR in `docs/adr/`.
- [ ] **Traceability**: Linear issue referenced (project "Dietai desktop"); PRD in `.agent/Tasks/` updated if scope changed.
- [ ] **Diff hygiene**: no debug artifacts (`console.log`, commented-out code, dead files), no drive-by refactors outside the task, generated files regenerated (not hand-edited).
- [ ] **Honest report**: the completion message/PR states which gates ran and their real results. Anything skipped or failing is called out explicitly, never implied green.

These five are **review-enforced, not machine-enforced** — see the [enforcement status table](../System/engineering_standards.md#enforcement-status--what-is-mechanized-vs-honor-system). Do not report them as if a gate had verified them.

## 4. When a gate fails

1. **Fix the root cause.** Never skip/disable the failing test, loosen the rule, raise the lint baseline, or silence the error to pass (see [Prohibited shortcuts](../System/engineering_standards.md#prohibited-shortcuts)).
2. A test that fails intermittently is a **defect**: root-cause it or file a Linear issue with the failure output — do not delete or retry-loop it into green.
3. If the failure is pre-existing on the base branch (not caused by your change), do not hide it and do not silently fix the world: state it in the PR, file an issue, and keep your diff scoped. Establish "pre-existing" with a separate `git worktree`, or from CI on that branch — never by stashing the user's working tree.
4. If you believe the gate itself is wrong (over-strict rule, outdated golden fixture, a documented gate that does not exist), changing the gate is its **own reviewed change** with justification — never a side-effect of a feature PR.

## 5. Copy-paste checklist for PRs / completion reports

This block is mirrored in [.github/pull_request_template.md](../../.github/pull_request_template.md) — keep the two identical when editing either.

```markdown
### Definition of Done
- [ ] `bun run verify:full` green (prisma generate · lint ratchet · typecheck · unit · nutrition eval · build)
- [ ] Conditional gates for touched areas run (schema migration / i18n en·es·pl / security invariants / payments / e2e): …
- [ ] Tests added or extended (regression test if bug fix)
- [ ] Docs updated (.agent System/SOP/Tasks + README index / ADR)
- [ ] Traceability: Linear issue referenced
- [ ] Diff clean: no debug artifacts, no unrelated changes
- [ ] Honest report: real gate output included, review-only items flagged as such
```

The `/quality-gates` skill runs §1, applies §2 from this file's table, and assesses §3 from the diff.

---

## Related docs

- [Engineering Quality Standards](../System/engineering_standards.md) — why these gates exist, standards mapping, enforcement status
- [TESTING.md](../../TESTING.md) — how to write and run each test level
- [Server Action Runtime SOP](./server-action-runtime.md) — the secure action pattern the security gate expects
- [.github/pull_request_template.md](../../.github/pull_request_template.md) — the PR-side mirror of §5
