import { describe, expect, it } from 'vitest';

import { hasWalletConnect, WALLETCONNECT_PROJECT_ID, walletConfig } from '../src/lib/wallet/config';

describe('wallet config', () => {
  it('ships no WalletConnect project id, because one is a credential', () => {
    // If this ever fails, someone has committed a default. A project id belongs
    // in the deployment's environment, never in the tree.
    expect(WALLETCONNECT_PROJECT_ID).toBe('');
    expect(hasWalletConnect).toBe(false);
  });

  it('still offers an injected connector with no project id set', () => {
    const config = walletConfig();
    expect(config.connectors.length).toBeGreaterThan(0);
    expect(config.connectors.some((connector) => connector.id === 'injected')).toBe(true);
  });

  it('is memoised, so every consumer shares one config', () => {
    expect(walletConfig()).toBe(walletConfig());
  });

  it('is configured for exactly the active chain', () => {
    expect(walletConfig().chains.map((chain) => chain.id)).toEqual([5042002]);
  });
});
