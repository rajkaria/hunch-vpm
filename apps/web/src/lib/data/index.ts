/**
 * Which data source the pages read.
 *
 * This is the file. Every page imports `dataSource` from here and nothing else
 * in the app knows whether the numbers came from a fixture or from the chain,
 * so pointing the surface at live data is a change to this module and to the
 * environment it reads — not to any page, component or calculation.
 *
 * The fixture source is the default on purpose: the contracts are not deployed
 * and the subgraph is not published, and a surface that renders nothing until
 * they are cannot be reviewed, designed against, or tested.
 */

import { createFixtureSource } from './fixture-source';
import { createLiveSource } from './live';
import type { DataSource } from './types';

function fromEnvironment(): DataSource {
  const subgraphUrl = process.env.NEXT_PUBLIC_HUNCH_SUBGRAPH_URL;
  if (subgraphUrl === undefined || subgraphUrl === '') return createFixtureSource();

  const marketIds = (process.env.NEXT_PUBLIC_HUNCH_MARKET_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');

  const erc8004SubgraphUrl = process.env.NEXT_PUBLIC_ERC8004_SUBGRAPH_URL;

  return createLiveSource({
    subgraphUrl,
    marketIds,
    ...(erc8004SubgraphUrl === undefined || erc8004SubgraphUrl === ''
      ? {}
      : { erc8004SubgraphUrl }),
    wallet: null,
  });
}

export const dataSource: DataSource = fromEnvironment();

export { createFixtureSource } from './fixture-source';
export { createLiveSource } from './live';
export * from './types';
