import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  esbuild: {
    jsx: "automatic"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      reportsDirectory: "./coverage",
      // Focus coverage on the pure logic the suite is designed to exercise.
      include: ["src/domain/**/*.ts", "src/client/**/*.ts", "src/data/**/*.ts"],
      exclude: ["**/*.d.ts", "src/**/index.ts"]
    }
  }
});
