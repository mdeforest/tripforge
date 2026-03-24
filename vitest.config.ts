import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom so React components can interact with a browser-like DOM
    environment: "jsdom",

    // Run the global setup file before every test suite
    setupFiles: ["./tests/setup.ts"],

    // Make vi, describe, it, expect etc. available without importing them
    globals: true,

    // Exclude worktrees so their duplicate test files don't pollute the suite
    exclude: ["node_modules/**", ".worktrees/**", "dist/**"],

    // Coverage configuration (run with: npm run test:coverage)
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "tests/**",
        "**/*.config.*",
        "prisma/**",
        "docs/**",
      ],
    },
  },
  resolve: {
    // Mirror the @/* path alias from tsconfig.json so imports work in tests
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
