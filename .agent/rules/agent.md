---
trigger: always_on
---

# Docs

We keep all important docs in the .agent folder and keep updating them, structure like bellow

.agent

- Tasks: PRD & implementation plan for each feature
- System: Document the current state of the system (project structure, tech stack, integration points, database schema, and core functionalities such as agent architecture, LLM layer, etc.)
- SOP: Best practices of execute certain tasks (e.g. how to add a schema migration, how to add a new page route, etc.)
- README.md: an index of all the documentations we have so people know what & where to look for things

We should always update agent docs after we implement certain feature, to make sure it fully reflect the up to date information

Before you plan any implementation, always read the .agent/README first to get context

# Engineering standards (non-negotiable)

We build to industry quality standards — ISO/IEC 25010, ISO/IEC/IEEE 12207, ISO/IEC 29119, ISO 27001 / OWASP / NIST SSDF, DevSecOps — as mapped to this repo in `.agent/System/engineering_standards.md`. Generating code is not the deliverable; verified, secure, documented, traceable software is.

- A change is complete only when it meets `.agent/SOP/definition_of_done.md`: `bun run verify` green (prisma generate · lint · typecheck · unit tests · nutrition eval) plus the conditional gates for what you touched (schema migration, i18n en/es/pl, security invariants, build, e2e).
- Report the real gate results before declaring work done; never report a gate you didn't run.
- Never weaken a gate to get green: no skipped/disabled/deleted tests, no `any`/`@ts-expect-error`/`eslint-disable` to silence errors, no loosened rules or eval thresholds.
- Every behavior change ships with tests (regression test for every bug fix); architectural decisions get an ADR in `docs/adr/`; server-boundary changes walk the security invariants.
- Docs are part of the change: stale `.agent/` docs = unfinished work.
