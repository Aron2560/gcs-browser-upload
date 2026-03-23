import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*-test.js", "test/**/*-tests.js", "test/**/*.test.js"],
    setupFiles: ["./test/setup.js"],
    testTimeout: 30000,
  },
});
