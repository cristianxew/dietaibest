---
name: quality-gates
description: Run the DietAI Definition of Done quality gates (lint, typecheck, unit tests, nutrition eval, plus conditional gates based on the diff) and report a pass/fail verdict. Use before declaring any implementation done, before opening a PR, or when asked to verify a change meets the project's engineering standards (ISO 25010 / 29119 / OWASP / NIST SSDF as mapped in .agent/System/engineering_standards.md).
---

# Quality Gates — Definition of Done verification

You are enforcing this repo's Definition of Done (`.agent/SOP/definition_of_done.md`), which operationalizes `.agent/System/engineering_standards.md`. Your job is to produce an **honest verdict**, not a green report.

## Steps

1. **Scope the change.** Run `git status --short` and `git diff --stat main...HEAD` (fall back to `git diff --stat HEAD` for uncommitted work) to see which areas are touched.

2. **Run the always-on gates**, individually so each result is attributable:

   ```bash
   bunx prisma generate
   bun run lint
   bun run typecheck
   bun run test:unit
   bun run test:eval:nutrition
   ```

   (Equivalent to `bun run verify`, but per-gate reporting is clearer.)

3. **Determine conditional gates** from the diff and run the ones that apply (full table in the SOP):
   - `prisma/schema.prisma` → committed migration exists under `prisma/migrations/`; `database_schema.md` updated.
   - UI text / components → i18n keys present in `messages/en.json`, `es.json`, `pl.json`; i18n parity test passes.
   - `src/actions/`, `src/app/api/`, auth/middleware/visibility → walk the security invariants (engineering_standards.md §Repo security invariants) against the diff, item by item.
   - Nutrition pipeline → golden eval extended if behavior intentionally changed.
   - `package.json` / `next.config.ts` / `Dockerfile` → `bun run build`; for dep changes also `bun audit` (no new critical/high).
   - Chat agent → `tests/unit/chat/` guardrail tests.

4. **Check non-code criteria** against the diff: tests added for new behavior, regression test for bug fixes, `.agent/` docs + README index updated, no debug artifacts or unrelated changes in the diff.

5. **Report** a table: gate | command | result (✅/❌/⏭ n/a with reason), followed by the verdict:
   - All applicable gates ✅ → state the change meets the Definition of Done.
   - Anything ❌ → the change is **NOT done**. List each failure with its actual output excerpt and the fix path. Do not soften this.

## Hard rules

- Never fix a failure by skipping/disabling a test, loosening a rule, adding `any`/`@ts-expect-error`/`eslint-disable`, or lowering an eval threshold. Fix root causes; gate changes are their own reviewed change.
- Never report a gate as passed without having run it in this session.
- Pre-existing failures on `main` are reported as such (verify by stashing or checking `main`) — distinguished from failures introduced by the change, and never hidden.
- Lint warnings in touched files count against the verdict; legacy warnings elsewhere are noted, not fixed drive-by.
