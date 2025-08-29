import { test, expect, Page } from "@playwright/test";
import { join } from "path";
import { promises as fs } from "fs";

// Test utilities
const TEST_TIMEOUT = 90000; // 90 seconds for extraction processes

// Mock test data
const TEST_URLS = {
  valid: "https://www.allrecipes.com/recipe/231506/simple-macaroni-and-cheese/",
  invalid: "not-a-valid-url",
  unsupported: "https://example.com/non-recipe-page",
  private: "http://localhost:3000/private-recipe",
};

const TEST_FILES = {
  validImage: "test-recipe-image.jpg",
  invalidImage: "test-file.txt",
  largeImage: "large-recipe-image.jpg",
  validPDF: "test-recipe.pdf",
  invalidPDF: "test-file.txt",
  largePDF: "large-recipe.pdf",
};

/**
 * Test helper to create mock test files
 */
async function createMockTestFiles() {
  const testDir = join(process.cwd(), "e2e/fixtures");
  await fs.mkdir(testDir, { recursive: true });

  // Create mock image files
  const mockImageBuffer = Buffer.from("mock-image-content");
  await fs.writeFile(join(testDir, TEST_FILES.validImage), mockImageBuffer);

  // Create mock PDF files
  const mockPDFBuffer = Buffer.from("mock-pdf-content");
  await fs.writeFile(join(testDir, TEST_FILES.validPDF), mockPDFBuffer);

  // Create invalid files
  const invalidBuffer = Buffer.from("invalid-file-content");
  await fs.writeFile(join(testDir, TEST_FILES.invalidImage), invalidBuffer);
  await fs.writeFile(join(testDir, TEST_FILES.invalidPDF), invalidBuffer);
}

/**
 * Test helper to navigate to recipe import page
 */
async function navigateToRecipeImport(page: Page) {
  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");

  // Login with test credentials using more robust selectors
  const emailInput = page.getByRole("textbox", { name: "Email" });
  const passwordInput = page.getByRole("textbox", { name: "Password" });

  await emailInput.fill("cristianxsa15@gmail.com");
  await passwordInput.fill("4JWmW@aSv8K5eUV");
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for authentication to complete
  await page.waitForURL(/\/dashboard|\/recipes/, { timeout: 10000 });

  // Navigate to new recipe page
  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
}

/**
 * Test helper to wait for import completion
 */
async function waitForImportCompletion(page: Page, timeout = TEST_TIMEOUT) {
  // Wait for progress to complete
  await page.waitForSelector('[data-testid="import-progress-complete"]', {
    timeout,
    state: "visible",
  });

  // Wait for success message
  await page.waitForSelector('[data-testid="import-success-message"]', {
    timeout: 5000,
    state: "visible",
  });
}

/**
 * Test helper to verify recipe form population
 */
async function verifyRecipeFormPopulation(page: Page) {
  // Check that form fields are populated
  const title = await page.inputValue('[data-testid="recipe-title-input"]');

  expect(title).toBeTruthy();
  expect(title.length).toBeGreaterThan(0);

  // Check ingredients are populated
  const ingredients = await page
    .locator('[data-testid="ingredient-item"]')
    .count();
  expect(ingredients).toBeGreaterThan(0);

  // Check instructions are populated
  const instructions = await page
    .locator('[data-testid="instruction-item"]')
    .count();
  expect(instructions).toBeGreaterThan(0);
}

