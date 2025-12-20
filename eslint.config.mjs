import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      // Generated files
      "src/generated/**/*",
      "prisma/generated/**/*",
      "**/*.generated.*",
      // Build outputs
      ".next/**/*",
      "out/**/*",
      "dist/**/*",
      // Dependencies
      "node_modules/**/*",
      // Other
      "*.config.js",
      "*.config.mjs",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow underscore-prefixed unused variables (common pattern for intentionally unused vars)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Allow explicit any in existing code (should be fixed incrementally)
      "@typescript-eslint/no-explicit-any": "warn",
      // React unescaped entities - warn instead of error
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
