import { defineChain } from 'viem';

import { ARC_MAINNET, ARC_TESTNET, type ChainFacts } from '@/lib/chain';

/*
 * Arc as viem chains.
 *
 * Two facts about this chain drive everything below and are easy to get wrong:
 *
 * 1. **USDC is the native gas token**, at 6 decimals — not 18. A wallet told
 *    otherwise displays every gas estimate off by twelve orders of magnitude,
 *    so `nativeCurrency.decimals` is 6 and that is not a typo.
 * 2. **Neither chain id ships in any wallet.** 5042002 and 5042 are unknown to
 *    MetaMask and to every other injected provider, so connecting is never
 *    enough on its own — the app has to be able to *add* the chain, which is
 *    why `rpcUrls` and `blockExplorers` are populated rather than left to the
 *    wallet to already know.
 *
 * The RPC URL is overridable from the environment because a public endpoint
 * may be rate limited and an operator will want their own. It is a URL and not
 * a secret — unless a provider embeds a key in it, which is why it is read from
 * a `NEXT_PUBLIC_` variable only as a last resort and defaults to the public one.
 */

const ARC_TESTNET_RPC =
  process.env['NEXT_PUBLIC_ARC_TESTNET_RPC_URL'] ?? 'https://rpc.testnet.arc.network';

const ARC_MAINNET_RPC = process.env['NEXT_PUBLIC_ARC_RPC_URL'] ?? 'https://rpc.arc.network';

function nativeUsdc() {
  // Named "USD Coin" rather than "Ether" so a wallet's send screen does not lie
  // about what the user is spending.
  return { name: 'USD Coin', symbol: 'USDC', decimals: 6 } as const;
}

export const arcTestnetChain = defineChain({
  id: ARC_TESTNET.id,
  name: ARC_TESTNET.name,
  nativeCurrency: nativeUsdc(),
  rpcUrls: { default: { http: [ARC_TESTNET_RPC] } },
  blockExplorers: {
    default: { name: 'Arcscan', url: ARC_TESTNET.explorerUrl },
  },
  testnet: true,
});

export const arcMainnetChain = defineChain({
  id: ARC_MAINNET.id,
  name: ARC_MAINNET.name,
  nativeCurrency: nativeUsdc(),
  rpcUrls: { default: { http: [ARC_MAINNET_RPC] } },
  // No mainnet explorer has been verified for this repo, so none is declared
  // rather than guessed — `addressExplorerUrl` suppresses those links already.
  testnet: false,
});

/**
 * The chain this deployment transacts on.
 *
 * One chain at a time, chosen at build time. A venue that silently follows
 * whatever chain the wallet happens to be on is a venue that will eventually
 * send an approval to the wrong USDC.
 */
export const ACTIVE_CHAIN =
  process.env['NEXT_PUBLIC_ARC_NETWORK'] === 'mainnet' ? arcMainnetChain : arcTestnetChain;

export const ACTIVE_CHAIN_FACTS: ChainFacts =
  process.env['NEXT_PUBLIC_ARC_NETWORK'] === 'mainnet' ? ARC_MAINNET : ARC_TESTNET;
