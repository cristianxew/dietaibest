# DIE-41 Quality Eval Fixtures

This directory holds the 20-item dataset used to gate `FEATURE_MULTIMODAL_IMPORT` before flipping it ON in prod. The harness lives at `tests/eval/gemma-image-import.ts`. The bar is **≥80% ingredient matches** and **≥70% quantity matches** across the dataset.

## How to add a fixture

For each scenario, add **two files** with the same stem:

```
my-scenario.jpg          # the source image (jpg | jpeg | png | webp | heic)
my-scenario.golden.json  # the expected extraction
```

`my-scenario.golden.json` shape:

```json
{
  "title": "Tortilla de patatas",
  "ingredients": [
    { "name": "huevos", "amount": 6, "unit": "u" },
    { "name": "papas", "amount": 500, "unit": "g" },
    { "name": "aceite de oliva", "amount": 50, "unit": "ml" },
    { "name": "sal", "amount": 1, "unit": "tsp" }
  ]
}
```

Only `title` and `ingredients` are scored. Instructions / nutrition fields are out of scope for the eval (they are not the quality bar).

## Coverage targets (per engram decision #115)

The 20-item set should include at least one of each:

- Clear cookbook page (Spanish)
- Clear cookbook page (English)
- Clear cookbook page (Polish)
- Blurry cookbook page
- Handwritten recipe (clear)
- Handwritten recipe (messy)
- Instagram screenshot with text-on-image overlay
- TikTok screenshot
- Restaurant chalkboard
- Phone photo of a printed recipe (slight perspective)
- Multi-recipe page (we extract only the most prominent)
- Image with NO recipe (selfie, landscape) — golden has `"ingredients": []`
- Recipe with imperial units (cup, tbsp, oz)
- Recipe with metric units (g, ml, l)
- Recipe with fractional quantities (½ cup, ¼ tsp)
- Recipe in low light
- Recipe at an angle (~30°)
- Recipe with mixed languages (e.g. Spanish + English ingredient names)
- Recipe with herbs/spices list ("to taste" quantities — expect amount 0)
- Recipe with bulleted ingredients (no numbers in original)

Add fixtures incrementally. The harness will run whatever pairs it finds — start with 5 and grow.

## Running the eval

```bash
GEMINI_API_KEY=... bun run tests/eval/gemma-image-import.ts
```

Exit code:
- `0` → pass (safe to flip flag)
- `1` → fail (below thresholds; iterate prompt in `src/lib/chat/llm-gemma.ts` or escalate)
- `2` → setup error (missing API key, no fixtures, etc.)

## Why this is NOT in CI

Each run costs real Gemini API tokens. Run manually before each flag-flip decision; don't burn cycles on every PR.
