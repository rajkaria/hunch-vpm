'use client';

import { useNetwork } from '@/lib/wallet/network';

/**
 * The unaudited warning, shown on mainnet and only on mainnet.
 *
 * `FeedResolver`, `MarketFactory`, `ClassicParimutuel` and the oracle adapters
 * are new code written for this repository and have never been audited, and
 * they hold user funds. `VestedParimutuel` is vendored from the paper with 118
 * conformance vectors, which is evidence and not an audit either.
 *
 * It is deliberately not dismissible. A warning someone can close is a warning
 * that stops existing for the person most likely to need it, and the risk does
 * not go away when the banner does.
 */
export function MainnetNotice() {
  const { network, hydrated } = useNetwork();

  if (!hydrated || network !== 'mainnet') return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-card border border-coral/40 bg-coral/10 px-4 py-3.5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center rounded-tag border border-coral/40 bg-coral/15 px-2.5 py-1 text-[11px] leading-none font-semibold tracking-[0.05em] text-coral uppercase">
          Unaudited
        </span>
        <span className="text-sm font-semibold text-paper">
          These contracts have not been audited.
        </span>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        You are on Arc mainnet, where stake is real USDC. The settlement layer here is new code
        that has never been through a security review — a bug in it could lose everything staked,
        and there is no recourse and no operator who can reverse a settlement. The venue holds no
        key and cannot move your funds, but that is a property of the code, and the code is what
        has not been reviewed. Stake nothing you are not prepared to lose outright, and prefer
        <strong className="font-semibold text-paper"> Arc Testnet</strong> if you only want to see
        how it works.
      </p>
    </div>
  );
}
