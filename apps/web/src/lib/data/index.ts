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
 *
 * Both endpoint variables go through `readPublicEndpoint`, which refuses a URL
 * that looks like it carries an API key. `NEXT_PUBLIC_*` values are inlined into
 * the browser bundle, and The Graph's gateway carries its key as a path segment
 * (`/api/<API_KEY>/subgraphs/id/<ID>`), so a working gateway URL pasted in here
 * would be served to every visitor. The refusal is a throw, at module load, which
 * fails the build rather than shipping the key — see `public-env.ts` for why that
 * is louder than a warning, and for the two supported alternatives.
 */

import { createFixtureSource } from './fixture-source';
import { createLiveSource } from './live';
import { readPublicEndpoint } from './public-env';
import type { DataSource } from './types';

function fromEnvironment(): DataSource {
  // The `process.env.NEXT_PUBLIC_*` reads stay as literal member expressions here
  // because that is the form Next's compiler substitutes at build time.
  const subgraphUrl = readPublicEndpoint(
    'NEXT_PUBLIC_HUNCH_SUBGRAPH_URL',
    process.env.NEXT_PUBLIC_HUNCH_SUBGRAPH_URL,
  );
  const erc8004SubgraphUrl = readPublicEndpoint(
    'NEXT_PUBLIC_ERC8004_SUBGRAPH_URL',
    process.env.NEXT_PUBLIC_ERC8004_SUBGRAPH_URL,
  );

  if (subgraphUrl === undefined) return createFixtureSource();

  const marketIds = (process.env.NEXT_PUBLIC_HUNCH_MARKET_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '');

  return createLiveSource({
    subgraphUrl,
    marketIds,
    ...(erc8004SubgraphUrl === undefined ? {} : { erc8004SubgraphUrl }),
    wallet: null,
  });
}

export const dataSource: DataSource = fromEnvironment();

export { createFixtureSource } from './fixture-source';
export { createLiveSource } from './live';
export { keyedUrlReason, PublicEnvError, readPublicEndpoint } from './public-env';
export * from './types';
