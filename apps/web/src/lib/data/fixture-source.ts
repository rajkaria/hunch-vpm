/**
 * The default data source: the fixture dataset, served through the same
 * interface the live one implements.
 *
 * Every page renders completely from this with no network, no subgraph and no
 * deployed contracts, which is what makes the surface reviewable before the
 * chain side lands and what makes the tests deterministic.
 */

import { buildFixtures, FIXTURE_WALLET } from './fixtures';
import type { AgentRow, ClaimableView, DataSource, MarketDetail, MarketSummary } from './types';

export interface FixtureSourceOptions {
  /**
   * The moment the dataset is built, in unix seconds. Defaults to the wall
   * clock; tests pass a fixed value so every derived number is pinned.
   */
  now?: bigint;
  /** The wallet whose positions the surface shows. `null` renders the disconnected state. */
  wallet?: string | null;
}

export function createFixtureSource(options: FixtureSourceOptions = {}): DataSource {
  const wallet = options.wallet === undefined ? FIXTURE_WALLET : options.wallet;
  const at = (): bigint => options.now ?? BigInt(Math.floor(Date.now() / 1000));

  return {
    kind: 'fixture',

    async listMarkets(): Promise<MarketSummary[]> {
      return sortForBoard(buildFixtures(at()).markets);
    },

    async getMarket(id: string): Promise<MarketDetail | null> {
      const market = buildFixtures(at()).markets.find((candidate) => candidate.id === id);
      if (market === undefined) return null;
      // A disconnected reader has no positions, not somebody else's.
      return wallet === null ? { ...market, positions: [] } : market;
    },

    async listAgents(): Promise<AgentRow[]> {
      return [...buildFixtures(at()).agents].sort(byPnlThenAccepted);
    },

    async getClaimable(forWallet: string): Promise<ClaimableView> {
      const data = buildFixtures(at());
      if (forWallet.toLowerCase() !== data.wallet.toLowerCase()) {
        return {
          wallet: forWallet,
          totals: { settlement: 0n, voidRefund: 0n, refusedRemainder: 0n, residue: 0n, total: 0n },
          items: [],
          blockedResidue: [],
          index: data.claimable.index,
        };
      }
      return data.claimable;
    },

    currentWallet(): string | null {
      return wallet;
    },
  };
}

/**
 * Open markets first, then the ones awaiting a resolver, then what is settled;
 * within each group, the one closing soonest is the one a reader wants.
 */
function sortForBoard(markets: MarketDetail[]): MarketSummary[] {
  const rank = (market: MarketDetail): number => {
    if (market.status === 'Open' && !market.frozen) return 0;
    if (market.status === 'Open') return 1;
    return 2;
  };
  return [...markets].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return a.resolutionTime < b.resolutionTime ? -1 : a.resolutionTime > b.resolutionTime ? 1 : 0;
  });
}

function byPnlThenAccepted(a: AgentRow, b: AgentRow): number {
  if (a.realizedPnl !== b.realizedPnl) return a.realizedPnl > b.realizedPnl ? -1 : 1;
  if (a.acceptedPrincipal !== b.acceptedPrincipal) return a.acceptedPrincipal > b.acceptedPrincipal ? -1 : 1;
  return a.handle.localeCompare(b.handle);
}
