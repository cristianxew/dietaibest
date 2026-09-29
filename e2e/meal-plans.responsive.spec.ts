import { expect, test, type Page } from "@playwright/test";

// /meal-plans is behind auth and the repo has no sign-in fixture yet (see
// chat-meal-plan.spec.ts). Point E2E_STORAGE_STATE at a Playwright storage
// state JSON saved from a signed-in session to run this spec.
const storageState = process.env.E2E_STORAGE_STATE;

test.use({ storageState });

const TABS = [/planner/i, /calendar/i, /community/i];

async function gotoMealPlans(page: Page) {
  await page.goto("/en/meal-plans");
  await expect(page.getByRole("heading", { level: 1, name: "Meal Plans" })).toBeVisible();
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("meal plans page responsiveness", () => {
  test.skip(
    !storageState,
    "Set E2E_STORAGE_STATE to a storage state file for a signed-in user",
  );

  test("does not overflow horizontally on any tab", async ({ page }) => {
    await gotoMealPlans(page);

    for (const name of TABS) {
      const tab = page.getByRole("tab", { name });
      await tab.click();
      await expect(tab).toHaveAttribute("data-state", "active");
      expect(await horizontalOverflow(page), `overflow on ${name}`).toBeLessThanOrEqual(0);
    }
  });

  test("tab labels fit on one line", async ({ page }) => {
    await gotoMealPlans(page);

    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(3);

    const boxes = await tabs.evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect();
        // The ::after hit slop extends the tap target beyond the visual box.
        const slop = getComputedStyle(el, "::after");
        const hitHeight =
          slop.position === "absolute"
            ? rect.height - parseFloat(slop.top) - parseFloat(slop.bottom)
            : rect.height;
        // The visible label (short below sm, full from sm up).
        const label = Array.from(el.querySelectorAll("span")).find(
          (span) => getComputedStyle(span).display !== "none",
        );
        return {
          top: Math.round(rect.top),
          height: rect.height,
          hitHeight,
          clipped:
            el.scrollWidth > el.clientWidth ||
            (label ? label.scrollWidth > label.clientWidth : false),
        };
      }),
    );

    for (const box of boxes) {
      // Same row, a 36px recipes-style segmented control whose hit slop keeps
      // the touch target at 44px, and no second line (which would be ~56px).
      expect(box.top).toBe(boxes[0].top);
      expect(box.hitHeight).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeLessThan(44);
      expect(box.clipped).toBe(false);
    }
  });

  test("phones open the planner view options in a bottom drawer", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 640, "View options drawer is phone-only");
    await gotoMealPlans(page);

    await page.getByRole("button", { name: "View options" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: "View options" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /stack/i })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /grid/i })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Done" }).click();
    await expect(drawer).toBeHidden();
  });

  test("tapping an empty future day opens the plan picker", async ({ page }) => {
    await gotoMealPlans(page);
    await page.getByRole("tab", { name: /calendar/i }).click();
    await expect(page.getByRole("button", { name: "Next month" })).toBeVisible();

    const emptyDay = page.getByRole("button", { name: /^Schedule a meal plan on/ });
    // The rest of this month may be fully scheduled; fall back to next month.
    if ((await emptyDay.count()) === 0) {
      await page.getByRole("button", { name: "Next month" }).click();
    }

    await emptyDay.first().tap();

    const picker = page.getByRole("dialog");
    await expect(picker.getByRole("heading", { name: "Schedule a meal plan" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
