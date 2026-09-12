/**
 * Chain facts and explorer links.
 *
 * These are duplicated from `@hunch-vpm/client` rather than imported, because
 * this app has to typecheck and build before that package has been compiled —
 * which is the state on a fresh clone, and the state in CI, where `typecheck`
 * runs before `build`. The live data adapter loads the client at runtime; see
 * `src/lib/data/live.ts` for that boundary and the reason for it.
 */

export interface ChainFacts {
  id: number;
  name: string;
  explorerUrl: string;
  /** CAIP-2, as The Graph lists it for Arc. */
  caip2: string;
  /** The Graph's network slug, which is what a subgraph manifest names. */
  graphSlug: string;
  testnet: boolean;
}

export const ARC_TESTNET: ChainFacts = {
  id: 5042002,
  name: 'Arc Testnet',
  explorerUrl: 'https://testnet.arcscan.app',
  caip2: 'eip155:5042002',
  graphSlug: 'arc-testnet',
  testnet: true,
};

export const ARC_MAINNET: ChainFacts = {
  id: 5042,
  name: 'Arc',
  // No mainnet explorer URL has been verified for this repo, so mainnet links
  // are suppressed rather than guessed.
  explorerUrl: '',
  caip2: 'eip155:5042',
  graphSlug: 'arc',
  testnet: false,
};

/** USDC is the native gas token on Arc, at a fixed address, 6 decimals through ERC-20. */
export const ARC_USDC = '0x3600000000000000000000000000000000000000';

/**
 * PLACEHOLDER. Nothing of ours is deployed yet. Every address below that reads
 * as the zero address is a placeholder the UI labels as such rather than
 * linking into an explorer that has nothing to show.
 */
export const UNDEPLOYED = '0x0000000000000000000000000000000000000000';

export interface ContractAddresses {
  vestedParimutuel: string;
  classicParimutuel: string;
  marketFactory: string;
  feedResolver: string;
  usdc: string;
  identityRegistry: string;
  reputationRegistry: string;
  validationRegistry: string;
  storkOracle: string;
}

export const ARC_TESTNET_ADDRESSES: ContractAddresses = {
  // PLACEHOLDER until the settlers land in deployments/arc-testnet.json.
  vestedParimutuel: UNDEPLOYED,
  classicParimutuel: UNDEPLOYED,
  marketFactory: UNDEPLOYED,
  feedResolver: UNDEPLOYED,
  usdc: ARC_USDC,
  // ERC-8004 registries are live on Arc testnet and are not ours to deploy.
  identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
  validationRegistry: '0x8004Cb1BF31DAf7788923b405b754f57acEB4272',
  storkOracle: '0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62',
};

export function isDeployed(address: string): boolean {
  return address.toLowerCase() !== UNDEPLOYED;
}

/**
 * An explorer URL, or `null` when there is nothing worth linking to: a zero
 * placeholder, or a chain whose explorer we have not verified. Returning
 * `null` lets the caller render plain text instead of a link that 404s.
 */
export function addressExplorerUrl(address: string, chain: ChainFacts = ARC_TESTNET): string | null {
  if (chain.explorerUrl === '' || !isDeployed(address)) return null;
  return `${chain.explorerUrl}/address/${address}`;
}

export function txExplorerUrl(hash: string, chain: ChainFacts = ARC_TESTNET): string | null {
  if (chain.explorerUrl === '') return null;
  return `${chain.explorerUrl}/tx/${hash}`;
}
