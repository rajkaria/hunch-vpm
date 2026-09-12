import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/positions/route';
import { createFixtureSource } from '@/lib/data/fixture-source';
import { createLiveSource } from '@/lib/data/live';

const NOW = 1_789_000_000n;

describe('getPositions on the fixture source', () => {
  it('returns every position the sample wallet holds, across markets', async () => {
    const source = createFixtureSource({ now: NOW });
    const wallet = source.currentWallet()!;
    const entries = await source.getPositions(wallet);

    expect(entries.length).toBeGreaterThan(0);
    // A portfolio spans markets — that is the whole reason it exists separately
    // from the per-market panel.
    expect(new Set(entries.map((entry) => entry.market.id)).size).toBeGreaterThan(1);
  });

  it('is newest first', async () => {
    const source = createFixtureSource({ now: NOW });
    const entries = await source.getPositions(source.currentWallet()!);
    const times = entries.map((entry) => entry.position.enteredAt);
    expect([...times].sort((a, b) => Number(b - a))).toEqual(times);
  });

  it('gives another address nothing rather than the sample wallet’s positions', async () => {
    const source = createFixtureSource({ now: NOW });
    expect(await source.getPositions('0x000000000000000000000000000000000000dead')).toEqual([]);
  });

  it('pairs each position with a market that carries its outcome labels', async () => {
    const source = createFixtureSource({ now: NOW });
    const [first] = await source.getPositions(source.currentWallet()!);
    const labelled = first!.market.outcomes.find((o) => o.outcome === first!.position.outcome);
    expect(labelled?.label).toBeTruthy();
  });
});

describe('getPositions on the live source', () => {
  it('returns nothing, because the client has no positions-by-owner read', async () => {
    // Stated, not silently broken. If the client ever grows that read this test
    // should fail and be replaced — see REPORT.md.
    const source = createLiveSource({ subgraphUrl: 'https://example.invalid', marketIds: [], wallet: null });
    expect(await source.getPositions('0x000000000000000000000000000000000000dead')).toEqual([]);
  });
});

describe('/api/positions', () => {
  const ok = (address: string) => GET(new Request(`http://x/api/positions?address=${address}`));

  it('refuses anything that is not an address', async () => {
    expect((await ok('nope')).status).toBe(400);
    expect((await GET(new Request('http://x/api/positions'))).status).toBe(400);
  });

  it('answers with every amount as a decimal string', async () => {
    const response = await ok('0x6D2a4c1b9E0f3A8d5C7b2E1f4A9c8B3d6E5f0a42');
    expect(response.status).toBe(200);
    const body = await response.json();
    for (const entry of body.entries) {
      expect(typeof entry.position.offered).toBe('string');
      expect(typeof entry.position.accepted).toBe('string');
      expect(typeof entry.position.refused).toBe('string');
    }
  });

  it('never lets one visitor cache another’s positions', async () => {
    const response = await ok('0x6D2a4c1b9E0f3A8d5C7b2E1f4A9c8B3d6E5f0a42');
    expect(response.headers.get('cache-control')).toMatch(/private/);
  });

  it('says which source answered, so the empty state can explain itself', async () => {
    const body = await (await ok('0x6D2a4c1b9E0f3A8d5C7b2E1f4A9c8B3d6E5f0a42')).json();
    expect(['fixture', 'live']).toContain(body.source);
  });
});
