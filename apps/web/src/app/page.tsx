import Link from 'next/link';

import { MarketCard } from '@/components/market/MarketCard';
import { Amount, EmptyState, Stat } from '@/components/ui/primitives';
import { dataSource } from '@/lib/data';
import type { MarketSummary } from '@/lib/data/types';

// The board is rebuilt on a short cycle rather than on every request: the
// numbers move when a block lands, not when someone refreshes, and the
// countdown on each card is a client clock reading an absolute deadline.
export const revalidate = 30;

export default async function MarketsPage() {
  const markets = await dataSource.listMarkets();
  const open = markets.filter((market) => market.status === 'Open' && !market.frozen);
  const awaiting = markets.filter((market) => market.status === 'Open' && market.frozen);
  const settled = markets.filter((market) => market.status !== 'Open');

  const pool = markets.reduce((total, market) => total + market.acceptedPool, 0n);

  return (
    <div>
      <section className="mb-8 border border-edge bg-raised">
        <div className="grid gap-6 px-5 py-6 sm:px-6 md:grid-cols-[1.6fr_1fr] md:items-end">
          <div>
            <h1 className="max-w-xl text-3xl leading-[1.05] sm:text-4xl">
              Stake vests the moment it lands.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              A classic pool pays money that arrives one second before the freeze the same multiple as money
              that was there from the start. This one does not. Stake on an outcome vests into the opposing
              books immediately, and it is accepted only up to the room those books have to cover it.{' '}
              <Link href="/docs" className="text-paper underline decoration-lime decoration-2 underline-offset-4">
                How it works
              </Link>
              .
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-5 md:justify-items-end">
            <Stat label="Markets open">
              <span className="num">{open.length}</span>
            </Stat>
            <Stat label="Accepted principal">
              <Amount value={pool} />
            </Stat>
          </dl>
        </div>
      </section>

      <Section
        title="Open"
        hint="Taking stake until the freeze."
        markets={open}
        empty="No market is taking stake right now."
        emptyBody="Markets open with a seed on every outcome, and stay open until the freeze their creator fixed. When the next one opens it appears here."
      />

      {awaiting.length > 0 ? (
        <Section
          title="Awaiting resolution"
          hint="Frozen. Anyone can call the resolver; the feed decides, not a person."
          markets={awaiting}
        />
      ) : null}

      {settled.length > 0 ? (
        <Section title="Settled" hint="Resolved from the feed, or voided and refunded." markets={settled} />
      ) : null}
    </div>
  );
}

function Section({
  title,
  hint,
  markets,
  empty,
  emptyBody,
}: {
  title: string;
  hint: string;
  markets: MarketSummary[];
  empty?: string;
  emptyBody?: string;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
        <span className="num ml-auto text-sm text-faint">{markets.length}</span>
      </div>

      {markets.length === 0 ? (
        empty === undefined ? null : <EmptyState title={empty}>{emptyBody}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </section>
  );
}
