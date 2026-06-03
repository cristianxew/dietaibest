# The system prompt is the sole medical-refusal classifier

**Status:** accepted

Per decision #117, the chat agent has no regex/ML classifier for medical-advice
refusal — the system prompt prose (`src/lib/chat/system-prompt.ts`: the NUTRITION
GUARDRAIL and MEDICAL ADVICE blocks) is the *only* layer enforcing it. The unit
test `tests/unit/chat/system-prompt.test.ts` only checks **word-presence** (that
the prompt mentions "diabetes", "healthcare professional", etc.) — it cannot see
a softened "MUST", a buried disclaimer, or a reordering that weakens behavior. So
**any refactor that edits the guardrail/refusal prose must first have the
behavioral net green**: `tests/eval/medical-refusal.ts` drives the real runtime
against Claude and asserts that clinical prompts are refused and preference
prompts are not (over-refusal). It is an opt-in Vitest test (so the
`server-only` alias resolves the full tool registry). Run
`RUN_REFUSAL_EVAL=1 ANTHROPIC_API_KEY=… bunx vitest run
tests/eval/medical-refusal.test.ts` → green *before* touching safety prose.

## Consequences

- Co-locating tool **guidance** out of the prompt (the DIE candidate #2 work)
  deliberately stopped short of the safety-*fused* mentions (e.g. "call
  getNutrition" inside the guardrail). Those stay until the eval is run green.
- Do not "tidy up" the guardrail or medical-refusal wording without the eval.
  Word-presence regex passing is **not** evidence the classifier still works.
