# Issue Tracker — Linear

Issues for this project live in **Linear**, workspace project **"Dietai desktop"**.

## Access

Use the connected **Linear MCP server** (`mcp__claude_ai_Linear__*` tools).

## Workflow

- **Create**: `save_issue` targeting "Dietai desktop"
- **Read**: `list_issues` / `get_issue`
- **Update**: `save_issue` with the issue ID
- **Comment**: `save_comment`

## Notes

- Resolve the project ID for "Dietai desktop" via `list_projects` before creating issues if unknown.
- Do NOT use `gh` CLI for issue management — all issue ops go through Linear MCP.
