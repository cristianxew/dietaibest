---
name: quality-gates
description: Run the DietAI Definition of Done quality gates (lint ratchet, typecheck, unit tests, nutrition eval, plus conditional gates based on the diff) and report a pass/fail verdict. Use before declaring any implementation done, before opening a PR, or when asked to verify a change meets the project's engineering standards (ISO 25010 / 29119 / OWASP / NIST SSDF as mapped in .agent/System/engineering_standards.md).
---

# Quality Gates — Definition of Done verification

You are enforcing this repo's Definition of Done (`.agent/SOP/definition_of_done.md`), which operationalizes `.agent/System/engineering_standards.md`. Your job is to produce an **honest verdict**, not a green report.

Never mutate the working tree while verifying. In particular, do **not** `git stash` — a crashed gate or an ended turn would leave the user's uncommitted work parked in a stash they were never told about. To compare against the base branch, use `git worktree add` on a temp path, or read CI's result for that branch.

## Steps

1. **Scope the change.** Determine the touched files, preferring the first command that yields output:

   ```bash
   git status --porcelain                              # uncommitted work
   git fetch origin main --quiet 2>/dev/null || true
   git diff --stat "$(git merge-base origin/main HEAD 2>/dev/null || git merge-base main HEAD 2>/dev/null)" HEAD
   ```

   `git diff main...HEAD` alone is not sufficient: it is empty for uncommitted work and for commits made on `main` itself, and it fails outright on a shallow or single-branch clone where no local `main` exists. If you cannot establish a diff by any of these routes, say so and treat **every** conditional gate as applicable rather than silently skipping all of them.

2. **Run the always-on gates**, individually so each result is attributable:

   ```bash
   bunx prisma generate
   bun run lint:ratchet
   bun run typecheck
   bun run test:unit
   bun run test:eval:nutrition
   ```

   (Equivalent to `bun run verify`, but per-gate reporting is clearer.) `lint:ratchet` fails when the warning count rises above `.lint-baseline.json` — fix the new warnings; never raise the baseline to get green.

3. **Run the conditional gates.** Read the table in `.agent/SOP/definition_of_done.md` §2 and apply **every** row matching the diff — read it, do not work from memory, because it is the authoritative list and it changes. As of writing it covers schema/migrations, i18n, server boundaries and security invariants, the nutrition pipeline, the chat agent, dependencies and build, **payments/entitlements**, and **critical user journeys (e2e)**. If a row matches and you cannot run it, report it as ⏭ with the reason — never as ✅.

4. **Check non-code criteria** from §3 of the SOP against the diff: tests added for new behavior, regression test for bug fixes, `.agent/` docs and README index updated, ADR for architectural decisions, traceability (Linear issue), and diff hygiene.

5. **Report** a table: gate | command | result (✅/❌/⏭ with reason), then the verdict:
   - All applicable gates ✅ → the change meets the Definition of Done.
   - Anything ❌ → the change is **NOT done**. List each failure with its actual output excerpt and the fix path. Do not soften this.

   Distinguish clearly between gates that are **mechanized** (they ran and returned a real exit code) and criteria you **assessed by reading** the diff. The SOP's "Enforcement status" table says which is which; do not present a judgement call as a passing gate.

## Hard rules

- Never fix a failure by skipping/disabling a test, loosening a rule, adding `any`/`@ts-expect-error`/`@ts-ignore`/`eslint-disable`, or raising the lint baseline or an eval threshold. Fix root causes; gate changes are their own reviewed change.
- Never report a gate as passed without having run it in this session.
- Pre-existing failures on the base branch are reported as such — established via a separate worktree or CI, never by stashing — and distinguished from failures the change introduced. Never hidden.
- Lint warnings in touched files count against the verdict even when the ratchet passes overall; legacy warnings elsewhere are noted, not fixed drive-by.
