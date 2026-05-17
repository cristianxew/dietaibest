/**
 * DIE-39 — Conversation context persistence across reload + follow-ups
 *
 * Acceptance scenario from the Linear ticket:
 *   import a recipe → reload the page → see the imported recipe card and
 *   conversation context restored → say "change servings to 6" → updates the
 *   right recipe (the one referenced earlier in the same conversation).
 *
 * Status: structurally complete, currently test.fixme — needs the same auth
 * fixture that DIE-37's chat-meal-plan spec is waiting on. See
 * e2e/chat-meal-plan.spec.ts for the shared follow-up notes.
 *
 * Once auth fixture lands:
 *   - Seed a Pro user via prisma seed or per-test factory
 *   - signInTestUser(page, { plan: "pro" }) helper
 *   - Set ANTHROPIC_API_KEY="" so MockLlmProvider answers deterministically
 *   - MockLlmProvider already recognizes "import" + URL → emits a tool-call for
 *     importRecipeFromUrl (DIE-35); follow-up "change servings to 6" emits a
 *     tool-call for editRecipe scoped to the recipe just imported.
 *
 * For maintainers: this spec is the load-bearing end-to-end check for the
 * single-active-conversation persistence invariant (decision #112). If a
 * selector changes in the chat components, update both this spec and the
 * corresponding component to keep them in sync.
 */
import { test, expect } from "@playwright/test";

test.describe("chat → import recipe → reload → follow-up resolves to same recipe", () => {
  test.fixme(
    "round-trip: import recipe, reload, see context, follow-up edits the right recipe",
    async ({ page }) => {
      // ── Auth (placeholder — see follow-up notes above) ────────────────────────
      // await signInTestUser(page, { plan: "pro" });

      // ── Open chat drawer via the FAB ───────────────────────────────────────────
      await page.goto("/recipes");
      const fab = page.getByRole("button", { name: /DietAI Assistant/i });
      await expect(fab).toBeVisible();
      await fab.click();

      const composer = page.getByPlaceholder(/tell me what you want to cook/i);
      await expect(composer).toBeVisible();

      // ── Import a recipe from a URL ─────────────────────────────────────────────
      await composer.fill("import https://example.com/pasta-recipe");
      await page.getByRole("button", { name: /send message/i }).click();

      // ToolResultLink card appears once the import completes.
      const importedLink = page.locator('a[href^="/recipes/"]').first();
      await expect(importedLink).toBeVisible({ timeout: 30_000 });
      const importedHref = await importedLink.getAttribute("href");
      expect(importedHref).toMatch(/^\/recipes\/[\w-]+$/);
      const importedRecipeId = importedHref!.split("/").pop()!;

      // ── Reload the page ────────────────────────────────────────────────────────
      // Conversation persistence: after reload, the chat drawer's hydrate() call
      // must restore the imported recipe card AND the model must still see the
      // earlier turns in its history.
      await page.reload();

      // Reopen the drawer (a fresh navigation collapses it).
      await page.getByRole("button", { name: /DietAI Assistant/i }).click();

      // The persisted imported-recipe card must reappear in the message list.
      const restoredLink = page.locator(`a[href="/recipes/${importedRecipeId}"]`);
      await expect(restoredLink).toBeVisible({ timeout: 10_000 });

      // ── Follow-up that depends on prior conversation context ───────────────────
      // "change servings to 6" — must resolve to the recipe imported above,
      // not to some other recipe owned by the user. This exercises the
      // follow-up-resolution acceptance criterion.
      const restoredComposer = page.getByPlaceholder(/tell me what you want to cook/i);
      await restoredComposer.fill("change servings to 6");
      await page.getByRole("button", { name: /send message/i }).click();

      // The agent should produce a tool result that targets the same recipe ID.
      // Once the edit completes, the link to /recipes/<importedRecipeId> still
      // points at the same recipe (it just updated its servings).
      const editedLink = page.locator(`a[href="/recipes/${importedRecipeId}"]`).last();
      await expect(editedLink).toBeVisible({ timeout: 30_000 });

      // ── Verify the recipe was actually updated ─────────────────────────────────
      await editedLink.click();
      await expect(page).toHaveURL(new RegExp(`/recipes/${importedRecipeId}`));
      // Recipe detail page surfaces servings; should now read 6.
      await expect(page.getByText(/servings?:?\s*6\b|porciones?:?\s*6\b/i)).toBeVisible();
    }
  );

  test.fixme(
    "Limpiar action archives the active conversation and starts a fresh one",
    async ({ page }) => {
      // Honors decision #112 (locked): single-active-conversation; "Limpiar"
      // archives the current thread, the next user turn opens a new one.
      //
      // - signInTestUser, open chat drawer
      // - Send a user message ("hola")
      // - Click "Limpiar" (chat header)
      // - Assert the message list resets to empty
      // - Send another user message ("nueva pregunta")
      // - Reload the page
      // - Assert only "nueva pregunta" is in the restored history (the prior
      //   archived conversation is NOT visible)
      //
      // This is the load-bearing UI-level guarantee that archived conversations
      // do not bleed into the active one.
    }
  );

  test.fixme(
    "no cross-user leakage: user B never sees user A's conversation on hydrate",
    async ({ browser }) => {
      // - signInTestUser as userA, send a message
      // - In a separate browser context, signInTestUser as userB, open chat
      // - Assert userB's restored conversation is empty (or only contains
      //   messages userB themselves sent).
    }
  );
});
