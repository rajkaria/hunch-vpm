/**
 * @hunch-vpm/client — typed reads from The Graph and unsigned writes through viem.
 *
 * This package never holds a private key and never signs a transaction. The
 * write helpers return calldata for the caller's own wallet to sign and send.
 */

export { createHunchClient } from './client.js';
export type { HunchClient } from './client.js';

export { defineConfig, gatewayUrl, DEFAULT_PAGE_SIZE } from './config.js';
export type { HunchClientConfig, ResolvedConfig } from './config.js';

export { arcMainnet, arcTestnet, CAIP2, GRAPH_NETWORK_SLUG } from './chains.js';
export {
  ARC_USDC,
  DEFAULT_ADDRESSES,
  UNDEPLOYED,
  assertDeployed,
  defaultAddressesFor,
} from './addresses.js';
export type { HunchAddresses } from './addresses.js';

export { fetchTransport, GraphQLHttpError, GraphQLRequestError } from './transport.js';
export type { FetchLike, FetchTransportOptions, GraphQLRequest, GraphQLTransport } from './transport.js';

export { bestHeadroom } from './reads/bestHeadroom.js';
export type { BestHeadroomOptions } from './reads/bestHeadroom.js';
export { impliedOdds, impliedOddsFor } from './reads/impliedOdds.js';
export { counterpartyTrust, subgraphReputationLookup } from './reads/counterpartyTrust.js';
export type { CounterpartyTrustOptions, ReputationLookup } from './reads/counterpartyTrust.js';
export { vestingEarned } from './reads/vestingEarned.js';
export { claimable } from './reads/claimable.js';
export { marketBook } from './reads/marketBook.js';
export type { MarketBookOptions } from './reads/marketBook.js';
export { NotFoundError } from './reads/shared.js';

export {
  approveCalldata,
  claimCalldata,
  claimResidueCalldata,
  enterCalldata,
  openMarketCalldata,
  withdrawRefundCalldata,
} from './writes/calldata.js';
export type {
  ApproveParams,
  CalldataContext,
  EnterParams,
  OpenMarketParams,
  PositionParams,
  ResidueParams,
  UnsignedCall,
} from './writes/calldata.js';
export { erc20Abi, feedResolverAbi, marketFactoryAbi, settlerAbi } from './writes/abi.js';

export {
  bookHeadroom,
  competingDemand,
  earnedVesting,
  opposingRoom,
  outcomeHeadroom,
  payoutIfWins,
  totalPrincipal,
} from './mechanics.js';

export {
  ACC_SCALE,
  KAPPA_UNBOUNDED,
  UNBOUNDED_SENTINEL,
  PPM,
  PRICE_DECIMALS,
  USDC_DECIMALS,
  formatPrice,
  formatUnitsExact,
  formatUsdc,
  maxBigInt,
  minBigInt,
  parseUnitsExact,
  parseUsdc,
  ppmToPercent,
  shareToPpm,
} from './units.js';
export type { FormatOptions } from './units.js';

export { DecodeError, sameAddress } from './decode.js';
export type { PositionHolding, UnclaimedWinner } from './decode.js';

export type {
  AgentReputation,
  BestHeadroom,
  BlockedResidue,
  Book,
  BookView,
  ClaimBreakdown,
  ClaimReason,
  Claimable,
  ClaimableItem,
  Counterparty,
  CounterpartyTrust,
  FeedDirection,
  ImpliedOdds,
  IndexStatus,
  Market,
  MarketBook,
  MarketStatus,
  OpposingBookRoom,
  OpposingSideTrust,
  OutcomeHeadroom,
  OutcomeOdds,
  Position,
  PositionState,
  ResolutionSpec,
  SettlerKind,
  VestingEarned,
} from './types.js';
