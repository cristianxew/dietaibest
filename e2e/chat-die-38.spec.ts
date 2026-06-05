/**
 * DIE-38 — Medical-advice refusal + cost cap UX
 *
 * Two acceptance scenarios from the Linear ticket:
 *   1. A Pro user asks about diabetes → assistant refuses with disclaimer in
 *      the user's locale.
 *   2. A Pro user hits a simulated `cost_cap_reached` payload → sees the
 *      localized in-chat message.
 *
 * Status: structurally complete, currently test.fixme — needs the shared auth
 * fixture that DIE-37 / DIE-39 are also waiting on. See
 * e2e/chat-meal-plan.spec.ts and e2e/chat-conversation-persistence.spec.ts for
 * the shared follow-up notes (signInTestUser helper, Pro seed, mock LLM env).
 *
 * Once auth fixture lands:
 *   - Seed a Pro user via prisma seed or per-test factory
 *   - signInTestUser(page, { plan: "pro" }) helper
 *   - For scenario 1: ANTHROPIC_API_KEY="" so MockLlmProvider answers — its
 *     medical-keyword branch already emits a refusal text deterministically.
 *   - For scenario 2: set CHAT_COST_CAP_ENFORCED="true" and pre-seed enough
 *     Message rows with inputTokens/outputTokens so getMonthlyAiCostUsd
 *     returns ≥ CHAT_COST_CAP_USD for the test user.
 */
import { test, expect } from "@playwright/test";

test.describe("chat → medical-advice refusal + cost-cap UX", () => {
  test.fixme(
    "Pro user asks about diabetes → assistant refuses with disclaimer in locale",
    async ({ page }) => {
      // ── Auth (placeholder — see follow-up notes above) ────────────────────────
      // await signInTestUser(page, { plan: "pro", locale: "es" });

      await page.goto("/recipes");

      // Open chat drawer via the FAB.
      const fab = page.getByRole("button", { name: /DietAI Assistant/i });
      await expect(fab).toBeVisible();
      await fab.click();

      const composer = page.getByPlaceholder(/decime qué querés cocinar/i);
      await expect(composer).toBeVisible();

      // Ask a medical question. MockLlmProvider's medical branch will match
      // the diabetes keyword and stream a refusal in the localized voice.
      await composer.fill("qué puedo comer si tengo diabetes");
      await page.getByRole("button", { name: /enviar mensaje/i }).click();

      // The assistant's reply must contain a refusal disclaimer + redirect
      // to a healthcare professional, in Rioplatense Spanish.
      const refusal = page.locator("text=/consultá|profesional de la salud|no te puedo asesorar/i");
      await expect(refusal).toBeVisible({ timeout: 15_000 });

      // The reply must NOT contain dietary numbers (nutrition guardrail still applies).
      const reply = page.locator('[data-role="agent"]').last();
      const text = (await reply.textContent()) ?? "";
      expect(text).not.toMatch(/\b\d+\s*(kcal|cal|g)\b/);
    }
  );

  test.fixme(
    "Pro user hits cost_cap_reached → localized in-chat message renders",
    async ({ page }) => {
      // ── Auth + cost-cap simulation (placeholders) ─────────────────────────────
      // await signInTestUser(page, { plan: "pro", locale: "en" });
      // process.env.CHAT_COST_CAP_ENFORCED = "true";
      // Seed Message rows totaling more than $CHAT_COST_CAP_USD this month for
      // the test user. The simplest way: insert a few rows with
      // inputTokens = 2_000_000 and outputTokens = 500_000 (≈ $13.50 at Sonnet
      // rates, well over the default $5 cap).

      await page.goto("/recipes");
      const fab = page.getByRole("button", { name: /DietAI Assistant/i });
      await fab.click();

      const composer = page.getByPlaceholder(/tell me what you want to cook/i);
      await composer.fill("create a recipe for tomato risotto");
      await page.getByRole("button", { name: /send message/i }).click();

      // The chat route must emit a `cost.cap` event before invoking the runtime.
      // The UI renders the localized chat.costCap.reached message.
      const capMessage = page.locator("text=/monthly AI usage limit/i");
      await expect(capMessage).toBeVisible({ timeout: 10_000 });

      // No tool was invoked — no recipe link should appear.
      const recipeLink = page.locator('a[href^="/recipes/"]');
      await expect(recipeLink).not.toBeVisible();
    }
  );
});
