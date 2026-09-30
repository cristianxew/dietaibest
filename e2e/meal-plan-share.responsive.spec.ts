import { expect, test } from "@playwright/test";

const token = process.env.E2E_SHARE_TOKEN;

test.describe("shared meal plan page responsiveness", () => {
  test.skip(!token, "Set E2E_SHARE_TOKEN to a public meal plan share token");

  test("does not overflow horizontally", async ({ page }) => {
    await page.goto(`/en/share/meal-plan/${token}`);
    await expect(page.locator("main h1")).toBeVisible();

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("sign-up call to action is a comfortable touch target", async ({
    page,
  }) => {
    await page.goto(`/en/share/meal-plan/${token}`);
    const cta = page.locator("footer a").first();
    await expect(cta).toBeVisible();

    const box = await cta.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
