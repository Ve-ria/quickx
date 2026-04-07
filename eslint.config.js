// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow explicit `any` in a few cases where it's pragmatic
      "@typescript-eslint/no-explicit-any": "warn",
      // Don't require return types everywhere — TypeScript infers them
      "@typescript-eslint/explicit-function-return-type": "off",
      // Allow unused vars with _ prefix
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Prefer `const` where possible
      "prefer-const": "error",
      // Catch floating promises
      "@typescript-eslint/no-floating-promises": "error",
      // No console.log in production code
      "no-console": "warn",
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Test files get relaxed rules
    files: ["src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.config.ts", "*.config.js"],
  },
);
