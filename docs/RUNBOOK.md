# Runbook

How to run this repo locally, put it on Arc testnet, index it, serve it, open a market,
resolve one, and handle the feed going quiet. Every command here exists in the repo or in a
tool the repo already depends on.

**Deployed today:** the web surface only, at <https://hunch-vpm.vercel.app>, serving the
fixture dataset. Nothing on-chain and neither subgraph is deployed: every contract address in
committed configuration is `0x0000000000000000000000000000000000000000`, on purpose, and every
step below that needs a real address says which file to put it in.

- [What you need installed](#what-you-need-installed)
- [Local development from a clean clone](#local-development-from-a-clean-clone)
- [Deploying the contracts to Arc testnet](#deploying-the-contracts-to-arc-testnet)
- [Wiring the addresses through](#wiring-the-addresses-through)
- [Deploying the subgraphs](#deploying-the-subgraphs)
- [Deploying the web surface](#deploying-the-web-surface)
- [Opening a market](#opening-a-market)
- [Resolving a market](#resolving-a-market)
- [When the feed goes stale](#when-the-feed-goes-stale)
- [Substreams](#substreams)
- [Secrets](#secrets)

---

## What you need installed

| Tool | Version | Needed for |
|---|---|---|
| Node | 20 or later | everything TypeScript. CI runs 22; this runbook was checked on 25.9.0 |
| pnpm | 10.33.0 | the workspace. `corepack enable` picks it up from `packageManager` in the root `package.json` |
| Foundry | 1.5.1 or later | `forge build`, `forge test`, `forge script`, `cast` |
| Rust + `wasm32-unknown-unknown` | stable | the Substreams package only |
| Python 3 | any | `make verify-vendored-proto` in the Substreams package only |

`graph-cli` and `matchstick` are dependencies of the two subgraph packages, so `pnpm install`
brings them; nothing is needed globally. The `substreams` CLI is only needed to pack, run or
deploy that package — building, testing and linting it do not.

## Local development from a clean clone

```sh
git clone --recurse-submodules <repo> hunch-vpm
cd hunch-vpm
corepack enable
pnpm install
```

`contracts/lib/forge-std` is a pinned git submodule — it is the one path `contracts/lib/` is
gitignored *except* for. `--recurse-submodules` fetches it with the clone; if you cloned
without the flag, `forge build` fails until you fetch it:

```sh
git submodule update --init --recursive
```

Now the gate:

```sh
pnpm verify
```

That is `scripts/verify.sh`: `forge build`, `forge test`, then `pnpm -r --if-present
typecheck`, `test` and `build` across the workspace, each stage skipped cleanly if the thing
it checks does not exist yet. A green run looks like this:

| Suite | Count | Measured by |
|---|---|---|
| `contracts` (Foundry, 11 suites) | 59 | `forge test --root contracts` |
| `packages/agentkit-tier` (9 files) | 224 | `pnpm --filter @hunch-vpm/agentkit-tier test` |
| `packages/mcp` (14 files) | 182 | `pnpm --filter @hunch-vpm/mcp test` |
| `agent` (10 files) | 185 | `pnpm --filter @hunch-vpm/agent test` |
| `packages/client` (19 files) | 232 | `pnpm --filter @hunch-vpm/client test` |
| `apps/web` (6 files) | 124 | `pnpm --filter @hunch-vpm/web test` |
| `subgraph-erc8004-arc` (node) | 38 | `pnpm --filter @hunch-vpm/subgraph-erc8004-arc test:node` |
| `subgraph-erc8004-arc` (matchstick) | 38 | `pnpm --filter @hunch-vpm/subgraph-erc8004-arc test:matchstick` |
| `subgraph` (matchstick) | 17 | `pnpm --filter @hunch-vpm/subgraph test` |

Every figure above was read off that command's own summary line. **It is a snapshot, and it
goes stale the next time anyone adds a test** — treat the right-hand column as the source of
truth and the middle one as a reading. If you need the current numbers, take ninety seconds and
read them yourself:

```sh
forge test --root contracts | tail -1
for d in packages/agentkit-tier packages/mcp packages/client agent apps/web; do
  printf '%-24s ' "$d"; (cd "$d" && npx vitest run 2>&1 | grep -oE 'Tests +[0-9]+ passed')
done
```

The Substreams package is **not** in `pnpm verify` — it is Rust, it has its own CI job, and it
is checked with `cd substreams && make check`. `cargo test` there reports **91** passing tests.

`subgraph-erc8004-arc`'s `test` script runs `graph codegen` first and `graph test` last, which
means a cold run needs the network: codegen writes `generated/`, which is not committed, and
`graph test` fetches a platform-specific matchstick binary into `tests/.bin/` on first use.

Running individual pieces:

```sh
pnpm --filter @hunch-vpm/web dev                 # http://localhost:3000, fixtures, no network
pnpm --filter @hunch-vpm/agent build             # then: node agent/dist/cli/main.js run
pnpm --filter @hunch-vpm/mcp build               # then: pnpm --filter @hunch-vpm/mcp start
forge test --root contracts -vv
```

The web surface and the agent both default to a mode that needs nothing deployed: the surface
serves a replayed fixture dataset whenever `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` is unset, and the
agent's dry-run mode is its default and holds no key.

## Deploying the contracts to Arc testnet

Arc testnet is chain id `5042002`. USDC is the native gas token at
`0x3600000000000000000000000000000000000000`, 6 decimals through the ERC-20 interface, so the
deployer needs testnet USDC for gas.

`contracts/foundry.toml` already names the endpoints and the verifier:

```toml
[rpc_endpoints]
arc_testnet = "${ARC_TESTNET_RPC_URL}"
arc_mainnet = "${ARC_MAINNET_RPC_URL}"

[etherscan]
arc_testnet = { key = "${ARCSCAN_API_KEY}", url = "https://testnet.arcscan.app/api", chain = 5042002 }
```

So set `ARC_TESTNET_RPC_URL` and `ARCSCAN_API_KEY` in the environment, and deploy:

```sh
ORACLE_KIND=stork \
forge script contracts/script/Deploy.s.sol \
  --root contracts \
  --rpc-url arc_testnet \
  --account <keystore-account> \
  --broadcast \
  --verify
```

The script path is given **relative to the directory you are standing in**, not to `--root`.
From the repository root that is `contracts/script/Deploy.s.sol`; `script/Deploy.s.sol` with
`--root contracts` fails with `contract source info format must be <path>:<contractname>`.
From inside `contracts/`, drop `--root` and the prefix both.

`--account` reads an encrypted Foundry keystore and prompts for the password. Use that, a
hardware wallet (`--ledger`, `--trezor`), or `--interactive`. Do not put a raw key on the
command line: it lands in your shell history.

### The ORACLE_KIND switch

`Deploy.s.sol` picks the `IPriceOracle` adapter from one environment variable, so which
provider ships is configuration rather than a code change.

| `ORACLE_KIND` | Deploys | Notes |
|---|---|---|
| `stork` (default, and anything unrecognised) | `StorkOracle` | Constructor takes Stork's contract. Defaults to `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62`, Stork's published Arc testnet address; override with `STORK_ADDRESS`. Stork is the only provider with a published Arc testnet address today |
| `chainlink` | `ChainlinkFeedOracle` | Needs no address at deploy time — the feed is the per-market `feedKey` |
| `mock` | `MockOracle` | Local chains only. A settable price with a settable timestamp |

The unrecognised-value case falling through to Stork is deliberate but silent: a typo in
`ORACLE_KIND` deploys Stork without complaint. Read the adapter address the script prints
against the one you expected before you go further.

`contracts/test/Deploy.t.sol` covers all three branches.

### Recording the addresses

**`Deploy.s.sol` does not write any file.** It `console.log`s a deployments JSON to stdout and
stops there — `fs_permissions` in `contracts/foundry.toml` grants write access to `./GAS.md`
and nothing else, so the script could not write `deployments/` even if it tried. Creating the
file is a step you do.

The JSON does not come out alone, either. `forge script` wraps it in its own output, indented
two spaces under a `== Logs ==` header:

```
== Logs ==
  {
    "chainId": 5042002,
    "vestedParimutuel": "0x...",
    "classicParimutuel": "0x...",
    "priceOracle": "0x...",
    "feedResolver": "0x...",
    "marketFactory": "0x..."
  }
```

So a bare `> deployments/arc-testnet.json` gives you a file that is not JSON. Capture the run,
then cut the block out of it:

```sh
ORACLE_KIND=stork \
forge script contracts/script/Deploy.s.sol \
  --root contracts --rpc-url arc_testnet --account <keystore-account> --broadcast --verify \
  | tee deploy.log

sed -n '/^  {$/,/^  }$/p' deploy.log | sed 's/^  //' > deployments/arc-testnet.json
```

(`deployments/arc-mainnet.json` for chain 5042.) `deploy.log` is caught by `*.log` in
`.gitignore`, so the transcript stays local; keep it until the addresses are wired through, then
delete it. Read the JSON before you commit it — those addresses are the only record of the
deploy, and the `sed` above is a text cut, not a parser. Copying the six lines out of the
terminal by hand is an equally good answer.

Then commit it. One file per network, and a network with no file has not been deployed to —
absence means "not deployed", never "look somewhere else". `deployments/README.md` holds the
same table.

If verification did not run or failed, verify after the fact per contract:

```sh
forge verify-contract --chain 5042002 --watch <address> src/FeedResolver.sol:FeedResolver
```

## Wiring the addresses through

Six places read the deployed addresses, and they are not wired to each other. After a deploy,
update all of them from `deployments/arc-testnet.json`.

| Where | What to change |
|---|---|
| `deployments/arc-testnet.json` | the file itself, from the script's output |
| `subgraph/networks.json` | `arc-testnet`: all four addresses and each one's deployment block as `startBlock`. Do **not** hand-edit `subgraph.yaml` — `graph build --network` rewrites it from here |
| `packages/client/src/addresses.ts` | `arcTestnetAddresses`. Callers can also override per client with `defineConfig({ addresses: { … } })` without touching the file |
| `apps/web/src/lib/chain.ts` | `ARC_TESTNET_ADDRESSES`. Deliberately duplicated from the client rather than imported, because the app has to typecheck before the client has been built |
| `packages/mcp` environment | `HUNCH_VPM_SETTLER_ADDRESS`, and `HUNCH_VPM_CLASSIC_SETTLER_ADDRESS` once the comparison settler is up |
| `agent` environment | `HUNCH_SETTLER` — live mode refuses to start while it is the zero address |

The Substreams package takes them as module parameters rather than committed configuration;
see [Substreams](#substreams).

## Deploying the subgraphs

### `hunch-vpm` — the venue

1. Create the subgraph at <https://thegraph.com/studio>, choosing **Arc Testnet** as the
   network. Studio issues a deploy key and a slug.

2. Authenticate once per machine. The key goes into graph-cli's own config, outside this
   repo — never into a file here:

   ```sh
   npx graph auth <DEPLOY_KEY>
   ```

3. Put the deployed addresses and their deployment blocks into `subgraph/networks.json` under
   `arc-testnet`, as above.

4. Build against the network and deploy, from `subgraph/`:

   ```sh
   pnpm codegen
   npx graph build --network arc-testnet
   npx graph deploy <SUBGRAPH_SLUG> --network arc-testnet
   ```

   The CLI prompts for a version label. The package also carries
   `pnpm deploy:studio`, which is the same `graph deploy` with the slug `hunch-vpm` and
   `--network arc-testnet` already filled in.

   Studio then shows sync progress and a development query URL:
   `https://api.studio.thegraph.com/query/<studio-id>/<slug>/<version>`.

The ABIs in `subgraph/abis/` are generated from the contracts in this repo. After any change
to a contract's events or view functions:

```sh
cd contracts
for c in VestedParimutuel ClassicParimutuel FeedResolver MarketFactory; do
  forge inspect "$c" abi --json > "../subgraph/abis/$c.json"
done
```

Then re-run `pnpm codegen`. The mappings fail to compile if a signature moved, which is the
point of regenerating rather than hand-editing.

### `erc8004-arc` — agent identity and reputation

This one is deployable today: Arc testnet's three ERC-8004 registries are live and are not
ours to deploy, and their addresses and start blocks are already in
`subgraph-erc8004-arc/networks.json`.

```sh
pnpm --filter @hunch-vpm/subgraph-erc8004-arc deploy:arc-testnet
```

That runs `tools/with-network.mjs arc-testnet deploy erc8004-arc-testnet --node
https://api.studio.thegraph.com/deploy/`. The mainnet target is `deploy:arc`, and its
addresses in `networks.json` are still zero — fill them in before using it.

### Querying a published subgraph

Studio's development query URL works without a key and is rate limited. For anything else, use
a Graph API key from the same dashboard:

```
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

The key is a **path segment**, not a header. That has one consequence worth stating plainly:
the URL is a secret. Send it from a server, keep it out of logs, and never put it in a
`NEXT_PUBLIC_*` variable — see [the web surface](#deploying-the-web-surface) below.

`@hunch-vpm/client` builds the gateway URL for you if you would rather not assemble it:
`defineConfig({ subgraphId, apiKey })` produces exactly the form above, and `gatewayUrl()` is
exported on its own.

For a local graph-node instead of Studio:

```sh
npx graph create --node http://localhost:8020/ hunch-vpm
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 hunch-vpm
```

## Deploying the web surface

**This is done.** The project is `hunch-vpm` on Vercel, connected to this GitHub repository,
and production is <https://hunch-vpm.vercel.app>. A push to `main` redeploys it — `vercel.json`
at the repository root carries the whole build configuration (`git.deploymentEnabled.main`),
so the settings below are already in effect and are recorded here for a rebuild from scratch.

With no `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` set — which is the current state — it serves the
fixture dataset. Point it at a live subgraph by setting that variable, and nothing else has
to change.

The repository is a pnpm workspace, and `vercel.json` builds it from the root with a filter
(`pnpm --filter @hunch-vpm/web build`) rather than setting a Root Directory, because the app
extends `../../tsconfig.base.json`. If you configure a project by hand in the dashboard
instead, point it at the app directory:

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root Directory | `apps/web` |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` (the default) |
| Node version | 20 or later |

Leave **Include files outside the root directory** enabled — it is on by default, and this app
extends `../../tsconfig.base.json`.

### Environment

None of it is required. With no `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` the deployment serves the
fixture dataset and every page renders, which is the right default while nothing is deployed.
`apps/web/src/lib/data/index.ts` is the only file that chooses.

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` | Unset or empty: fixtures. Set: the live source |
| `NEXT_PUBLIC_HUNCH_MARKET_IDS` | Comma-separated subgraph ids (`<settler>-<index>`) the board lists. This is also the complete set of `/m/<id>` routes, because the market page sets `dynamicParams = false` |
| `NEXT_PUBLIC_ERC8004_SUBGRAPH_URL` | Optional. Without it, reputation reads are unavailable and `/agents` says so rather than showing zeros |

**The `NEXT_PUBLIC_` prefix means Next inlines the value wherever it is referenced from client
code.** Today these are read only from a server module, but treat them as public: put the
Studio development query URL here, or a proxy of your own. A gateway URL with a key in its path
does not belong in any of these three.

### Domain

**Not done.** The surface answers on `hunch-vpm.vercel.app`; `vpm.playhunch.xyz` is the name
reserved for it, not a name that resolves — it answers NXDOMAIN today. The apex
`playhunch.xyz` does resolve, because it is the parent product. To move it over: add
`vpm.playhunch.xyz` under Project → Settings → Domains,
then create the record on `playhunch.xyz`:

```
vpm    CNAME    cname.vercel-dns.com.
```

Vercel issues the certificate once the record resolves. The apex `playhunch.xyz` is the parent
product and is not touched by this project. `metadataBase` in `apps/web/src/app/layout.tsx` is
`https://vpm.playhunch.xyz`; change it there if the host ever changes, so OpenGraph URLs stay
absolute.

The board, the market pages and the claim page revalidate every 30 seconds; `/agents` every
60. Countdowns are client clocks reading an absolute deadline, so they stay correct between
revalidations.

## Opening a market

`MarketFactory.open` creates the market on the settler and registers its resolution spec in
one transaction, so there is never a window in which stake can land against rules nobody has
committed to. It pulls the whole offered seed with `transferFrom`, hands the seed positions
back to you, and returns whatever the settler refused — approve it first.

```sh
cast send "$USDC" "approve(address,uint256)" "$MARKET_FACTORY" 2000000000 \
  --rpc-url arc_testnet --account <keystore-account>
```

Then `open(Terms,Feed)`:

```
Terms = (settler, token, seed[], kappa, resolutionTime, voidTimeout, residueOwner)
Feed  = (oracle, feedKey, strike, direction, maxStaleness)
```

```sh
cast send "$MARKET_FACTORY" \
  "open((address,address,uint256[],uint256,uint64,uint64,address),(address,bytes32,int256,uint8,uint64))" \
  "($VESTED_PARIMUTUEL,$USDC,[1000000000,1000000000],30,$FREEZE_UNIX,172800,$RESIDUE_OWNER)" \
  "($PRICE_ORACLE,$FEED_KEY,300000000000,0,60)" \
  --rpc-url arc_testnet --account <keystore-account>
```

Field by field:

| Field | In the example | Means |
|---|---|---|
| `seed` | `[1000000000, 1000000000]` | 1,000 USDC offered on each of two outcomes. At least 2 legs, every one positive, at most 255 |
| `kappa` | `30` | Capacity coefficient: a book's capacity is `kappa × its accepted principal`. Pass `type(uint256).max` for unbounded, which is the prescription for n-way markets. Ignored by `ClassicParimutuel`, which rations nothing |
| `resolutionTime` | `$FREEZE_UNIX` | The freeze, unix seconds. Entries at or after it are refused. Set once at creation and never movable |
| `voidTimeout` | `172800` | Seconds after the freeze from which *anyone* may void the market through the settler |
| `residueOwner` | `$RESIDUE_OWNER` | The only address that can ever sweep the flooring remainder. Fixed at creation |
| `oracle` | `$PRICE_ORACLE` | The `IPriceOracle` adapter from the deploy, not the provider's own contract |
| `feedKey` | `$FEED_KEY` | Adapter-defined, 32 bytes: a price id for Stork, a feed address for Chainlink |
| `strike` | `300000000000` | The threshold at **8 decimals**, signed. This is $3,000.00 |
| `direction` | `0` | `0` = above, `1` = below. "Above" is inclusive: at exactly the strike, outcome 0 wins |
| `maxStaleness` | `60` | Seconds. A reading older than this voids the market instead of resolving it |

The transaction returns `(marketId, specId)` and emits `MarketOpened(marketId, settler,
specId, opener, seed, kappa, resolutionTime)` with the first three indexed. Read `specId` off
that log — you need it for every resolver call, and `FeedResolver.specIdOf` is only callable
with the whole struct.

```sh
cast logs --from-block <block> --to-block <block> \
  --address "$MARKET_FACTORY" "MarketOpened(uint256,address,bytes32,address,uint256[],uint256,uint64)" \
  --rpc-url arc_testnet
```

From TypeScript instead, `@hunch-vpm/client` builds the same two calls as unsigned calldata
for your own wallet — `approveCalldata({ spender: factory, amount })` then
`openMarketCalldata({ seed, kappa, resolutionTime, voidTimeout, residueOwner, feed })`. It
validates the shape before it encodes: at least two outcomes, every leg positive, `kappa >= 1`,
a 32-byte `feedKey`, and every integer inside its field width. It holds no key and signs
nothing.

## Resolving a market

`FeedResolver` is the market's `resolver`, so nobody resolves anything by hand. Anyone may
call it once the market has frozen; the caller has no influence on the answer and earns
nothing for the call.

Check first, which costs nothing and sends nothing:

```sh
cast call "$FEED_RESOLVER" "preview(bytes32)(bool,uint8,int256,uint256)" "$SPEC_ID" \
  --rpc-url arc_testnet
```

It returns `(ready, winner, price8, age)`: whether `resolve` would succeed this second, the
outcome it would settle to, the reading behind that answer, and how old that reading is in
seconds. `ready` is false before the freeze, after the market has already settled, or when
the reading is older than the spec's `maxStaleness`.

Then:

```sh
cast send "$FEED_RESOLVER" "resolve(bytes32)" "$SPEC_ID" \
  --rpc-url arc_testnet --account <keystore-account>
```

It emits `Resolved(specId, marketId, winner, price, updatedAt)` and calls
`resolve(marketId, winner)` on the settler. Positions are then paid by pull — `claim` per
position, which the owner sends. Nothing pushes funds anywhere.

Reverts you will actually see:

| Revert | Means |
|---|---|
| `TooEarly()` | `block.timestamp < resolutionTime`. Wait |
| `AlreadySettled()` | this spec has already resolved or voided |
| `UnknownSpec()` | wrong `specId`, or the spec was never registered |
| `NotStale()` | from `resolve`, the reading is **older** than `maxStaleness`. See below |

## When the feed goes stale

`resolve` reverts rather than voids when the reading is too old. That is deliberate: a keeper
retrying through a brief provider outage must not accidentally void a good market. Voiding is
a separate, explicit call.

**Watch out for the error name.** `NotStale()` is raised by both paths and means the opposite
thing in each:

- from `resolve`, it means the reading **is** stale (`age > maxStaleness`), so it refused to
  settle on a number nobody should trust;
- from `voidStale`, it means the reading is **not** stale (`age <= maxStaleness`), so there is
  nothing to void.

Decide which you have with `preview`, which reports `age` directly.

**If the feed comes back.** Do nothing. Call `resolve` again once `preview` reports `ready`.
Freezing is what stops the book from moving — the accumulator is frozen at `resolutionTime`
either way — so a slow resolver costs nobody anything, and a late resolution settles on
exactly the state the market had at its freeze.

**If the feed does not come back.** Void it, and refund every position at its accepted
principal:

```sh
cast send "$FEED_RESOLVER" "voidStale(bytes32)" "$SPEC_ID" \
  --rpc-url arc_testnet --account <keystore-account>
```

It emits `VoidedStale(specId, age)` and calls `voidMarket(marketId)` on the settler. Owners
then pull their refunds with the same `claim` call.

**If the resolver itself is wedged** — wrong spec registered, oracle adapter broken, resolver
unreachable — the market is not stuck forever. `VestedParimutuel.voidMarket` is callable by
**anyone** once `block.timestamp >= resolutionTime + voidTimeout`, without going through the
resolver at all:

```sh
cast send "$VESTED_PARIMUTUEL" "voidMarket(uint256)" "$MARKET_ID" \
  --rpc-url arc_testnet --account <keystore-account>
```

That is what `voidTimeout` is for, and it is why it is worth setting to something you would
actually be willing to wait out. Every position refunds at accepted principal.

**Choosing `maxStaleness` in the first place.** It is the staleness bound the market settles
against and it is hashed into the spec id, so it cannot be edited after stake is down. Set it
against the provider's real publish cadence with room for a bad minute; too tight and an
ordinary gap voids a market that had a perfectly good answer. The market page shows the bound,
the last reading and its timestamp, and flags a spec whose last reading is already older than
its own bound.

## Substreams

The package builds, tests and packs today. It cannot stream, because there is no public
Firehose endpoint for Arc yet — `substreams/README.md` states that open dependency at the top,
and `make run` has nothing to connect to until it is resolved.

```sh
cd substreams
make check        # lint, test, vendored-proto check, build. Needs only a Rust toolchain
make pack         # hunch-vpm-v0.1.0.spkg. Needs the substreams CLI
```

Addresses are module parameters, not committed configuration — they default to the zero
address, so an unconfigured package matches nothing, which is the honest default:

```sh
make run    VESTED=0x... CLASSIC=0x... FACTORY=0x... RESOLVER=0x...
make deploy VESTED=0x... CLASSIC=0x... FACTORY=0x... RESOLVER=0x...
```

Deploying to the hosted sink needs a short-lived token minted from the Portal API:

```sh
export SUBSTREAMS_API_KEY=<your key>
export SUBSTREAMS_API_TOKEN=$(make token)
make deploy VESTED=0x... CLASSIC=0x... FACTORY=0x... RESOLVER=0x...
make deployments        # what is running
```

`make deploy` runs `make pack` first, so it builds the wasm, packs the `.spkg` and ships it in
one go.

## The public subgraph URL is checked at build time

`NEXT_PUBLIC_*` variables are inlined by Next into the bundle every visitor downloads. The
Graph gateway carries its API key in the URL path, so a keyed gateway URL in
`NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` or `NEXT_PUBLIC_ERC8004_SUBGRAPH_URL` would publish that key
to everyone who opens the site.

`apps/web` refuses to build in that case. `readPublicEndpoint` throws at module load, so
`next build` fails with a message naming the variable and what is wrong — it never prints the
value, because build logs are not private either. Leaving the variable unset is supported and
falls back to the fixture data layer.

Two ways to serve live data without shipping a key:

- a keyless endpoint (a Studio query URL, or a gateway that authenticates by header), or
- a proxy you own, with the key held server-side and the browser pointed at the proxy.


## Secrets

**No secret value is committed to this repository, and none should be.** `.gitignore` excludes
`.env` and `.env.*` while keeping `.env.example`, and the two example files —
`apps/web/.env.example` and `packages/mcp/.env.example` — carry names and placeholders only.
Check both before you copy either.

| Secret | What it is for | Where it goes |
|---|---|---|
| Deployer key | Signs `forge script` and any `cast send` | A Foundry keystore (`--account`) or a hardware wallet. Never a file in this repo, never `--private-key` on a command line |
| Keeper key | Sends `resolve` / `voidStale`. Needs no privilege — anyone may call them — only gas | Same. A separate key from the deployer, so the demo can show that the caller is unrelated |
| `ARC_TESTNET_RPC_URL`, `ARC_MAINNET_RPC_URL` | Named endpoints in `contracts/foundry.toml` | Shell environment. Secret only if your provider embeds a key in the URL, which many do |
| `ARCSCAN_API_KEY` | `forge script --verify` and `forge verify-contract` | Shell environment. Read by `[etherscan]` in `contracts/foundry.toml` |
| Subgraph Studio deploy key | `graph auth`, once per machine | graph-cli's own config, outside this repo. Do not write it into a file here |
| Graph gateway API key | Querying a published subgraph. Becomes a **path segment** of the URL | Server-side only: `HUNCH_VPM_GRAPH_API_KEY` for the MCP server, `apiKey` in `@hunch-vpm/client`'s config. Never a `NEXT_PUBLIC_*` variable, never a log line |
| `SUBSTREAMS_API_KEY` | Minting a deploy token via `make token` | Shell environment, for the length of a deploy |
| `SUBSTREAMS_API_TOKEN` | `substreams alpha service deploy`. Short-lived, derived from the key | Shell environment. Re-mint rather than store |
| `CIRCLE_API_KEY` | The agent's live custody through a Circle Agent Wallet | The agent process's environment |
| `CIRCLE_WALLET_ID` | Which developer-controlled wallet to use. Not secret, but deployment-specific | Same |
| `CIRCLE_ENTITY_SECRET_CIPHERTEXT` | The entity secret, supplied **already encrypted**, so the raw secret never enters the process | Same. The agent's `ConsoleLogger` is constructed with whatever secret values the process holds and replaces them with `***` before writing anything |
| `GATEWAY_API_KEY`, `GATEWAY_ACCOUNT_ID` | The nanopayment channel that pays for research quotes | Same |
| `AGENT_BOOK_ADDRESS` | The AgentBook registry `@hunch-vpm/agentkit-tier` resolves wallets through, on World Chain. Not a secret, but there is deliberately **no default** — `CANONICAL_AGENT_BOOK` is the zero address and `createViemAgentBook` throws on it | The resource server's environment |

Not secrets, listed because they are easy to mistake for one: `ORACLE_KIND`, `STORK_ADDRESS`,
`HUNCH_VPM_SETTLER_ADDRESS`, `HUNCH_SETTLER`, `HUNCH_MARKET_IDS`, `NEXT_PUBLIC_*`, and every
contract address in `deployments/`. Those are configuration and belong in version control or
in a plain deployment setting.

The agent needs none of the above in dry-run, which is its default: no private key in either
mode, no API key, no network, no deployment.
