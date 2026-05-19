# ATL Skill Registry

This registry tracks the available skills for Spec-Driven Development (SDD) and other specialized workflows in the DietAI project.

## User Skills

| Skill | Trigger | Description |
|---|---|---|
| branch-pr | Creating a PR, opening a PR, or preparing changes for review | PR creation workflow following issue-first system. |
| go-testing | Writing Go tests, using teatest, or adding test coverage | Go testing patterns for Gentleman.Dots. |
| issue-creation | Creating a GitHub issue, reporting a bug, or requesting a feature | Issue creation workflow. |
| judgment-day | "judgment day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen" | Adversarial review protocol. |
| sdd-apply | Orchestrator launches sdd-apply | Implementation of tasks from specifications. |
| sdd-archive | Orchestrator launches sdd-archive | Closing change and syncing delta specs. |
| sdd-design | Orchestrator launches sdd-design | Architectural and technical design. |
| sdd-explore | Orchestrator launches sdd-explore | Investigation of codebase/requirements. |
| sdd-init | Orchestrator launches sdd-init | Initialization of SDD capabilities. |
| sdd-propose | Orchestrator launches sdd-propose | Proposal generation. |
| sdd-spec | Orchestrator launches sdd-spec | Requirement and scenario specification. |
| sdd-tasks | Orchestrator launches sdd-tasks | Task checklist breakdown. |
| sdd-verify | Orchestrator launches sdd-verify | Test execution and verification against specs. |
| skill-creator | Creating new skills, adding agent instructions | Authoring new agent skills. |

## Project Conventions

The following project standards are in place:
- **Architecture**: Next.js App Router, Prisma ORM, Supabase Auth/DB, Culinary/Botanical Precision Design System.
- **Rules**:
  - Gated server actions in `src/actions/` must use the custom `serverAction` HOF utility in `src/lib/server-action.ts`.
  - All modifications must preserve comments, docstrings, and not add "Co-Authored-By" or AI attribution.
  - Strict TDD mode is enabled.
