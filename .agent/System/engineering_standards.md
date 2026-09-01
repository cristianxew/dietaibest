# Engineering Quality Standards

**Last Updated:** 2026-09-01
**Status:** Binding for every contributor — human or AI agent. This document is part of the agent operating instructions, not background reading.

**This file is the single source of truth for these rules.** `CLAUDE.md` carries a short summary for agents that never open this file, and `.agent/rules/agent.md` points here. When a rule changes, change it *here* — do not fork the wording into the other two.

---

## Why this document exists

Generating code is not the same as engineering software. An LLM can produce thousands of plausible lines per minute; none of that is a deliverable until it is **verified, secure, maintainable, documented, and traceable**. The industry has spent decades encoding what "quality" means — ISO/IEC 25010 (product quality), ISO/IEC/IEEE 12207 (life cycle), ISO/IEC 29119 (testing), ISO 27001 (security management), OWASP, NIST SSDF (SP 800-218), CMMI, DevSecOps. This document translates those frameworks into the **concrete, checkable practices of this repository**, so that every change is built to them by default.

> The token produces code. Engineering produces software that survives production.

We do not claim certification against any of these standards. We adopt their practices and make them enforceable here.

---

## Non-negotiables (summary)

1. **A change is complete only when it meets the [Definition of Done](../SOP/definition_of_done.md).** `bun run verify:full` green (the two blocking CI jobs), plus the conditional gates for what you touched. "The code is written" is not a completion state.
2. **Never weaken a gate to get green.** No skipping, disabling, or deleting tests; no `any` / `@ts-expect-error` / `eslint-disable` to silence an error you should fix; no loosening tsconfig or lint rules; no lowering eval thresholds. If a gate is genuinely wrong, fix the gate in its own reviewed change and say why.
3. **Every behavior change ships with tests.** Every fixed bug ships with a regression test. Every architectural decision gets an ADR in `docs/adr/`.
4. **The [security invariants](#repo-security-invariants) hold at every server boundary.** No exceptions for "internal" or "temporary" code.
5. **Docs are part of the change.** A feature that leaves `.agent/` docs stale is unfinished (see [CLAUDE.md](../../CLAUDE.md) and `/update_doc`).
6. **Honesty over green.** If something is failing, flaky, or out of scope, state it explicitly in the PR. Never present unverified work as verified.

---

## ISO/IEC 25010 — Product quality model

The eight quality characteristics, mapped to what they mean in DietAI and where each is enforced:

| Characteristic | What it means in DietAI | Enforced by |
|---|---|---|
| **Functional suitability** | Features do what their PRD says; nutrition math is correct against golden data | Unit tests (`tests/unit/`), golden-recipe eval (`tests/eval/nutrition/`), PRDs in `.agent/Tasks/` |
| **Reliability** | Honest-status contract (never silently zero a no-match), graceful degradation on LLM/FDC outage, every rollout SOP has a rollback | Coverage-chain rules in [CONTEXT.md](../../CONTEXT.md), rollback sections in `.agent/SOP/*-rollout.md` |
| **Security** | See [Security](#security--iso-27001-owasp-nist-ssdf) below | `serverAction` runtime, ownership checks, Zod boundaries, CI dependency audit |
| **Performance efficiency** | Cache layers (`FdcCache`, `IngredientNameCache`, `RecipeAnalysisCache`), batched LLM calls, indexed queries, no N+1 | [Database Schema — Indexes](./database_schema.md), batched Stage 1/Stage 2 design (ADR 0003/0004) |
| **Usability** | Complete i18n (en/es/pl), accessible components (roles/labels), dark mode, mobile/PWA | `tests/unit/i18n-parity.test.ts` (all namespaces), `ui-translation-validator` agent, [Design System](./design_system.md) |
| **Maintainability** | Strict TypeScript, explicit seams (Resolve/Compute, `LlmProvider`, `ConversationStore`), current docs, small focused modules | `bun run typecheck` gate, lint gate, `.agent/` doc discipline |
| **Compatibility** | Works across browsers, PWA offline behavior, standalone Docker output | Build gate, e2e suite (`e2e/`), [PWA Implementation](./pwa_implementation.md) |
| **Portability** | Reproducible Docker/Dokploy deployment; env-driven config only | `Dockerfile`, [Deployment Guide](../Tasks/deployment.md), `.env.example` discipline |

When reviewing or designing a change, ask which characteristics it touches and point to the corresponding gate or doc. "It compiles" only covers a sliver of one row.

---

## ISO/IEC/IEEE 12207 — Life cycle processes

Software is a life cycle, not a code dump. Each 12207 process group has a concrete home in this repo:

| Life cycle process | Where it lives here |
|---|---|
| Stakeholder needs & requirements | Linear issue (project "Dietai desktop") + PRD in `.agent/Tasks/` |
| Architecture definition | ADR in `docs/adr/` (numbered, immutable once accepted) + domain language in [CONTEXT.md](../../CONTEXT.md) |
| Design & implementation | Feature branch; patterns from `.agent/System/` docs and `.agent/SOP/` procedures |
| Verification (did we build it right?) | Quality gates: `bun run verify:full` + conditional gates + CI (`.github/workflows/ci.yml`) |
| Validation (did we build the right thing?) | Smoke tests defined in each rollout SOP; PRD acceptance criteria |
| Transition (deployment) | [Deployment Guide](../Tasks/deployment.md) + per-feature rollout SOPs (each with pre-flight, smoke test, rollback) |
| Operation & maintenance | Monitoring notes in rollout SOPs; incidents feed back into SOPs ("mistakes we made") |
| Configuration management | Git; `bun install --frozen-lockfile`; schema changes only via committed Prisma migrations |

**Traceability rule:** any non-trivial change should be walkable in both directions — Linear issue ↔ PR ↔ ADR (if architectural) ↔ updated `.agent/` docs. If a reviewer cannot reconstruct *why* a change exists from the repo alone, the change is missing an artifact.

---

## ISO/IEC 29119 — Testing

Testing here is risk-based, layered, and documented. [TESTING.md](../../TESTING.md) covers mechanics; this section is policy.

### Test policy (what MUST be tested)

Highest-risk areas, in order — these never ship untested:

1. **Nutrition math** (`src/lib/nutrition/`, `src/lib/nutrients/`) — users make health decisions on these numbers. Deterministic golden-recipe eval + unit tests.
2. **Auth, ownership & privacy boundaries** — `viewerIsOwner`, public/private visibility, the email-privacy invariant.
3. **Money** — Stripe checkout, entitlements, webhooks.
4. **Data migrations & backfills** — anything touching existing user data.
5. **LLM tool contracts** — tool schemas, the no-execute contract, refusal guardrails (`tests/unit/chat/`).

### Test levels

| Level | Location | Command | Required when |
|---|---|---|---|
| Unit | `tests/unit/` | `bun run test:unit` | Always (part of `verify` and CI) |
| Golden-recipe eval — deterministic replay over recorded FDC/LLM fixtures, **no network** | `tests/eval/nutrition/` | `bun run test:eval:nutrition` | Always in CI; extend it when changing nutrition-calc behavior. Includes `golden-recipes-real.test.ts`, which despite its name is a fixture replay, not a live run |
| End-to-end | `e2e/` | `bun run e2e` | Critical user journeys — **but see the coverage gap below before relying on it** |
| Fixture recording — genuinely live, hits USDA FDC + Vertex | `tests/eval/nutrition/record-fixtures.test.ts` | `bun run eval:nutrition:record` (needs `FDC_API_KEY` + Vertex auth) | Refreshing golden fixtures; the only nutrition command that exercises the real APIs |
| Medical-refusal eval — live model call, opt-in | `tests/eval/medical-refusal.test.ts` | `bun run test:eval:refusal` (needs `ANTHROPIC_API_KEY`) | Changing the chat system prompt or refusal guardrails ([ADR 0001](../../docs/adr/0001-system-prompt-is-sole-medical-refusal-classifier.md)) |

### Known coverage gaps

Naming a gate that does not exist is worse than admitting the gap, because it converts an unknown into a false pass. Current gaps, to be closed rather than papered over:

- **No integration level.** There is no `tests/integration/` suite. Cross-module flows are covered by unit tests with mocked seams, or not at all.
- **E2E covers chat only.** `e2e/` holds three chat specs. There is **no** auth, recipe-create, or recipe-import e2e spec, so `bun run e2e` passing says nothing about those journeys.
- **No coverage thresholds.** `vitest.config.mts` sets none, so "every behavior change ships with tests" is a review judgement, not a measured gate.

### Testing rules

- **Every fixed bug gets a regression test** that fails on the old code. No test, no fix.
- **A flaky test is a defect**, not noise. Root-cause it or track it as an issue — never delete or `skip` it to pass a gate.
- **Test behavior, not implementation** (see TESTING.md best practices).
- New pure logic (parsers, resolvers, aggregation, scoring) is designed to be unit-testable: pure modules with explicit interfaces — the Resolve/Compute seam in CONTEXT.md is the model.

---

## Security — ISO 27001, OWASP, NIST SSDF

ISO 27001's core demand is that security be **systematic, not ad-hoc**: known controls, applied every time, with evidence. Here that means the invariants below are checked on every change that touches a server boundary — they are review checklist items, not aspirations.

### Repo security invariants

1. **Every gated server action goes through the `serverAction` runtime** (auth + Zod validation + entitlement + error contract). See [Server Action Runtime SOP](../SOP/server-action-runtime.md). New actions never hand-roll auth.
2. **Ownership is re-checked server-side on every resource access** (`viewerIsOwner` pattern). Client-supplied IDs, flags, or prices are never trusted.
3. **Public exposure is explicit and minimal.** A route is public only via `isPublic` + the middleware public-prefix list. Private records must never surface in public payloads (e.g. the dedup-preview privacy boundary). **User emails are never exposed** — author identity only via `getAuthorName` / `displayName`.
4. **All external input is Zod-validated at the boundary**: server actions, API routes, webhooks, chat tool arguments, imported/scraped recipe content.
5. **LLM output is untrusted input.** Schema-validate every model response before use. Chat tools follow the no-execute contract ([Chat Agent](./chat_agent.md)); fetched web/recipe content must never be able to redirect the agent's tools (prompt-injection posture). Entitlement filtering happens at the tool registry, not in the prompt.
6. **Secrets live only in environment variables.** Never committed, never logged, never `NEXT_PUBLIC_*` unless genuinely public. New vars are added to `.env.example` as placeholders and documented in the deployment guide.
7. **Database access goes through Prisma.** Raw SQL only as tagged-template `$queryRaw`, and it gets explicit review.
8. **Uploads are constrained** (content-type, size) and stored per the [storage-bucket SOP](../SOP/supabase-storage-bucket-chat-recipe-media.md).
9. **Payment webhooks verify signatures**; money-state transitions are idempotent.
10. **Dependency changes are deliberate.** Run `bun audit` when adding or bumping dependencies; prefer maintained, widely-used packages on security-relevant paths.

### OWASP Top 10 → this stack

| OWASP (2021) | Primary defense here |
|---|---|
| A01 Broken access control | Invariants 1–3 (`serverAction`, `viewerIsOwner`, explicit public routes) |
| A02 Cryptographic failures | Sessions via NextAuth + Supabase Auth; no homemade crypto; secrets per invariant 6 |
| A03 Injection | Zod at boundaries + Prisma parameterized queries (invariants 4, 7) |
| A05 Security misconfiguration | Env-driven config, `.env.example` as the contract, deployment SOP security checklist |
| A06 Vulnerable components | Frozen lockfile + `bun audit` CI job (report-only for now — see below) |
| A07 Auth failures | Auth flows per [auth-email-links SOP](../SOP/auth-email-links.md); NextAuth is the session of record |
| A08 Software & data integrity | `--frozen-lockfile` in CI, reviewed migrations, signed webhooks |
| A09 Logging & monitoring failures | Server-side logging without PII/secrets; rollout SOPs define what to monitor |
| A10 SSRF | URL imports go through Supadata (not arbitrary server-side fetch); validate/canonicalize URLs |

**OWASP LLM Top 10** applies too, because this app ships an agent: prompt injection (invariant 5), insecure output handling (schema-validate, never render raw model HTML), excessive agency (no-execute tool contract, entitlement-filtered registry), and the medical-refusal boundary ([ADR 0001](../../docs/adr/0001-system-prompt-is-sole-medical-refusal-classifier.md) + refusal eval).

### NIST SSDF (SP 800-218) practice groups

| Group | How we practice it |
|---|---|
| **PO** — Prepare the Organization | This document + SOPs define the secure-development process and toolchain for all contributors, agents included |
| **PS** — Protect the Software | Git history integrity, frozen lockfile, branch-per-change, reviewed merges |
| **PW** — Produce Well-Secured Software | Security invariants, secure defaults (`serverAction`), quality gates before merge, code review |
| **RV** — Respond to Vulnerabilities | `bun audit` surfacing in CI, remediation via issues, incidents feed SOP updates |

**Current known debt:** the dependency tree carries a substantial advisory backlog (heavily `jspdf`), so the CI audit job is **advisory, not blocking**. The live count is the `Dependency Audit` job summary on any recent CI run — read it there rather than trusting a number transcribed into this doc, which drifts within days of being written.

**Policy:** do not add or bump a dependency that introduces a new critical/high advisory. The job becomes blocking once the backlog reaches zero critical/high, or once an allowlist of the known advisory IDs is committed so that anything outside it fails the build. Until one of those lands, this control is *surfaced* but not *enforced* — see the enforcement table below.

---

## DevSecOps & process maturity (CMMI-informed)

Quality and security are wired into the pipeline, not inspected in afterwards.

### CI gates (`.github/workflows/ci.yml`)

| Job | Command | Blocking |
|---|---|---|
| Verify | `bun run verify` (prisma generate → lint ratchet → typecheck → unit → nutrition eval) | ✅ |
| Build | `bunx prisma generate && bun run build` | ✅ |
| Dependency Audit | `bun audit` | ⬜ advisory — swallowed at step level so the check stays green (see debt above) |

The Verify job **invokes `bun run verify` itself** rather than re-listing its steps, so the local gate and the CI gate cannot drift apart: changing the script changes both. The two blocking jobs together are exactly **`bun run verify:full`** (`verify` + `build`) — that is the command to run before declaring a change done. Use the faster `bun run verify` while iterating; `next build` catches a class of error (`useSearchParams` without Suspense, server/client boundary violations, invalid route exports) that `tsc --noEmit` accepts.

### Enforcement status — what is mechanized vs. honor-system

Presenting a review convention as if it were a gate is how a quality regime rots. This table says plainly which rules a machine will catch:

| Rule | Status |
|---|---|
| Type errors | ✅ enforced — `tsc --noEmit`, `strict: true`, blocking in CI |
| Test regressions (unit + nutrition eval) | ✅ enforced — blocking in CI |
| Build breakage | ✅ enforced — blocking in CI |
| New lint warnings (incl. new `any`) | ✅ enforced — `lint:ratchet` fails above the `.lint-baseline.json` count; covers `src/`, `tests/`, `e2e/`, `scripts/` |
| i18n en/es/pl key parity | ✅ enforced — `tests/unit/i18n-parity.test.ts` walks every namespace |
| Dependency advisories | ⬜ surfaced only — advisory CI job, no threshold yet |
| `eslint-disable` / `@ts-expect-error` used to silence | ⬜ honor-system — the ratchet catches added *warnings*, not suppressions that remove them |
| `console.log` and debug artifacts | ⬜ honor-system — no `no-console` rule; `src/` already carries dozens |
| Tests accompany every behavior change | ⬜ honor-system — no coverage threshold |
| ADR written for architectural decisions | ⬜ honor-system — review only |
| Security invariants walked | ⬜ honor-system — review only |
| Docs updated / traceability | ⬜ honor-system — review only |

An honor-system rule is not a weaker rule; it is one whose only enforcement is the reviewer and the agent's own discipline. Closing these gaps with real mechanisms is ongoing work, and each closure belongs in its own reviewed change.

### Release discipline

Every rollout SOP must contain: **pre-flight checks → deploy steps → smoke test → what to monitor → one-line rollback**. A feature without a rollback path is not ready for production (see `nutrition-llm-rollout.md` and `url-import-dedup-rollout.md` as the reference shape).

### Maturity loop

We run the CMMI discipline without claiming a level: processes are **defined** (SOPs, this doc), **measured** (CI, deterministic evals, test counts), and **improved** (every incident or mistake updates the relevant SOP — that is what `.agent/SOP/` is for). When you make a mistake an SOP could have prevented, updating the SOP is part of the fix.

---

## Prohibited shortcuts

These are the "burning tokens" anti-patterns. Any of them makes a change incomplete regardless of how much code was produced:

- Declaring work done without running the gates, or reporting gates as passed without running them.
- Skipping, disabling, deleting, or loosening a test, lint rule, type rule, or eval threshold to get green.
- `any`, `@ts-expect-error`, `@ts-ignore`, or `eslint-disable` used to silence an error instead of fixing it. New code targets zero new lint warnings — the `warn` severities exist for the legacy backlog, not as a budget, and `lint:ratchet` enforces that by failing when the count rises above `.lint-baseline.json`. Raising the baseline to get green is itself a prohibited shortcut.
- Leaving debugging artifacts: `console.log` noise, commented-out blocks, dead code, unused exports.
- Duplicating logic that already exists as a utility/seam instead of reusing it (check `src/lib/` first).
- Hand-editing generated files (`src/generated/`, lockfiles, Prisma client) instead of regenerating with the tool.
- Schema changes without a committed migration, or migrations without a rollback consideration.
- Widening a diff beyond the task ("drive-by refactors") without agreement — big diffs hide defects.
- Shipping user-facing text hardcoded in one language instead of next-intl keys in all locales (en/es/pl).
- Leaving `.agent/` docs, `README` index, or the PRD stale after the implementation changed.

---

## Related docs

- [Definition of Done SOP](../SOP/definition_of_done.md) — the operational checklist and exact commands
- [CLAUDE.md](../../CLAUDE.md) — agent harness entry point (points here)
- [TESTING.md](../../TESTING.md) — testing mechanics and examples
- [Project Architecture](./project_architecture.md) — system overview
- [CONTEXT.md](../../CONTEXT.md) + [docs/adr/](../../docs/adr/) — domain language and decisions
- [Server Action Runtime SOP](../SOP/server-action-runtime.md) — the secure-by-default action pattern
- [Deployment Guide](../Tasks/deployment.md) — production transition
