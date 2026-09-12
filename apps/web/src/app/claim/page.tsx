import type { Metadata } from 'next';
import Link from 'next/link';

import { AddressLink } from '@/components/market/AddressLink';
import { Amount, EmptyState, Panel, PanelHeader, Stat } from '@/components/ui/primitives';
import { isDeployed } from '@/lib/chain';
import { dataSource } from '@/lib/data';
import type { ClaimReason, ClaimableItem, ClaimableView } from '@/lib/data/types';
import { shortAddress } from '@/lib/units';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'Claim',
  description: 'Pull settlements, void refunds, refused remainders and residue. One transaction per row.',
};

const REASONS: { key: ClaimReason; label: string; hint: string }[] = [
  {
    key: 'settlement',
    label: 'Settlement',
    // This total spans both settlers, so it cannot promise the vested rule's
    // arithmetic: a classic market in the list pays a share of the whole pool.
    hint: 'What the settler pays a winning position on a market that resolved your way, under that market’s own rule.',
  },
  {
    key: 'voidRefund',
    label: 'Void refund',
    hint: 'A market that ended without an answer refunds every position at its accepted principal.',
  },
  {
    key: 'refusedRemainder',
    label: 'Refused remainder',
    hint: 'Stake the opposing books had no room to cover. It was never at risk and it is yours to pull back.',
  },
  {
    key: 'residue',
    label: 'Residue',
    hint: 'The sub-unit remainder flooring leaves behind, sweepable by the owner named at the market’s creation.',
  },
];

export default async function ClaimPage() {
  const wallet = dataSource.currentWallet();

  if (wallet === null) {
    return (
      <div>
        <Header />
        <EmptyState title="No wallet connected.">
          Claims are per position and per address: the settler pays the owner of the position, and nothing here
          can tell what you hold until it knows who you are.
        </EmptyState>
      </div>
    );
  }

  const claimable = await dataSource.getClaimable(wallet);

  return (
    <div>
      <Header wallet={wallet} />

      <Panel className="mb-6">
        <PanelHeader title="Ready to pull" hint="Split by why it is owed." />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 px-4 py-5 sm:grid-cols-4 sm:px-5">
          {REASONS.map((reason) => (
            <Stat key={reason.key} label={reason.label} hint={reason.hint}>
              <Amount
                value={claimable.totals[reason.key]}
                className={claimable.totals[reason.key] > 0n ? '' : 'text-muted'}
              />
            </Stat>
          ))}
        </dl>
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-edge px-4 py-4 sm:px-5">
          <span className="text-sm text-muted">Total</span>
          <span className="text-2xl leading-none">
            <Amount value={claimable.totals.total} />
            <span className="ml-2 text-sm text-muted">USDC</span>
          </span>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Transactions"
          hint="One row is one transaction. `claim` pays a settlement and any outstanding refused remainder together, so sending it twice reverts."
        />
        {claimable.items.length === 0 ? (
          <EmptyState title="Nothing to pull right now.">
            Settlements appear once a market resolves, refused remainders as soon as the block&rsquo;s vintage is
            finalized, and void refunds when a market ends without an answer.{' '}
            <Link href="/" className="text-paper underline decoration-lime decoration-2 underline-offset-4">
              Find a market
            </Link>
            .
          </EmptyState>
        ) : (
          <ul className="divide-y divide-edge">
            {claimable.items.map((item) => (
              <ClaimRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Panel>

      {claimable.blockedResidue.length > 0 ? (
        <Panel className="mt-6">
          <PanelHeader
            title="Residue you own but cannot sweep yet"
            hint="The sum of the floors is not known until the last winner has claimed, so the gate is every winning position, not a timer."
          />
          <ul className="divide-y divide-edge">
            {claimable.blockedResidue.map((entry) => (
              <li key={entry.marketId} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <Link href={`/m/${entry.marketId}`} className="text-sm hover:underline">
                    {entry.question}
                  </Link>
                  <p className="mt-1 text-xs text-muted">{entry.reason}</p>
                </div>
                <Amount value={entry.amount} fractionDigits={6} className="text-muted" />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <IndexNote claimable={claimable} />
    </div>
  );
}

function Header({ wallet }: { wallet?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl sm:text-3xl">Claim</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Every payout here is pull-based: the settler never pushes money at anyone, so nothing depends on a
        transfer succeeding in a transaction you did not send.
        {wallet === undefined ? null : (
          <>
            {' '}
            Reading for <span className="num text-paper">{shortAddress(wallet)}</span>.
          </>
        )}
      </p>
    </header>
  );
}

function ClaimRow({ item }: { item: ClaimableItem }) {
  const parts = REASONS.filter((reason) => item.breakdown[reason.key] > 0n);
  const deployed = isDeployed(item.settler);

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <Link href={`/m/${item.marketId}`} className="text-sm hover:underline">
          {item.question}
        </Link>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="num border border-edge px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em]">
            {item.call}({item.argument.toString()})
          </span>
          {parts.map((part) => (
            <span key={part.key}>
              {part.label} <Amount value={item.breakdown[part.key]} className="text-paper" />
            </span>
          ))}
          <AddressLink address={item.settler} className="text-xs" />
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <Amount value={item.amount} className="text-lg" />
        {deployed ? (
          <button
            type="button"
            className="border border-lime px-3.5 py-2 text-sm font-semibold text-lime transition-colors hover:bg-lime hover:text-ink"
          >
            Pull
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-describedby={`undeployed-${item.id}`}
              className="cursor-not-allowed border border-edge px-3.5 py-2 text-sm font-semibold text-faint"
            >
              Pull
            </button>
            <p id={`undeployed-${item.id}`} className="max-w-[13rem] text-right text-xs leading-snug text-muted">
              The settler is not deployed yet, so there is no transaction to send.
            </p>
          </>
        )}
      </div>
    </li>
  );
}

function IndexNote({ claimable }: { claimable: ClaimableView }) {
  return (
    <p className="mt-6 text-xs text-faint">
      {claimable.index.source === 'fixture'
        ? 'Sample data. Amounts are computed from the same books the market pages show.'
        : `Indexed to block ${claimable.index.block.toString()}.`}
      {claimable.index.hasIndexingErrors
        ? ' The indexer reported errors, so this may be incomplete — check the market page before sending anything.'
        : ''}
    </p>
  );
}
