import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly"
      }
    }
  },
  {
    ignores: [
      ".next/**",
      // Agent worktrees (parallel sessions) live inside the repo — never lint them.
      ".claude/**",
      "next-env.d.ts",
      "node_modules/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**"
    ]
  }
];

export default eslintConfig;
