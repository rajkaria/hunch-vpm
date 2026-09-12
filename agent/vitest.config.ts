import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The decision procedure is pure and the dry-run adapters hold no timers,
    // so nothing here needs a network, a key, or a clock it does not own.
    environment: "node",
  },
});
