import { NextResponse } from 'next/server';

import { dataSource } from '@/lib/data';

/*
 * Positions for one address. Same shape of decision as /api/claimable: the
 * browser knows the address, the server holds the endpoint and its key, and
 * every bigint crosses as a decimal string.
 */

export const dynamic = 'force-dynamic';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get('address');

  if (address === null || !ADDRESS.test(address)) {
    return NextResponse.json({ error: 'A 20-byte hex address is required.' }, { status: 400 });
  }

  try {
    const entries = await dataSource.getPositions(address);
    return NextResponse.json(
      {
        source: dataSource.kind,
        entries: entries.map((entry) => ({
          market: {
            id: entry.market.id,
            question: entry.market.question,
            subject: entry.market.subject,
            status: entry.market.status,
            frozen: entry.market.frozen,
            settlerKind: entry.market.settlerKind,
            winner: entry.market.winner,
            resolutionTime: entry.market.resolutionTime.toString(),
            outcomes: entry.market.outcomes.map((outcome) => ({
              outcome: outcome.outcome,
              label: outcome.label,
              tone: outcome.tone,
            })),
          },
          position: {
            id: entry.position.id,
            positionId: entry.position.positionId.toString(),
            outcome: entry.position.outcome,
            offered: entry.position.offered.toString(),
            accepted: entry.position.accepted.toString(),
            refused: entry.position.refused.toString(),
            enteredAt: entry.position.enteredAt.toString(),
          },
        })),
      },
      { headers: { 'cache-control': 'private, max-age=5' } },
    );
  } catch (error) {
    console.error('positions lookup failed', error);
    return NextResponse.json({ error: 'The index could not be reached.' }, { status: 502 });
  }
}
