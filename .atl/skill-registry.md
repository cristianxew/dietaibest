# Skill Registry — dietaibest

Generated: 2026-03-30

## User Skills (`~/.claude/skills/`)

| Skill | Trigger |
|-------|---------|
| `judgment-day` | "judgment day", "dual review", "doble review", "juzgar", adversarial review |
| `go-testing` | Writing Go tests, Bubbletea TUI testing |
| `skill-creator` | Creating new skills, editing existing skills |
| `branch-pr` | Creating a pull request, opening a PR, preparing changes for review |
| `issue-creation` | Creating a GitHub issue, reporting a bug, requesting a feature |

## Project Skills (`.claude/skills/`)

| Skill | Trigger |
|-------|---------|
| `landing-page-copywriter` | Landing page copy, sales page content, marketing website text, high-converting copy |

## Conventions

| File | Purpose |
|------|---------|
| `CLAUDE.md` (root) | Project docs in `.agent/`, always read `.agent/README.md` before planning |
| `~/.claude/CLAUDE.md` | Global conventions — voseo Spanish, senior architect persona, never mock DBs |
| `.agent/README.md` | Documentation index — architecture, schema, design system, SOP, deployment |

## Compact Rules

### All code tasks
- Read `.agent/README.md` before planning any implementation
- Update `.agent/` docs after implementing a feature
- Use Server Actions for mutations, Repository pattern for data access
- Conventional commits only, no AI attribution

### UI / Frontend
- Skill: `landing-page-copywriter` for marketing copy
- Design system: "Botanical Precision" — see `.agent/System/design_system.md`
- Use ShadCN + Radix UI components
- next-intl for all user-facing strings

### Testing
- Test runner: Vitest (`bun run test`)
- Unit tests in `tests/unit/`
- Integration scripts exist but no test files yet
- E2E with Playwright (`bun run e2e`)
- Coverage: `bun run test:coverage`

### PRs & Issues
- Skill: `branch-pr` for PRs, `issue-creation` for GitHub issues
- Issue-first enforcement: create issue before branch

### Code Review
- Skill: `judgment-day` for adversarial review
