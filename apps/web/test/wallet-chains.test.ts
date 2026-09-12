import { describe, expect, it } from 'vitest';

import { ARC_MAINNET, ARC_TESTNET } from '../src/lib/chain';
import { ACTIVE_CHAIN, arcMainnetChain, arcTestnetChain } from '../src/lib/wallet/chains';

/*
 * These assert the two facts about Arc that a wallet cannot discover on its own
 * and that are catastrophic to get wrong: the native currency is USDC at six
 * decimals, and the chain has to carry enough detail to be *added* to a wallet
 * that has never heard of it.
 */
describe('Arc as a viem chain', () => {
  it('declares USDC as the native currency at six decimals, not eighteen', () => {
    for (const chain of [arcTestnetChain, arcMainnetChain]) {
      expect(chain.nativeCurrency.symbol).toBe('USDC');
      expect(chain.nativeCurrency.decimals).toBe(6);
    }
  });

  it('keeps the chain ids the rest of the app already uses', () => {
    expect(arcTestnetChain.id).toBe(ARC_TESTNET.id);
    expect(arcMainnetChain.id).toBe(ARC_MAINNET.id);
    expect(arcTestnetChain.id).toBe(5042002);
    expect(arcMainnetChain.id).toBe(5042);
  });

  it('carries an RPC url, because a wallet cannot add a chain without one', () => {
    expect(arcTestnetChain.rpcUrls.default.http[0]).toMatch(/^https?:\/\//);
    expect(arcMainnetChain.rpcUrls.default.http[0]).toMatch(/^https?:\/\//);
  });

  it('declares an explorer for testnet and none for mainnet, matching chain.ts', () => {
    expect(arcTestnetChain.blockExplorers?.default.url).toBe(ARC_TESTNET.explorerUrl);
    // Mainnet's explorer is unverified in this repo, so it is absent rather than guessed.
    expect(ARC_MAINNET.explorerUrl).toBe('');
    expect(arcMainnetChain.blockExplorers).toBeUndefined();
  });

  it('defaults to testnet, so a misconfigured build cannot transact on mainnet', () => {
    expect(ACTIVE_CHAIN.id).toBe(arcTestnetChain.id);
    expect(ACTIVE_CHAIN.testnet).toBe(true);
  });
});
