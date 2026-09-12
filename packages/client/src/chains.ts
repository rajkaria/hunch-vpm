import { defineChain } from 'viem';

/**
 * Arc's gas token is USDC itself, exposed at a fixed address behind the ERC-20
 * interface where it reports 6 decimals. We record that here as display
 * metadata only: stake never moves as native value in this protocol, it moves
 * through `transferFrom`, so nothing in this package denominates an amount in
 * `nativeCurrency`.
 */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
});

/**
 * Arc mainnet. No public RPC URL is recorded in this repo's verified chain
 * facts, so the list is empty on purpose — supply your own rather than trust a
 * guess that was never checked against the network.
 */
export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [] } },
  testnet: false,
});

/**
 * The Graph's network slug for each chain, which is what a subgraph manifest's
 * `dataSources[].network` has to say.
 */
export const GRAPH_NETWORK_SLUG = {
  [arcTestnet.id]: 'arc-testnet',
  [arcMainnet.id]: 'arc',
} as const satisfies Record<number, string>;

/** CAIP-2 identifiers, as The Graph lists them for Arc. */
export const CAIP2 = {
  [arcTestnet.id]: 'eip155:5042002',
  [arcMainnet.id]: 'eip155:5042',
} as const satisfies Record<number, string>;
