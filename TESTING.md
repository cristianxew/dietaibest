# Testing Guide for DietAIbook

This document provides a comprehensive guide to testing in the DietAIbook Next.js application using Vitest for unit testing and Playwright for end-to-end testing.

## 📋 Table of Contents

1. [Testing Stack](#testing-stack)
2. [Setup and Installation](#setup-and-installation)
3. [Project Structure](#project-structure)
4. [Unit Testing with Vitest](#unit-testing-with-vitest)
5. [E2E Testing with Playwright](#e2e-testing-with-playwright)
6. [Running Tests](#running-tests)
7. [Writing Tests](#writing-tests)
8. [Best Practices](#best-practices)
9. [CI/CD Integration](#cicd-integration)
10. [Troubleshooting](#troubleshooting)

## 🛠 Testing Stack

Our testing setup includes:

- **[Vitest](https://vitest.dev/)** - Fast unit test framework
- **[React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)** - Simple and complete testing utilities for React components
- **[Playwright](https://playwright.dev/)** - End-to-end testing framework
- **[Jest DOM](https://github.com/testing-library/jest-dom)** - Custom Jest matchers for DOM testing

## 🚀 Setup and Installation

The testing environment is already configured with the following dependencies:

```bash
# Unit Testing Dependencies
bun add -d vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom vite-tsconfig-paths

# E2E Testing Dependencies
bun add -d @playwright/test
```

## 📁 Project Structure

```
DietAIbook/
├── tests/
│   ├── unit/              # Unit tests
│   │   ├── Button.test.tsx
│   │   └── MacroDisplay.test.tsx
│   └── integration/       # Integration tests
│       ├── INTEGRATION_TEST_CHECKLIST.md
│       └── manual-test-script.js
├── e2e/                   # End-to-end tests
│   ├── recipe-import.spec.ts
│   └── auth-flow.spec.ts
├── vitest.config.mts      # Vitest configuration
├── vitest.setup.ts        # Vitest setup file
├── playwright.config.ts   # Playwright configuration
└── TESTING.md            # This file
```

## 🧪 Unit Testing with Vitest

### Configuration

Vitest is configured in `vitest.config.mts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // ... other config
  },
});
```

### Writing Unit Tests

Unit tests should focus on testing individual components in isolation:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("renders button with text content", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick handler when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Clickable Button</Button>);

    fireEvent.click(screen.getByText("Clickable Button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Best Practices for Unit Tests

1. **Test user behavior, not implementation details**
2. **Use accessible queries** (getByRole, getByLabelText, etc.)
3. **Mock external dependencies**
4. **Keep tests focused and independent**
5. **Use descriptive test names**

## 🎭 E2E Testing with Playwright

### Configuration

Playwright is configured in `playwright.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### Writing E2E Tests

E2E tests should test complete user workflows:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Recipe Import Flow", () => {
  test("should allow manual recipe creation", async ({ page }) => {
    await page.goto("/en/recipes/new");

    await page.getByLabel(/recipe title/i).fill("Test Recipe");
    await page.getByLabel(/description/i).fill("A delicious test recipe");

    await page.getByRole("button", { name: /create recipe/i }).click();
    await expect(page).toHaveURL(/\/en\/recipes/);
  });
});
```

### Testing Best Practices for E2E Tests

1. **Test critical user journeys**
2. **Use realistic data**
3. **Test across different browsers and viewports**
4. **Handle async operations properly**
5. **Use page object models for complex flows**

## 🏃‍♂️ Running Tests

### Unit Tests

```bash
# Run all unit tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run tests with UI
bun run test:ui
```

### E2E Tests

```bash
# Run all E2E tests
bun run e2e

# Run E2E tests with UI
bun run e2e:ui

# Run E2E tests in headed mode (see browser)
bun run e2e:headed

# Debug E2E tests
bun run e2e:debug

# View test report
bun run e2e:report
```

### Specific Test Files

```bash
# Run specific unit test file
bun run test tests/unit/Button.test.tsx

# Run specific E2E test file
bun run e2e e2e/recipe-import.spec.ts
```

## ✍️ Writing Tests

### Unit Test Examples

#### Testing Components with Props

```typescript
describe("MacroDisplay Component", () => {
  it("renders calories when provided", () => {
    render(
      <MacroDisplay
        calories={350}
        protein={null}
        carbs={null}
        fat={null}
        fiber={null}
        sugar={null}
        sodium={null}
      />
    );

    expect(screen.getByText("350")).toBeInTheDocument();
    expect(screen.getByText("Calories")).toBeInTheDocument();
  });
});
```

#### Testing User Interactions

```typescript
it("calls onClick handler when clicked", () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click me</Button>);

  fireEvent.click(screen.getByText("Click me"));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### E2E Test Examples

#### Testing Form Interactions

```typescript
test("should handle form validation errors", async ({ page }) => {
  await page.goto("/en/recipes/new");

  // Try to submit without filling required fields
  await page.getByRole("button", { name: /create recipe/i }).click();

  // Should show validation errors
  await expect(page.getByText(/required/i)).toBeVisible();
});
```

#### Testing Navigation

```typescript
test("should navigate between tabs", async ({ page }) => {
  await page.goto("/en/recipes/new");

  await page.getByRole("tab", { name: /ingredients & steps/i }).click();
  await expect(
    page.getByRole("tab", { name: /ingredients & steps/i })
  ).toHaveAttribute("data-state", "active");
});
```

## 📝 Best Practices

### General Testing Principles

1. **Write tests that give you confidence** - Focus on the most critical parts of your application
2. **Test behavior, not implementation** - Test what the user sees and does
3. **Keep tests simple and focused** - One test should verify one behavior
4. **Use good test names** - Should describe what is being tested and expected outcome
5. **Maintain tests like production code** - Refactor and clean up tests regularly

### Unit Testing Best Practices

1. **Use the Testing Trophy approach** - More integration tests, fewer unit tests, minimal E2E
2. **Mock external dependencies** - Keep tests isolated and fast
3. **Test edge cases** - Handle null/undefined values, empty arrays, etc.
4. **Use factories for test data** - Create reusable test data generators
5. **Test accessibility** - Use accessible queries and test screen reader compatibility

### E2E Testing Best Practices

1. **Test critical user paths** - Focus on the most important user journeys
2. **Use realistic test data** - Test with data that resembles production
3. **Handle flaky tests** - Use proper waits and retries
4. **Test mobile responsiveness** - Include mobile viewport tests
5. **Test cross-browser compatibility** - Run tests on different browsers

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx playwright install --with-deps
      - run: bun run e2e
```

## 🐛 Troubleshooting

### Common Issues

#### Vitest Issues

1. **Module resolution errors**

   - Check `vite-tsconfig-paths` is configured
   - Verify import paths in `vitest.config.mts`

2. **React component testing issues**

   - Ensure `@vitejs/plugin-react` is configured
   - Check that `jsdom` environment is set

3. **Mock issues**
   - Use `vi.fn()` instead of `jest.fn()`
   - Clear mocks between tests with `vi.clearAllMocks()`

#### Playwright Issues

1. **Timeouts**

   - Increase timeout for slow operations
   - Use proper waiting strategies (`waitFor`, `toBeVisible`)

2. **Flaky tests**

   - Add explicit waits for dynamic content
   - Use more stable selectors

3. **Browser issues**
   - Run `bunx playwright install` to update browsers
   - Check browser compatibility in config

### Getting Help

1. Check the [Vitest documentation](https://vitest.dev/)
2. Check the [Playwright documentation](https://playwright.dev/)
3. Check the [React Testing Library documentation](https://testing-library.com/)
4. Search existing issues in the project repository

## 📚 Additional Resources

- [Testing Library Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Next.js Testing Documentation](https://nextjs.org/docs/app/building-your-application/testing)

---

Happy testing! 🧪✨
