'use client';

import { PositionPanel } from '@/components/market/PositionPanel';
import { EmptyState } from '@/components/ui/primitives';
import { dataSourceKinds } from '@/lib/data/kind';
import type { MarketDetail } from '@/lib/data/types';
import { useNetwork } from '@/lib/wallet/network';
import { truncateAddress, useWallet } from '@/lib/wallet/useWallet';

/**
 * Who "your position" belongs to.
 *
 * `MarketDetail.positions` is filled server-side for whatever address the data
 * source is reading for. On fixtures that is a sample wallet, which means the
 * panel underneath was showing a stranger's position to every visitor and
 * calling it theirs. That is the one thing a position panel must never do, so
 * this gate stands in front of it.
 *
 * With a wallet connected and the surface on fixtures, the positions shown are
 * still the sample wallet's, and it says so rather than implying they are the
 * visitor's. Reading real positions per address needs a per-address market
 * query the data source does not have yet — see REPORT.md.
 */
export function PositionGate({ market }: { market: MarketDetail }) {
  const wallet = useWallet();
  const { network } = useNetwork();

  if (wallet.address === null) {
    return (
      <EmptyState title="Connect a wallet to see your position.">
        Positions belong to an address: the settler pays whoever owns the position, so there is
        nothing to show here until this page knows who you are.
      </EmptyState>
    );
  }

  if (dataSourceKinds[network] === 'fixture') {
    return (
      <div>
        <p className="border-b border-edge px-4 py-3 text-xs leading-snug text-faint sm:px-5">
          Connected as <span className="num text-muted">{truncateAddress(wallet.address)}</span>.
          The position below belongs to the sample wallet, not to you — this network&rsquo;s index
          is not connected, so there is nothing on-chain to read for your address here.
        </p>
        <PositionPanel market={market} />
      </div>
    );
  }

  return <PositionPanel market={market} />;
}
