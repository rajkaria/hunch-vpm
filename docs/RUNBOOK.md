# Runbook

How to run this repo locally, put it on Arc testnet, index it, serve it, open a market,
resolve one, and handle the feed going quiet. Every command here exists in the repo or in a
tool the repo already depends on.

**Deployed today:** the web surface at <https://hunch-vpm.vercel.app>, and the settlement layer on
**Arc testnet** (2026-09-13, `deployments/arc-testnet.json`, all five verified on Arcscan):

| Contract | Address |
|---|---|
| VestedParimutuel | [`0xC743940C75619f65F6178b7e49c0C3A0bE012Eec`](https://testnet.arcscan.app/address/0xC743940C75619f65F6178b7e49c0C3A0bE012Eec) |
| ClassicParimutuel | [`0x21603b2176aB8495A81fF3B3bE853C64f3860D57`](https://testnet.arcscan.app/address/0x21603b2176aB8495A81fF3B3bE853C64f3860D57) |
| StorkOracle (IPriceOracle adapter) | [`0x5938F12246642aE8E6A47Efbaa72a454EafD4287`](https://testnet.arcscan.app/address/0x5938F12246642aE8E6A47Efbaa72a454EafD4287) |
| FeedResolver | [`0xd9Fde9112a5dE78075fae334D8A9a67fDcAee3f3`](https://testnet.arcscan.app/address/0xd9Fde9112a5dE78075fae334D8A9a67fDcAee3f3) |
| MarketFactory | [`0x0380C6FC136AE64432558e407706a5C7E7652f07`](https://testnet.arcscan.app/address/0x0380C6FC136AE64432558e407706a5C7E7652f07) |

**Not deployed:** anything on Arc mainnet (every mainnet address is the zero placeholder), and
neither subgraph is published to Studio yet — so the surface still serves the fixture dataset.

- [What you need installed](#what-you-need-installed)
- [Local development from a clean clone](#local-development-from-a-clean-clone)
- [Deploying the contracts to Arc testnet](#deploying-the-contracts-to-arc-testnet)
- [Wiring the addresses through](#wiring-the-addresses-through)
- [Deploying the subgraphs](#deploying-the-subgraphs)
- [Deploying the web surface](#deploying-the-web-surface)
- [Opening a market](#opening-a-market)
- [Chainlink prices on Arc testnet (CRE)](#chainlink-prices-on-arc-testnet-cre)
- [Resolving a market](#resolving-a-market)
- [The keeper](#the-keeper)
- [When the feed goes stale](#when-the-feed-goes-stale)
- [Arc mainnet](#arc-mainnet)
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
serves a replayed fixture dataset for any network with no subgraph URL set, and the
agent's dry-run mode is its default and holds no key.

## Deploying the contracts to Arc testnet

Arc testnet is chain id `5042002`. USDC is the native gas token at
`0x3600000000000000000000000000000000000000`, 6 decimals through the ERC-20 interface, so the
deployer needs testnet USDC for gas.

### Check before you spend anything

A fresh `git worktree`, or a clone without `--recurse-submodules`, has an **empty
`contracts/lib/forge-std`**, and `Deploy.s.sol` imports from it. The first real deploy attempt
failed there at compile time. Initialise it first:

```sh
git submodule update --init --recursive
ETH_PASSWORD=~/.foundry/<keystore-account>.password \
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io \
bash scripts/preflight-deploy.sh <keystore-account> testnet
```

`ETH_PASSWORD` is Foundry's own variable for a keystore **password file** (a path, not the
password). With it set, the preflight can read the deployer's address and balance, and the
command it prints carries `--password-file`, so the deploy runs without a prompt. Keep that file
outside the repository, mode 600.

Read-only, and it refuses rather than warns. It checks the things that cost real
money to get wrong: that the contracts compile, that the keystore account exists, that the RPC actually
answers **and is chain 5042002 and not something else**, that the deployer holds
at least 0.35 USDC (the gas token — read at 18 decimals, because `cast balance` is the native
view, while the ERC-20 view stakes move through is 6; the easiest pair of
numbers on this chain to misread), that `ORACLE_KIND` is not a typo silently falling through to Stork,
and that Stork's contract is really deployed at the address the script would
wrap. On a clean pass it prints the exact deploy command, with Blockscout
verification flags included (Arcscan needs no API key).

Run it for mainnet with `mainnet` as the second argument; it then wants chain
5042 and `ARC_MAINNET_RPC_URL`.

`contracts/foundry.toml` already names the endpoints and the verifier:

```toml
[rpc_endpoints]
arc_testnet = "${ARC_TESTNET_RPC_URL}"
arc_mainnet = "${ARC_MAINNET_RPC_URL}"

```

There is no `[etherscan]` entry, and no API key to find: **Arcscan is a Blockscout instance**,
so verification takes `--verifier blockscout --verifier-url https://testnet.arcscan.app/api/`
and nothing else. So set `ARC_TESTNET_RPC_URL` in the environment, and deploy:

```sh
ORACLE_KIND=stork \
forge script contracts/script/Deploy.s.sol \
  --root contracts \
  --rpc-url arc_testnet \
  --account <keystore-account> \
  --broadcast \
  --verify --verifier blockscout --verifier-url https://testnet.arcscan.app/api/
```

Stock Foundry is enough. Arc's docs use an `arc-forge` fork, but this exact script was
simulated against live Arc testnet with stock `forge` 1.5.1 (no `--broadcast`): all five
contracts deploy, ~7.35M gas. Forge prints the estimate as "ETH"; on Arc that figure is
native USDC at 18 decimals, so the whole deploy costs roughly **0.30 USDC**.

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

**Stork on Arc testnet has stopped publishing.** Its last update landed on 2026-06-14 (block
47,013,326). The adapter reads through `getTemporalNumericValueV1`, which reverts `StaleValue()`
once a value is over an hour old, so a Stork-backed market can never resolve today. Pushing an
update yourself needs Stork-signed data, and that needs a Stork API key. Pyth's Arc testnet
contract has the same problem: Hermes has required an API key since the Pyth Core upgrade on
2026-08-26, and Arc testnet was left out of that upgrade. **Arc testnet markets resolve through
Chainlink instead**, relayed by CRE. See [Chainlink prices on Arc testnet](#chainlink-prices-on-arc-testnet-cre).
On Arc mainnet, Chainlink publishes Data Feeds directly, so `ORACLE_KIND=chainlink` is the one to ship.

The unrecognised-value case falling through to Stork is deliberate but silent: a typo in
`ORACLE_KIND` deploys Stork without complaint. Read the adapter address the script prints
against the one you expected before you go further.

`contracts/test/Deploy.t.sol` covers all three branches.

The printed command starts with `set -o pipefail`. Without it `forge script … | tee deploy.log`
exits 0 even when forge fails, and a failed deploy reads as a finished one — which is exactly how
the compile failure above first presented.

Blockscout rate-limits verification. If `--verify` gives up with `Too many requests` on some
contracts (it did on FeedResolver and MarketFactory), the contracts are deployed and only
verification is outstanding — see "If verification did not run or failed" below.

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
  --root contracts --rpc-url arc_testnet --account <keystore-account> --broadcast \
  --verify --verifier blockscout --verifier-url https://testnet.arcscan.app/api/ \
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

If verification did not run or failed, verify after the fact per contract. When Arcscan is
rate-limiting `forge verify-contract` (its ABI lookups count against the limit too), submit the
standard JSON input to Blockscout's v2 endpoint instead — that is how FeedResolver and
MarketFactory were verified:

```sh
forge verify-contract --root contracts --chain 5042002 --show-standard-json-input \
  <address> src/MarketFactory.sol:MarketFactory > MarketFactory.json
# POST it as multipart to https://testnet.arcscan.app/api/v2/smart-contracts/<address>/verification/via/standard-input
# with compiler_version=v0.8.28+commit.7893614a, contract_name, license_type=mit, files[0]=@MarketFactory.json,
# and constructor_args (hex, no 0x) for a contract that has them.
```

Or with forge, when the explorer is not throttling:

```sh
forge verify-contract --root contracts --chain 5042002 --watch \
  --verifier blockscout --verifier-url https://testnet.arcscan.app/api/ \
  <address> src/FeedResolver.sol:FeedResolver
```

## Wiring the addresses through

Six places read the deployed addresses, and none imports another. **Do not hand-edit them.**

```sh
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io pnpm wire:testnet
```

`scripts/wire-deployment.mjs` writes the four committed readers from
`deployments/arc-testnet.json`, takes each contract's deploy block from forge's broadcast receipts
and records it in the file as `startBlocks`, confirms every address holds code when the RPC
variable is set, and prints the two environment lines it cannot write. `pnpm wire:check` — a
stage of `pnpm verify` — fails if any reader drifts from its file, or holds a non-zero address
for a network that has no file.

| Where | What to change |
|---|---|
| `deployments/arc-testnet.json` | the file itself, from the script's output |
| `subgraph/networks.json` and `subgraph/subgraph.yaml` | `arc-testnet`: all four addresses and each one's deployment block as `startBlock`. The committed manifest is the arc-testnet one, so the script writes both |
| `packages/client/src/addresses.ts` | `arcTestnetAddresses`. Callers can also override per client with `defineConfig({ addresses: { … } })` without touching the file |
| `apps/web/src/lib/chain.ts` | `ARC_TESTNET_ADDRESSES`, including `priceOracle` (the adapter a spec names). Deliberately duplicated from the client rather than imported, because the app has to typecheck before the client has been built |
| `packages/mcp` environment | `HUNCH_VPM_SETTLER_ADDRESS`, `HUNCH_VPM_CLASSIC_SETTLER_ADDRESS`. Arc testnet values are filled in `packages/mcp/.env.example`: `0xC743…2Eec` and `0x2160…0D57` |
| `agent` environment | `HUNCH_SETTLER=0xC743940C75619f65F6178b7e49c0C3A0bE012Eec`, `HUNCH_MARKET_IDS` from `deployments/arc-testnet.json`. Live mode refuses to start while `HUNCH_SETTLER` is the zero address |

The Substreams package takes them as module parameters rather than committed configuration;
see [Substreams](#substreams).

## Deploying the subgraphs

### `hunch-vpm` — the venue

1. Create the subgraph at <https://thegraph.com/studio>, named **`hunch-vpm-arc-testnet`**,
   choosing **Arc Testnet** as the network. Studio issues a deploy key; one key covers every
   subgraph on the account.

2. Authenticate once per machine. The key goes into graph-cli's own config, outside this
   repo — never into a file here:

   ```sh
   npx graph auth <DEPLOY_KEY>
   ```

3. The addresses and start blocks are already in `subgraph/networks.json` and `subgraph.yaml` —
   `pnpm wire:testnet` put them there.

4. Deploy, from `subgraph/`:

   ```sh
   pnpm run deploy:testnet --version-label v0.0.1
   ```

   That is `graph codegen`, then `graph deploy hunch-vpm-arc-testnet --network arc-testnet`
   through `tools/with-network.mjs`, which swaps the network in and restores `subgraph.yaml`
   afterwards (graph-cli rewrites the manifest in place and drops its comments). Without
   `--version-label` the CLI prompts for one.

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
pnpm --filter @hunch-vpm/subgraph-erc8004-arc run deploy:arc-testnet --version-label v0.0.1
```

Its Studio subgraph must be named **`erc-8004-arc-testnet`** (Arc Testnet). The build against
arc-testnet was checked on 2026-09-13 and succeeds; only the Studio deploy key is missing.

That runs `tools/with-network.mjs arc-testnet deploy erc-8004-arc-testnet --node
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

Each network reads its own subgraph. With no subgraph URL for a network, that network serves the
fixture dataset and says so. **Arc testnet is live:** its two subgraph URLs and
`NEXT_PUBLIC_HUNCH_MARKET_IDS_TESTNET` are set in Vercel for production, preview and development.
Mainnet has none of them yet, so it serves fixtures.

The repository is a pnpm workspace, and `vercel.json` builds it from the root with a filter
(`pnpm --filter @hunch-vpm/web build`) rather than setting a Root Directory, because the app
extends `../../tsconfig.base.json`. **The web app's `build` script builds `@hunch-vpm/client`
first**, and `live.ts` imports the client by a literal specifier, so it is compiled into the
server bundle. Both halves were needed. When the import went through a variable, the bundler
never saw the client. Vercel then failed at build time (`Cannot find module
…/@hunch-vpm/client/dist/index.js`), and once that was patched, at runtime: the function's file
trace did not contain the client, so every live read answered "The index could not be reached." If you configure a project by hand in the dashboard
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

None of it is required. A network with no subgraph URL serves the fixture dataset and every page
renders. `apps/web/src/lib/data/index.ts` is the only file that chooses; which network a request
reads is the viewer's toggle, carried to the server in the `hunch-vpm.network` cookie.

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL_TESTNET`, `_MAINNET` | Per network. Unset or empty: that network serves fixtures. Set: the live source. The unsuffixed `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` is still read as testnet; mainnet never falls back to it |
| `NEXT_PUBLIC_HUNCH_MARKET_IDS_TESTNET`, `_MAINNET` | Comma-separated subgraph ids (`<settler>-<index>`) each network's board lists. Together they are the complete set of `/m/<id>` routes, because the market page sets `dynamicParams = false`. Unsuffixed = testnet |
| `NEXT_PUBLIC_ERC8004_SUBGRAPH_URL_TESTNET`, `_MAINNET` | Optional. Without it, reputation reads on that network are unavailable and `/agents` says so rather than showing zeros. Unsuffixed = testnet |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional. Unset: browser wallets only, and the connect menu says so. It is public by design but it is yours, so there is no default |
| `NEXT_PUBLIC_ARC_NETWORK` | `mainnet` to transact on Arc mainnet. Anything else, including unset, is testnet — so a misconfigured build cannot sign against mainnet |
| `NEXT_PUBLIC_ARC_TESTNET_RPC_URL`, `NEXT_PUBLIC_ARC_RPC_URL` | Optional overrides for the public endpoints. A URL, not a secret — unless your provider embeds a key in it, in which case it does not belong in a `NEXT_PUBLIC_` variable at all |
| `NEXT_PUBLIC_ARC_FAUCET_URL` | Where an empty wallet is sent for testnet USDC. No default: a faucet link that 404s teaches a visitor the site is broken. Unset, the empty-balance state says so instead of inventing a destination |

**The `NEXT_PUBLIC_` prefix means Next inlines the value wherever it is referenced from client
code.** Today these are read only from a server module, but treat them as public: put the
Studio development query URL here, or a proxy of your own. A gateway URL with a key in its path
does not belong in any of the subgraph variables.

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

### The markets open on Arc testnet

Both were opened on 2026-09-13 by the deployer through MarketFactory. Each is seeded with 2 USDC
per side, `kappa` 30, a 3-day `voidTimeout` and `maxStaleness` 5400 s, and both resolve through
`ChainlinkCreOracle`. Each one's full record is in `deployments/arc-testnet.json` (`markets`).

| Subgraph id | Question | Freeze (UTC) | specId |
|---|---|---|---|
| `0xc743…2eec-0` | BTC / USD at or above $77,000 | 2026-09-15 16:00 | `0x49a5f58c…c0ff` |
| `0xc743…2eec-1` | ETH / USD at or above $2,500 | 2026-09-20 16:00 | `0xa89bf6c8…70dc` |

To open another one, follow the steps above, add its entry to `markets`, and append its id to
`NEXT_PUBLIC_HUNCH_MARKET_IDS_TESTNET` in Vercel. The market page sets `dynamicParams = false`,
so a redeploy is what makes its `/m/<id>` route exist.

## Chainlink prices on Arc testnet (CRE)

Chainlink publishes Data Feeds on Arc **mainnet** (the reference data directory lists ETH / USD at
`0x50FCDD99D6762D1C170DC6A9111db944AEE6D364`) but not on Arc **testnet**. On testnet the
Chainlink-native route is the Chainlink Runtime Environment. A workflow reads the feed where it
lives (Ethereum Sepolia) and the DON signs a report. Chainlink's production `KeystoneForwarder`
on Arc testnet (`0x76c9cf548b4179F8901cda1f8623568b58215E62`, `typeAndVersion` "KeystoneForwarder
1.0.0") verifies the report and delivers it to `ChainlinkCreOracle`.

| Piece | Where |
|---|---|
| `ChainlinkCreOracle` (IPriceOracle + IReceiver) | `contracts/src/oracles/ChainlinkCreOracle.sol`, deployed and verified at `0x68A79146C52dcA1cBea8a0Da9aCF506D5894c621` by `script/DeployCreOracle.s.sol` |
| The workflow, `hunch-price-relay` | `cre/price-relay/`. Every 5 minutes it relays ETH / USD and BTC / USD from Sepolia |
| Feed keys | `keccak256` of the source feed's `description()`: `cast keccak "ETH / USD"` |

The adapter takes reports **only** from the production forwarder, and only for a configured workflow
owner and/or workflow id. Until one is configured it refuses everything. It records the
**source** round's timestamp, so `maxStaleness` judges the feed's real age. The Sepolia feeds
have a one-hour heartbeat, which is why the testnet markets allow 5400 s.

**Order of operations**, all but the last two done:

1. Deploy the adapter: `forge script script/DeployCreOracle.s.sol --rpc-url arc_testnet --broadcast --account <acct>`.
2. Open markets whose spec names the adapter and `cast keccak "<PAIR>"` as the feed key.
3. `cd cre/price-relay && bun install && bun test`.
4. **Operator:** `cre login`, then `cre account access` to request deploy access. Once it is granted,
   run `cre workflow deploy price-relay --target production-settings` from `cre/`.
5. **Operator:** `setExpectedWorkflowId` / `setExpectedAuthor` on the adapter with the values
   `cre` prints, then `lock()` it once the first `PriceRelayed` event lands.

`cre/README.md` has the exact commands. If a market freezes before prices flow, nothing is lost:
the keeper waits (it never voids by default). After `resolutionTime + voidTimeout` anyone may void
the market through the settler, and every position refunds at accepted principal.

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

## The keeper

`resolve` is callable by anyone and earns the caller nothing, which is the point
— and also the problem: **if nobody calls it, nothing ever settles.** A venue
needs a process that does.

`hunch-keeper` is that process. It reads every spec it is given, and for each one
resolves it if the feed says it is ready. One pass per invocation, so it runs
under cron rather than as a daemon holding a key.

```sh
pnpm --filter @hunch-vpm/agent build

ARC_RPC_URL=... FEED_RESOLVER=0x... KEEPER_SPEC_IDS=0x...,0x... \
  node agent/dist/keeper/main.js
```

That is a **dry run**, which is the default: it decides and reports, and sends
nothing. A misconfigured keeper should be inert rather than wrong. To actually
send, add `--live` and a key:

```sh
ARC_RPC_URL=... FEED_RESOLVER=0x... KEEPER_SPEC_IDS=0x... \
KEEPER_PRIVATE_KEY=0x... node agent/dist/keeper/main.js --live
```

The keeper needs **no privilege of any kind**. Anyone may call `resolve`, the
caller has no influence on the answer, and it earns nothing for the call — the
key pays for gas and nothing else. Use a key that is not the deployer's, so the
demo can show that the caller is unrelated to whoever opened the market. Running
live without a key is refused rather than silently downgraded to a dry run: an
operator who believes markets are being settled when nothing is being sent is
worse off than one who gets an error.

### It does not void by default, and that is deliberate

`--allow-void` is off unless you pass it. `resolve` reverts rather than voids on
a stale reading precisely so that a keeper retrying through a brief provider
outage cannot destroy a market that still had a good answer coming. A keeper that
voids on its own initiative hands that protection straight back.

Voiding is an operator's judgement that a feed is *not coming back*. When you
have made it:

```sh
... node agent/dist/keeper/main.js --live --allow-void --void-after 3600
```

`--void-after` is a second belt: extra seconds past the spec's own bound before a
void is even considered, because `age > maxStaleness` is true the instant a feed
misses a single publish, which is not evidence that it is gone.

### Under cron

```
*/5 * * * * cd /srv/hunch-vpm && ARC_RPC_URL=... FEED_RESOLVER=0x... \
  KEEPER_SPEC_IDS=0x... KEEPER_PRIVATE_KEY=0x... \
  node agent/dist/keeper/main.js --live >> /var/log/hunch-keeper.log 2>&1
```

It exits non-zero only when a call was attempted and reverted, so cron's own
mail-on-failure is a usable alert. A spec that is simply not ready is not a
failure and does not page anyone.

### Scheduled on GitHub Actions (what Arc testnet uses)

`.github/workflows/keeper.yml` runs one pass every 10 minutes on `main`. It also has a
**Run workflow** button. It takes the spec ids from `deployments/arc-testnet.json` (`markets[].specId`), so
committing a new market's entry is what puts it under the keeper.

- **No `KEEPER_PRIVATE_KEY` secret: dry run.** It reports what it would send and sends nothing.
- **With the secret: live.** Create a fresh key that is not the deployer's, fund it with about
  1 testnet USDC at <https://faucet.circle.com>, and store it as a repository secret:

  ```sh
  cast wallet new                       # note the address and private key
  gh secret set KEEPER_PRIVATE_KEY      # paste the private key at the prompt
  ```

It never passes `--allow-void`. GitHub may run a schedule late, and that is harmless: the book
froze at `resolutionTime`, whenever `resolve` actually lands.

**A feed with no reading yet is not a failure.** Until the CRE relay delivers its first price,
`ChainlinkCreOracle.read` reverts `NoValue()`, and so does `FeedResolver.preview`. The keeper
reports such a spec as `no-reading` and waits, and never voids it, even with `--allow-void`. Only a
transport error counts as a failed read. The first scheduled run, before that distinction existed,
went red for exactly this reason.

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

## Arc mainnet

Public launch is **16 September 2026**, chain id **5042**. Nothing of ours is deployed there.
The code is ready, and the steps are the testnet ones with three differences.

**What is already true (checked 2026-09-13):**

- **Chainlink Data Feeds exist on Arc mainnet.** The reference data directory
  (`feeds-arc-mainnet.json`) lists 30, including ETH / USD `0x50FCDD99D6762D1C170DC6A9111db944AEE6D364`
  and BTC / USD `0xa109B535C70C8Be9995be64Bb6751AcDB27e03De`. Both are 8 decimals with a 24 h
  heartbeat and a 0.5 % deviation trigger. So mainnet ships `ORACLE_KIND=chainlink`:
  `ChainlinkFeedOracle` reads the aggregator directly, with the feed address as the `feedKey`. No
  CRE relay and no API key.
- **A 24 h heartbeat changes `maxStaleness`.** A quiet market can sit a day between rounds, so a
  tight bound voids markets that had a good answer. Use at least 90000 s on mainnet, or pick a pair
  whose deviation trigger fires often.
- The Graph supports `arc` (`subgraph/package.json` has `deploy:mainnet`). graph-cli 0.98.1
  builds it.

**What must be published before anything is sent**, and is not yet:

- Arc's official mainnet **RPC**. Chainlink's docs name `explorer.arc.io` as the explorer. Confirm
  both on docs.arc.io at launch, and do not use third-party endpoints.
- The **ERC-8004 registries**' mainnet addresses, for the reputation subgraph and `/agents`.

**Order of operations:**

1. Fund a mainnet deployer keystore with real USDC: about 0.35 for gas, plus the seeds.
2. `ARC_MAINNET_RPC_URL=… ARC_VERIFIER_URL=<blockscout api> ORACLE_KIND=chainlink bash scripts/preflight-deploy.sh <acct> mainnet`,
   then the command it prints.
3. Cut `deployments/arc-mainnet.json`, then run `pnpm wire:mainnet` and `pnpm verify`.
4. Create the `hunch-vpm-arc` Studio subgraph (network `arc`), then `pnpm --filter @hunch-vpm/subgraph deploy:mainnet`.
5. Open markets on the Chainlink feed addresses. Set `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL_MAINNET`,
   `NEXT_PUBLIC_HUNCH_MARKET_IDS_MAINNET`, `NEXT_PUBLIC_ARC_RPC_URL` and `NEXT_PUBLIC_ARC_EXPLORER_URL`
   in Vercel.
6. Add a mainnet keeper job with its own funded key.

**The contracts are not audited.** The web surface already shows a non-dismissible notice on
mainnet. Keep seeds small until that changes.

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
Graph gateway carries its API key in the URL path, so a keyed gateway URL in any
`NEXT_PUBLIC_HUNCH_SUBGRAPH_URL*` or `NEXT_PUBLIC_ERC8004_SUBGRAPH_URL*` variable would publish that key
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
