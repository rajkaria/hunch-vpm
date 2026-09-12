import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every test runs against a recorded fixture. Nothing in this package's test
    // suite is allowed to open a socket; `fixtureTransport` is the only transport
    // the tests construct, and the default fetch transport is never reachable.
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
