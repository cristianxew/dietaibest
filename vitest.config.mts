import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only` is a build-time marker Next.js ships; not installed as a
      // standalone package, so unit tests that transitively import it need a
      // local stub. Stub keeps the marker behavior (importing in client code
      // throws at runtime) trivially absent so server-only modules can be
      // exercised under jsdom.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30000, // 30 seconds for USDA API calls
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/e2e/**",
      "**/.next/**",
      "**/playwright/**",
    ],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        ".next/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/playwright/**",
      ],
    },
  },
}));
