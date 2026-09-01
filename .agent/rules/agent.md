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

We build to industry quality standards — ISO/IEC 25010, ISO/IEC/IEEE 12207, ISO/IEC 29119, ISO 27001 / OWASP / NIST SSDF, DevSecOps. Generating code is not the deliverable; verified, secure, documented, traceable software is.

**The rules live in `.agent/System/engineering_standards.md` and the checklist in `.agent/SOP/definition_of_done.md`. Read those — do not rely on a summary.** They are the single source of truth; this file deliberately carries a pointer rather than a copy, because forked copies of a rule drift apart and then contradict each other.

Shortest possible version: run `bun run verify:full`, report its real output, never weaken a gate to get green.