test.describe("Recipe Import Integration Tests", () => {
  test.beforeAll(async () => {
    // Create mock test files
    await createMockTestFiles();
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to recipe import page
    await navigateToRecipeImport(page);

    // Verify import interface is loaded - use actual DOM structure
    await expect(page.locator('[role="tablist"]')).toBeVisible();

    // Alternative: Check for the URL tab specifically
    await expect(page.getByRole("tab", { name: /URL/i })).toBeVisible();
  });

  test.describe("URL Import Integration", () => {
    test("should successfully import recipe from valid URL", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on URL tab - use actual tab role
      await page.getByRole("tab", { name: /URL/i }).click();

      // Enter valid URL - check URLUpload component for actual input selector
      await page.locator('input[type="url"]').fill(TEST_URLS.valid);

      // Submit URL import - look for submit button
      await page.getByRole("button", { name: /import|submit/i }).click();

      // Wait for form fields to be populated (actual form elements)
      await page.waitForSelector('input[placeholder*="recipe title"]', {
        timeout: TEST_TIMEOUT,
      });

      // Verify recipe form is populated using actual form structure
      const title = await page
        .locator('input[placeholder*="recipe title"]')
        .inputValue();
      expect(title).toBeTruthy();
    });

    test("should handle invalid URL with proper error message", async ({
      page,
    }) => {
      // Click on URL tab
      await page.click('[data-testid="url-import-tab"]');

      // Enter invalid URL
      await page.fill('[data-testid="url-input"]', TEST_URLS.invalid);

      // Submit URL import
      await page.click('[data-testid="url-submit-button"]');

      // Check for validation error
      await expect(
        page.locator('[data-testid="url-validation-error"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="url-validation-error"]')
      ).toContainText("Please enter a valid URL");
    });

    test("should handle unsupported website with fallback", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on URL tab
      await page.click('[data-testid="url-import-tab"]');

      // Enter unsupported URL
      await page.fill('[data-testid="url-input"]', TEST_URLS.unsupported);

      // Submit URL import
      await page.click('[data-testid="url-submit-button"]');

      // Should show warning about unsupported site
      await expect(
        page.locator('[data-testid="unsupported-website-warning"]')
      ).toBeVisible();

      // But still provide fallback data
      await waitForImportCompletion(page);
      await verifyRecipeFormPopulation(page);
    });

    test("should block private/local URLs for security", async ({ page }) => {
      // Click on URL tab
      await page.click('[data-testid="url-import-tab"]');

      // Enter private URL
      await page.fill('[data-testid="url-input"]', TEST_URLS.private);

      // Submit URL import
      await page.click('[data-testid="url-submit-button"]');

      // Check for security error
      await expect(
        page.locator('[data-testid="url-security-error"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="url-security-error"]')
      ).toContainText("security reasons");
    });

    test("should show real-time progress during URL extraction", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on URL tab
      await page.click('[data-testid="url-import-tab"]');

      // Enter valid URL
      await page.fill('[data-testid="url-input"]', TEST_URLS.valid);

      // Submit URL import
      await page.click('[data-testid="url-submit-button"]');

      // Check progress bar appears
      await expect(
        page.locator('[data-testid="url-progress-bar"]')
      ).toBeVisible();

      // Check progress updates
      await expect(
        page.locator('[data-testid="url-progress-text"]')
      ).toContainText("Fetching");

      // Wait for processing phase
      await page.waitForSelector(
        '[data-testid="url-progress-text"]:has-text("Processing")',
        {
          timeout: 30000,
        }
      );

      // Wait for completion
      await waitForImportCompletion(page);
    });

    test("should allow cancellation of URL import", async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on URL tab
      await page.click('[data-testid="url-import-tab"]');

      // Enter valid URL
      await page.fill('[data-testid="url-input"]', TEST_URLS.valid);

      // Submit URL import
      await page.click('[data-testid="url-submit-button"]');

      // Wait for progress to start
      await expect(
        page.locator('[data-testid="url-progress-bar"]')
      ).toBeVisible();

      // Cancel the import
      await page.click('[data-testid="cancel-import-button"]');

      // Verify import is cancelled
      await expect(
        page.locator('[data-testid="import-cancelled-message"]')
      ).toBeVisible();
    });
  });

  test.describe("Image Import Integration", () => {
    test("should successfully import recipe from valid image", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on image tab
      await page.click('[data-testid="image-import-tab"]');

      // Upload valid image file
      const fileInput = page.locator('[data-testid="image-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validImage)
      );

      // Wait for upload and processing
      await waitForImportCompletion(page);

      // Verify recipe form is populated
      await verifyRecipeFormPopulation(page);

      // Verify success toast notification
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    });

    test("should handle invalid image file with proper error", async ({
      page,
    }) => {
      // Click on image tab
      await page.click('[data-testid="image-import-tab"]');

      // Upload invalid file
      const fileInput = page.locator('[data-testid="image-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.invalidImage)
      );

      // Check for validation error
      await expect(
        page.locator('[data-testid="image-validation-error"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="image-validation-error"]')
      ).toContainText("Unsupported file format");
    });

    test("should show image preview before processing", async ({ page }) => {
      // Click on image tab
      await page.click('[data-testid="image-import-tab"]');

      // Upload valid image file
      const fileInput = page.locator('[data-testid="image-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validImage)
      );

      // Check image preview appears
      await expect(page.locator('[data-testid="image-preview"]')).toBeVisible();

      // Check process button is enabled
      await expect(
        page.locator('[data-testid="process-image-button"]')
      ).toBeEnabled();
    });

    test("should show real-time progress during image processing", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on image tab
      await page.click('[data-testid="image-import-tab"]');

      // Upload valid image file
      const fileInput = page.locator('[data-testid="image-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validImage)
      );

      // Start processing
      await page.click('[data-testid="process-image-button"]');

      // Check progress bar appears
      await expect(
        page.locator('[data-testid="image-progress-bar"]')
      ).toBeVisible();

      // Check progress updates
      await expect(
        page.locator('[data-testid="image-progress-text"]')
      ).toContainText("Uploading");

      // Wait for processing phase
      await page.waitForSelector(
        '[data-testid="image-progress-text"]:has-text("Processing")',
        {
          timeout: 30000,
        }
      );

      // Wait for completion
      await waitForImportCompletion(page);
    });

    test("should handle OCR extraction with fallback", async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on image tab
      await page.click('[data-testid="image-import-tab"]');

      // Upload valid image file
      const fileInput = page.locator('[data-testid="image-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validImage)
      );

      // Start processing
      await page.click('[data-testid="process-image-button"]');

      // Wait for completion (may use fallback OCR)
      await waitForImportCompletion(page);

      // Verify fallback data is provided
      await verifyRecipeFormPopulation(page);

      // Check for fallback warning if applicable
      const fallbackWarning = page.locator(
        '[data-testid="fallback-ocr-warning"]'
      );
      if (await fallbackWarning.isVisible()) {
        await expect(fallbackWarning).toContainText("fallback");
      }
    });
  });

  test.describe("PDF Import Integration", () => {
    test("should successfully import recipe from valid PDF", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on PDF tab
      await page.click('[data-testid="pdf-import-tab"]');

      // Upload valid PDF file
      const fileInput = page.locator('[data-testid="pdf-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validPDF)
      );

      // Wait for upload and processing
      await waitForImportCompletion(page);

      // Verify recipe form is populated
      await verifyRecipeFormPopulation(page);

      // Verify success toast notification
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    });

    test("should handle invalid PDF file with proper error", async ({
      page,
    }) => {
      // Click on PDF tab
      await page.click('[data-testid="pdf-import-tab"]');

      // Upload invalid file
      const fileInput = page.locator('[data-testid="pdf-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.invalidPDF)
      );

      // Check for validation error
      await expect(
        page.locator('[data-testid="pdf-validation-error"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="pdf-validation-error"]')
      ).toContainText("Unsupported file format");
    });

    test("should show PDF metadata before processing", async ({ page }) => {
      // Click on PDF tab
      await page.click('[data-testid="pdf-import-tab"]');

      // Upload valid PDF file
      const fileInput = page.locator('[data-testid="pdf-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validPDF)
      );

      // Check PDF info appears
      await expect(page.locator('[data-testid="pdf-info"]')).toBeVisible();

      // Check process button is enabled
      await expect(
        page.locator('[data-testid="process-pdf-button"]')
      ).toBeEnabled();
    });

    test("should show real-time progress during PDF processing", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on PDF tab
      await page.click('[data-testid="pdf-import-tab"]');

      // Upload valid PDF file
      const fileInput = page.locator('[data-testid="pdf-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validPDF)
      );

      // Start processing
      await page.click('[data-testid="process-pdf-button"]');

      // Check progress bar appears
      await expect(
        page.locator('[data-testid="pdf-progress-bar"]')
      ).toBeVisible();

      // Check progress updates
      await expect(
        page.locator('[data-testid="pdf-progress-text"]')
      ).toContainText("Uploading");

      // Wait for processing phase
      await page.waitForSelector(
        '[data-testid="pdf-progress-text"]:has-text("Processing")',
        {
          timeout: 30000,
        }
      );

      // Wait for completion
      await waitForImportCompletion(page);
    });

    test("should handle Document AI extraction with fallback", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Click on PDF tab
      await page.click('[data-testid="pdf-import-tab"]');

      // Upload valid PDF file
      const fileInput = page.locator('[data-testid="pdf-file-input"]');
      await fileInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validPDF)
      );

      // Start processing
      await page.click('[data-testid="process-pdf-button"]');

      // Wait for completion (may use fallback)
      await waitForImportCompletion(page);

      // Verify fallback data is provided
      await verifyRecipeFormPopulation(page);

      // Check for fallback warning if applicable
      const fallbackWarning = page.locator(
        '[data-testid="fallback-processing-warning"]'
      );
      if (await fallbackWarning.isVisible()) {
        await expect(fallbackWarning).toContainText("fallback");
      }
    });
  });

  test.describe("Cross-Method Integration", () => {
    test("should maintain consistent recipe data format across all import methods", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT * 3);

      const extractedData = [];

      // Test URL import
      await page.click('[data-testid="url-import-tab"]');
      await page.fill('[data-testid="url-input"]', TEST_URLS.valid);
      await page.click('[data-testid="url-submit-button"]');
      await waitForImportCompletion(page);

      // Extract data structure
      const urlData = {
        title: await page.inputValue('[data-testid="recipe-title-input"]'),
        ingredientCount: await page
          .locator('[data-testid="ingredient-item"]')
          .count(),
        instructionCount: await page
          .locator('[data-testid="instruction-item"]')
          .count(),
      };
      extractedData.push(urlData);

      // Reset form
      await page.click('[data-testid="reset-form-button"]');

      // Test Image import
      await page.click('[data-testid="image-import-tab"]');
      const imageInput = page.locator('[data-testid="image-file-input"]');
      await imageInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validImage)
      );
      await waitForImportCompletion(page);

      // Extract data structure
      const imageData = {
        title: await page.inputValue('[data-testid="recipe-title-input"]'),
        ingredientCount: await page
          .locator('[data-testid="ingredient-item"]')
          .count(),
        instructionCount: await page
          .locator('[data-testid="instruction-item"]')
          .count(),
      };
      extractedData.push(imageData);

      // Reset form
      await page.click('[data-testid="reset-form-button"]');

      // Test PDF import
      await page.click('[data-testid="pdf-import-tab"]');
      const pdfInput = page.locator('[data-testid="pdf-file-input"]');
      await pdfInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validPDF)
      );
      await waitForImportCompletion(page);

      // Extract data structure
      const pdfData = {
        title: await page.inputValue('[data-testid="recipe-title-input"]'),
        ingredientCount: await page
          .locator('[data-testid="ingredient-item"]')
          .count(),
        instructionCount: await page
          .locator('[data-testid="instruction-item"]')
          .count(),
      };
      extractedData.push(pdfData);

      // Verify all methods produce valid data
      extractedData.forEach((data) => {
        expect(data.title).toBeTruthy();
        expect(data.ingredientCount).toBeGreaterThan(0);
        expect(data.instructionCount).toBeGreaterThan(0);
      });
    });

    test("should handle network failures gracefully across all methods", async ({
      page,
    }) => {
      // Simulate network failure
      await page.route("**/api/recipes/import/**", (route) => {
        route.abort("failed");
      });

      // Test URL import with network failure
      await page.click('[data-testid="url-import-tab"]');
      await page.fill('[data-testid="url-input"]', TEST_URLS.valid);
      await page.click('[data-testid="url-submit-button"]');

      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();

      // Test Image import with network failure
      await page.click('[data-testid="image-import-tab"]');
      const imageInput = page.locator('[data-testid="image-file-input"]');
      await imageInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validImage)
      );

      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();

      // Test PDF import with network failure
      await page.click('[data-testid="pdf-import-tab"]');
      const pdfInput = page.locator('[data-testid="pdf-file-input"]');
      await pdfInput.setInputFiles(
        join(process.cwd(), "e2e/fixtures", TEST_FILES.validPDF)
      );

      // Should show network error
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    });

    test("should allow switching between import methods without losing state", async ({
      page,
    }) => {
      // Start with URL import
      await page.click('[data-testid="url-import-tab"]');
      await page.fill('[data-testid="url-input"]', TEST_URLS.valid);

      // Switch to image import
      await page.click('[data-testid="image-import-tab"]');

      // Switch back to URL import
      await page.click('[data-testid="url-import-tab"]');

      // Verify URL input is preserved
      const urlValue = await page.inputValue('[data-testid="url-input"]');
      expect(urlValue).toBe(TEST_URLS.valid);
    });
  });

  test.describe("Error Handling and Edge Cases", () => {
    test("should handle API timeouts gracefully", async ({ page }) => {
      test.setTimeout(TEST_TIMEOUT);

      // Mock slow API response
      await page.route("**/api/recipes/import/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 91000)); // Longer than timeout
        route.continue();
      });

      // Test URL import
      await page.click('[data-testid="url-import-tab"]');
      await page.fill('[data-testid="url-input"]', TEST_URLS.valid);
      await page.click('[data-testid="url-submit-button"]');

      // Should show timeout error
      await expect(page.locator('[data-testid="timeout-error"]')).toBeVisible();
    });

    test("should handle malformed API responses", async ({ page }) => {
      // Mock malformed response
      await page.route("**/api/recipes/import/**", (route) => {
        route.fulfill({
          status: 200,
          body: "malformed json response",
        });
      });

      // Test URL import
      await page.click('[data-testid="url-import-tab"]');
      await page.fill('[data-testid="url-input"]', TEST_URLS.valid);
      await page.click('[data-testid="url-submit-button"]');

      // Should show parsing error
      await expect(page.locator('[data-testid="parsing-error"]')).toBeVisible();
    });

    test("should handle large file uploads properly", async ({ page }) => {
      // This test would require actual large files in production
      // For now, we'll just verify the validation logic

      // Click on image tab
      await page.click('[data-testid="image-import-tab"]');

      // Check file size validation message
      await expect(
        page.locator('[data-testid="file-size-info"]')
      ).toContainText("Maximum size: 10MB");

      // Click on PDF tab
      await page.click('[data-testid="pdf-import-tab"]');

      // Check file size validation message
      await expect(
        page.locator('[data-testid="file-size-info"]')
      ).toContainText("Maximum size: 20MB");
    });
  });

  test.describe("Performance and Load Testing", () => {
    test("should handle concurrent import requests", async ({
      page,
      context,
    }) => {
      test.setTimeout(TEST_TIMEOUT * 2);

      // Create multiple pages for concurrent testing
      const page2 = await context.newPage();
      await navigateToRecipeImport(page2);

      // Start imports concurrently
      const import1 = async () => {
        await page.click('[data-testid="url-import-tab"]');
        await page.fill('[data-testid="url-input"]', TEST_URLS.valid);
        await page.click('[data-testid="url-submit-button"]');
        await waitForImportCompletion(page);
      };

      const import2 = async () => {
        await page2.click('[data-testid="url-import-tab"]');
        await page2.fill('[data-testid="url-input"]', TEST_URLS.valid);
        await page2.click('[data-testid="url-submit-button"]');
        await waitForImportCompletion(page2);
      };

      // Run both imports concurrently
      await Promise.all([import1(), import2()]);

      // Verify both completed successfully
      await verifyRecipeFormPopulation(page);
      await verifyRecipeFormPopulation(page2);

      await page2.close();
    });

    test("should maintain performance with multiple file uploads", async ({
      page,
    }) => {
      test.setTimeout(TEST_TIMEOUT * 2);

      const startTime = Date.now();

      // Upload multiple files sequentially
      await page.click('[data-testid="image-import-tab"]');

      for (let i = 0; i < 3; i++) {
        await page.click('[data-testid="reset-upload-button"]');

        const fileInput = page.locator('[data-testid="image-file-input"]');
        await fileInput.setInputFiles(
          join(process.cwd(), "e2e/fixtures", TEST_FILES.validImage)
        );

        await waitForImportCompletion(page);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (adjust based on requirements)
      expect(totalTime).toBeLessThan(TEST_TIMEOUT * 2);
    });
  });
});
