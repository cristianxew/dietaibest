/**
 * DIE-37 — Chat agent → generateMealPlan → /meal-plans deep-link
 *
 * Acceptance scenario from the Linear ticket:
 *   "build me a 7-day plan around 1800 kcal vegetarian"
 *   → progress visible (planning → cooking N of 14 → saving)
 *   → ToolResultLink card appears
 *   → click → /meal-plans?selected={id} loads with the new plan auto-selected
 *
 * Status: structurally complete, currently test.fixme — needs auth fixture.
 *
 * Why fixme'd:
 * The chat drawer is gated by the aiChat entitlement (Pro-only). To exercise
 * this flow end-to-end we need a logged-in Pro test user. No e2e auth fixture
 * exists yet in this repo (no prior e2e tests). Wiring that up is out of scope
 * for DIE-37 — file a follow-up:
 *
 *   - Seed a deterministic Pro user via prisma seed (or per-test factory)
 *   - Add an auth helper (`signInTestUser(page)`) that drives the magic-link
 *     or email/password flow against a test-only auth provider
 *   - Set ANTHROPIC_API_KEY="" in the test env so the runtime falls back to
 *     MockLlmProvider, which now (Task 5) emits a tool-call for
 *     generateMealPlan on the keyword match below
 *   - Stub or seed the database state expected by createMealPlan so it
 *     succeeds without a live Anthropic call
 *
 * Once those exist, remove `.fixme` from the `test()` calls and the spec runs.
 *
 * For maintainers: this file documents the exact selectors and the assertions
 * the production UI must satisfy. If a selector changes in the chat components,
 * update both this spec and the corresponding component to keep them in sync.
 */
import { test, expect } from "@playwright/test";

test.describe("chat → generateMealPlan → /meal-plans deep-link", () => {
  test.fixme("end-to-end: 7-day plan, progress visible, link navigates to ?selected={id}", async ({
    page,
  }) => {
    // ── Auth (placeholder — see follow-up notes above) ────────────────────────
    // await signInTestUser(page, { plan: "pro" });

    // ── Open chat drawer via the FAB ───────────────────────────────────────────
    await page.goto("/recipes");
    const fab = page.getByRole("button", { name: /DietAI Assistant/i });
    await expect(fab).toBeVisible();
    await fab.click();

    // Drawer should be open — composer textarea visible.
    const composer = page.getByPlaceholder(/tell me what you want to cook/i);
    await expect(composer).toBeVisible();

    // ── Submit the meal-plan prompt ────────────────────────────────────────────
    await composer.fill("build me a 7-day plan around 1800 kcal vegetarian");
    await page.getByRole("button", { name: /send message/i }).click();

    // ── Assert progressive ChatStatus messages ─────────────────────────────────
    // (MockLlmProvider matches the keywords and emits a tool-call for generateMealPlan;
    //  the workflow emits planning → 14× slot → saving via tool.progress events.)
    await expect(page.getByText(/planning…?/i)).toBeVisible({ timeout: 5_000 });

    // At least one "Cooking N of 14" status should appear during fan-out.
    await expect(page.getByText(/cooking \d+ of 14/i)).toBeVisible({
      timeout: 30_000,
    });

    // Saving status appears at the persist step.
    await expect(page.getByText(/saving plan/i)).toBeVisible({ timeout: 60_000 });

    // ── ToolResultLink card appears ────────────────────────────────────────────
    // The link href is /meal-plans?selected=<id>; label is the plan name.
    const link = page.locator('a[href^="/meal-plans?selected="]').first();
    await expect(link).toBeVisible({ timeout: 90_000 });

    // ── Click the link → /meal-plans?selected={id} ─────────────────────────────
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/meal-plans\?selected=[\w-]+$/);

    await Promise.all([page.waitForURL(/\/meal-plans\?selected=/), link.click()]);

    // ── Assert the new plan is auto-selected with 7 days × meals visible ───────
    // The MealPlans component honors ?selected= (Task 5) and renders the
    // chosen template. The exact day/meal count selectors depend on the
    // production layout — update if they change.
    await expect(page).toHaveURL(/\/meal-plans\?selected=[\w-]+/);

    // Day 1..7 should be rendered somewhere on the page.
    for (const day of [1, 2, 3, 4, 5, 6, 7]) {
      await expect(page.getByText(new RegExp(`day\\s+${day}\\b|d[ií]a\\s+${day}\\b`, "i"))).toBeVisible();
    }

    // At least one meal recipe link rendered (the per-day meals).
    const recipeLinks = page.locator('a[href^="/recipes/"]');
    await expect(recipeLinks.first()).toBeVisible();
  });

  test.fixme(
    "partial failure: 2/14 slots fail → plan still persists with placeholders",
    async () => {
      // Same prompt as above, but with an env-injected failure flag that causes
      // the mock LLM's per-slot resolver to fail 2 specific calls. Expected UX:
      //  - progress events still show 12 slot succeeds + 2 slotFailed events
      //  - ToolResultLink still appears
      //  - /meal-plans?selected= still renders the plan
      //  - The 2 failed slots show a placeholder (follow-up UI ticket — for now
      //    just assert the plan loaded and the failed-slot meal rows exist with
      //    recipeId === null in the DOM via data attribute, if available)
      //
      // Implementation: requires a per-test env hook on MockLlmProvider that
      // accepts a `MOCK_FAIL_SLOT_INDICES="2,7"` env var. Wire it up alongside
      // the auth fixture follow-up above.
    }
  );

  test.fixme(
    "threshold exceeded: 5/14 fail → tool.failed, no plan in /meal-plans",
    async () => {
      // Same setup, but with 5 failed slots. Expected UX:
      //  - "Plan incompleto: 5 de 14 comidas fallaron" (or English equivalent)
      //  - NO ToolResultLink card
      //  - /meal-plans does NOT contain the new plan
    }
  );
});
