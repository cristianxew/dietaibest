# ADR 0005 — Binding quality gates for agent-authored changes

**Status:** Accepted
**Date:** 2026-09-01
**Supersedes:** nothing
**Related:** `.agent/System/engineering_standards.md`, `.agent/SOP/definition_of_done.md`

## Context

Most changes in this repository are now authored by AI agents. Agents produce plausible code very quickly, and the failure mode is specific: **volume of output gets mistaken for completed engineering.** Code that compiles and reads well can still be untested, insecure, untranslated, undocumented, and untraceable — and an agent will report it as done because nothing contradicted it.

The industry already encodes what "done" means: ISO/IEC 25010 (product quality), ISO/IEC/IEEE 12207 (life cycle), ISO/IEC 29119 (testing), ISO 27001 / OWASP / NIST SSDF (security), CMMI and DevSecOps practice. Citing those frameworks in a document, however, changes nothing on its own. A standard that is not wired into a command or a CI job is a wish.

The first attempt at this (commit `47cdc15`) demonstrated the point against itself. It documented gates in prose, and a review found that several of them did not exist or did not work:

- a documented "Integration" test level pointing at a `tests/integration/` directory that is not in the repo;
- a "live eval, real APIs" command that mocks its repositories and touches no network;
- a claim that `bun run verify` mirrored the blocking CI gates, when it omitted `build`;
- an "i18n parity test" that covered 3 of 20 namespaces, while `es.json` and `pl.json` were already missing keys;
- an e2e gate for "auth, recipe create/import" journeys that have no e2e specs;
- a "report-only" audit CI job that, because `continue-on-error` was set at job level, reported a failing check on every commit;
- a "no new lint warnings" rule with no mechanism, since `next lint` exits 0 regardless of warning count.

Every one of those would have let an agent report a green Definition of Done over unverified work.

## Decision

**A rule is only adopted here if it is mechanized, or explicitly labelled as honor-system.**

1. `.agent/System/engineering_standards.md` is the single source of truth for the rules. `CLAUDE.md` carries a short summary for agents that never open it; `.agent/rules/agent.md` carries a pointer. Neither forks the wording.
2. The blocking gate surface is two CI jobs — **Verify** and **Build** — and their exact local equivalent is `bun run verify:full`. The Verify job *invokes* `bun run verify` rather than re-listing its steps, so the local and CI definitions cannot drift.
3. Rules asserted as non-negotiable get a mechanism where one is affordable:
   - lint warnings → `scripts/lint-ratchet.mjs` fails above `.lint-baseline.json` (tolerates the legacy backlog, blocks new warnings);
   - i18n parity → `tests/unit/i18n-parity.test.ts` walks every namespace in all three locales;
   - types, tests, build → already blocking.
4. Rules with no affordable mechanism (security-invariant review, ADR discipline, doc freshness, traceability, absence of debug artifacts) are listed in an **enforcement status table** and must never be reported as passing gates.
5. Documented coverage gaps are stated plainly rather than implied away: no integration suite, e2e covers chat only, no coverage thresholds.
6. The dependency audit is advisory (failure swallowed at step level so the check stays green), and becomes blocking once the backlog reaches zero critical/high or an allowlist of known advisory IDs is committed.

## Consequences

**Positive.** `bun run verify:full` is a true statement about what CI will do. Two rules that were prose became executable gates, and the i18n one immediately found and fixed five missing Spanish/Polish keys. Agents get an enforcement table that tells them which claims they may make. CI dropped from six jobs to three, with Bun pinned and the dependency cache shared.

**Negative / accepted costs.** The lint ratchet is a count-based baseline, so it can be defeated by an `eslint-disable` that removes a warning rather than fixing it — the honest limit is recorded in the enforcement table. The advisory audit surfaces risk without blocking it. `verify:full` is slower than `verify` (it includes `next build`), which is why the fast loop is kept for iteration.

**Open.** Close the coverage gaps (auth/recipe e2e specs, an integration level if cross-module flows warrant one), burn down the advisory backlog until the audit job can block, and add mechanisms for the honor-system rows where a cheap one exists (`no-console` for `src/`, coverage thresholds).
