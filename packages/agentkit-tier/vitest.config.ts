import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Nothing in this suite opens a socket. Signatures are produced with a real
    // secp256k1 key through viem's local account, and the AgentBook registry is
    // always a stub, so the verifier's network seam is exercised without a node.
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
