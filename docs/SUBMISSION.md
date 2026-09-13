# Submission — ETHOnline 2026

The write-up this project is submitted with, and the honest inventory behind it. Judge-facing
claims live here; the operator steps that have to happen before submitting are in
[`SUBMISSION-CHECKLIST.md`](SUBMISSION-CHECKLIST.md).

- Repository: <https://github.com/rajkaria/hunch-vpm>
- Live surface: <https://hunch-vpm.vercel.app>
- Mechanism paper: [*The Vested Parimutuel*](https://www.playhunch.xyz/vpm-whitepaper)
- Parent product: [Hunch](https://www.playhunch.xyz)

---

## One line

An open-source, USDC-native prediction market on Arc where every stake vests the moment it
lands, so late money can no longer be paid the same multiple as the money that carried the
risk — traded by AI agents whose identity is backed by a verified human, with the whole book
readable through The Graph.

## The problem, measured

Order-book prediction markets only quote questions a market maker shows up for. Pools work
from the first dollar, but a classic pool pays late money the same multiple as early money —
so whoever takes the risk at open is diluted by whoever arrives ten seconds before the buzzer
already knowing the answer.

This is not a hypothetical. On Hunch's own tape — **5,291 resolved markets, 779,549 trades** —
winners entering in the last decile captured a median **70.1%** of the losing pool, and early
winners were diluted by a median **38.7%**.

Under the vested parimutuel, stake vests into the opposing books the moment it lands and is
accepted only up to the capacity those books have to cover it. Replayed on the same tape, the
last-decile share falls to **0.08%** and early dilution to **0.00%**. Those figures and the
replay that produced them are in the paper, §13.4. **This repository is the mechanism, not the
study** — the numbers above are cited, not re-derived here.

And today none of Hunch settles on-chain: every bet clears against a Postgres book with the
operator as resolver, payer and custodian. This repository puts the mechanism on Arc, indexes
it through The Graph, and ties agent identity to a verified human.

## The mechanism, precisely

Stake offered on an outcome vests into the *opposing* books as it arrives, and is accepted
only up to the headroom those books have left — `H = capacity − vested`. Beyond that it is
refused and refunded, which is a **normal outcome and not an error**, and the API says so: a
quote reports requested, accepted and refused separately and names the book that bound it.

Entries in the same block form one vintage and never vest to each other. The market freezes at
a timestamp fixed when it opens and never movable. Settlement is pull-based. The flooring
remainder has a named owner set at creation.

A position is paid `s_i × (1 + A_o(T) − A_o(entry))` — its principal, plus everything that
vested into its book after it arrived.

The consequence, which `ClassicParimutuel` exists in this repo to show side by side: **the
payout multiple per unit staked is flat across arrival order under a classic pool, and
strictly decreasing under this one.**

## What was built

Three layers, each usable without the ones above it.

| Layer | What | Path |
|---|---|---|
| Settlement, on Arc | Two settlers behind one `IParimutuelSettler` interface, a feed resolver whose spec is hashed into its own id, a factory that opens a market and registers its rules in one transaction, and pluggable oracle adapters | [`contracts/`](../contracts) |
| Indexing, on The Graph | The book indexed **as decisions** — headroom, implied odds from accepted principal, vesting to date, preview payouts — computed in the mapping, not in the client | [`subgraph/`](../subgraph) |
| Indexing, standardized | Agent0's published ERC-8004 schema retargeted at Arc's three registries, so one query pattern spans agent identity and reputation across Base and Arc with no new types | [`subgraph-erc8004-arc/`](../subgraph-erc8004-arc) |
| Indexing, streamed | A Rust Substreams package producing market and position tables off the same events | [`substreams/`](../substreams) |
| Identity | Human-backed agent verification and **tiering** — a verified agent gets a higher rate limit, the full per-market cap and a badge; anonymous agents keep working | [`packages/agentkit-tier/`](../packages/agentkit-tier) |
| Agent surface | Typed reads that answer questions, viem writes that never hold a key, the Arc settlement rail, three MCP tools, and a SKILL that teaches an agent the mechanism | [`packages/`](../packages), [`skills/`](../skills) |
| Demo agent | Research → decide → enter → monitor → claim, on a Circle Agent Wallet, paying for intel with Gateway Nanopayments | [`agent/`](../agent) |
| Market surface | The board, per-market pages, capacity meters, vesting curves, the full resolution spec | [`apps/web/`](../apps/web) |

### The parts worth a judge's attention

**The venue never custodies, and it is asserted rather than claimed.** `@hunch-vpm/client`
returns unsigned calldata for the caller's own wallet and holds no key. No contract in this
repo lets its deployer, the factory or the resolver owner move a user's funds. The invariant
suite asserts it directly: across **8,192 calls per run**, an address holding no position
tries `claim`, `withdrawRefund`, `claimResidue`, `resolve` and `transferPosition` on live
markets in arbitrary states, and its balance is asserted to stay at zero. The factory has its
own test that it cannot resolve what it opened, and ends every `open` holding no position, no
allowance and no balance.

**No human resolves anything.** `FeedResolver` is the market's resolver. Anyone may call it
once the market has frozen; the caller has no influence on the answer and earns nothing for
the call. The feed, strike, direction and staleness bound are hashed into the spec id, so they
cannot be edited after stake is down.

**A stale feed refuses to settle rather than voiding.** Voiding is a separate, deliberate
call, so a keeper retrying through a brief provider outage cannot accidentally void a good
market. And if the resolver itself is wedged, `voidMarket` is callable by **anyone** after
`resolutionTime + voidTimeout`, without going through the resolver at all — the market is
never stuck forever.

**The comparison is built in.** `ClassicParimutuel` is the rule the live Hunch product runs
today, ported behind the same interface, so the same market can be shown settled both ways.
That is the only honest way to show what the vested rule changes.

**The agent's decision procedure is written against the mechanism.** `decide()` is a pure
function — same inputs, same output, no clock and no I/O — and it returns every outcome it
considered, not just the one it picked. In a classic pool an agent has nothing to think about
except the odds; here it has to reason about headroom and about what has already vested.

## Integrations

| Sponsor technology | How it is used | State |
|---|---|---|
| **Arc** | The settlement chain. Chain id `5042002` testnet / `5042` mainnet, with USDC as the **native gas token** — the stake asset and the gas asset are the same thing | **Deployed to Arc testnet and verified** on Arcscan; two markets open; mainnet not deployed |
| **Circle** | USDC is the settlement asset throughout. The demo agent custodies through a **Circle Agent Wallet**; the entity secret is supplied already-encrypted so the raw secret never enters the process | Wired and tested in dry-run; not run live |
| **The Graph** | Two subgraphs and a Substreams package. The venue subgraph computes derived decision quantities in the mapping | Both live in Subgraph Studio on `arc-testnet` and published: `hunch-vpm-arc-testnet` (indexing both open markets) and `erc-8004-arc-testnet` |
| **ERC-8004** | Agent identity, reputation and validation, read from Arc's three live registries through the standardized schema | Registries live on Arc testnet; `erc-8004-arc-testnet` subgraph deployed |
| **World / AgentKit** | Human-backed agent verification against canonical AgentBook, used for **tiering** rather than exclusion | Verifier written and tested against fixtures; the canonical AgentBook address is a placeholder and the viem verifier refuses to start on it |
| **Chainlink** | **The markets resolve from Chainlink Data Feeds.** Arc testnet has no Data Feeds, so a **CRE workflow** (`cre/price-relay`) reads ETH / USD and BTC / USD on Sepolia, and Chainlink's `KeystoneForwarder` on Arc delivers the DON-signed report to `ChainlinkCreOracle`. The adapter accepts only the production forwarder and a named workflow, and can lock its configuration. On Arc mainnet, `ChainlinkFeedOracle` reads the published feeds directly | Adapter deployed and verified (`0x68A7…c621`); both testnet markets resolve through it; workflow built and tested, **awaiting CRE deploy access** |
| **Stork** | The first adapter, and the one the original deploy shipped | Written and tested. Stork's Arc testnet feeds stopped updating on 2026-06-14, so no market uses it |
| **x402 / Gateway Nanopayments** | The agent pays per research quote rather than per subscription | Wired and tested in dry-run |

> **Fill in before submitting:** the exact ETHOnline prize-track names this is entered under.
> The table above states what is integrated; it deliberately does not guess at track titles.

## The venue

The surface is not a viewer. A person can connect a wallet, be prompted onto Arc, approve
USDC, enter a market, see exactly what the books took and what they refused, watch the vintage
close, and pull what they are owed — and a keeper settles frozen markets on a cron so the
venue does not depend on anyone remembering to.

Two parts of that are worth a judge's attention because no other prediction-market UI has to
solve them.

**The acceptance estimate comes before the signature.** This mechanism partially accepts
stake: you offer 1,000 and 340 is taken, because the opposing books had room for 340. Every
DEX interface that could be copied assumes fills are total, so there is no pattern to borrow.
The stake panel answers it before a wallet is involved — accepted, refused, and *which book
bound it* — with accepted and refused given equal weight and the refusal never styled as a
warning. A refund the user learns about afterwards reads as a bug; the same refund disclosed
beforehand reads as the rule working.

**The entry has three states, because the contract does.** `enter` buffers: it pushes the
position with `accepted = 0`, pulls the full amount, and emits `Entered` carrying **`offered`,
never `accepted`**. Rationing happens in `_finalizeVintage`, on the first call to touch the
market in a *later* block. So the surface never claims an acceptance it cannot know — between
entering and the vintage closing it says the stake is in, the books have not ruled, and offers
"Close the vintage", because `finalizeVintage` is callable by anyone and a vintage nobody
closes is a position nobody can claim. The estimate carries its real caveat: co-entrants in
the same block ration against each other, so it is an estimate and not a quote.

Wallet connection is a plain **Connect Wallet** — injected plus WalletConnect, no embedded
wallet provider. Arc is defined with **USDC as the native gas token — 18 decimals natively, 6 through the
ERC-20 interface every stake moves through**, and the
chain is offered for adding because `5042002` ships in no wallet; `ready` and `wrong chain`
are separate states throughout, since arriving connected-but-elsewhere is the likely path.

## What is live right now

**<https://hunch-vpm.vercel.app>** — the market surface, in production, public.

The settlement layer is **deployed to Arc testnet** and every contract is verified on Arcscan —
VestedParimutuel `0xC743…2Eec`, ClassicParimutuel `0x2160…0D57`, FeedResolver `0xd9Fd…e3f3`,
MarketFactory `0x0380…2f07`, and ChainlinkCreOracle `0x68A7…c621`
(`deployments/arc-testnet.json`).

**Arc testnet is live end to end.** Two markets are open, both seeded through MarketFactory and
both resolving from Chainlink:

- BTC / USD at or above $77,000 at 2026-09-15 16:00 UTC
- ETH / USD at or above $2,500 at 2026-09-20 16:00 UTC

The `hunch-vpm-arc-testnet` subgraph indexes them, and the board reads that subgraph. Both
resolve through a Chainlink CRE price relay, and a scheduled keeper
(`.github/workflows/keeper.yml`) is wired to settle each market once it freezes and the relay has
delivered a price. See *What is not done* for where that stands. Arc
**mainnet** still serves a **replayed fixture dataset** and says so in a banner. A header toggle
switches networks, and each one reads its own index. Fixture
markets carry no on-chain settler, so every control that would send a transaction from one says
there is nothing to send rather than pretending otherwise. Every book on it is replayed through the settler's own rules, so the
arithmetic is real even though the markets are not. Addresses that are not real render as
`0x0000…0000` with a **not deployed** badge rather than linking into an explorer that has
nothing to show.

On the mainnet fixtures, the addresses that do link are the ones live on either network: USDC
(`0x3600…0000`) and the ERC-8004 registries on `/agents`.

## What is not done, stated plainly

A submission that hides this is worse than one that says it.

1. **Nothing is deployed to Arc mainnet.** Testnet is deployed and verified; mainnet has no
   `deployments/` file and every mainnet address is the zero placeholder. Mainnet's RPC,
   explorer and a verified oracle are not published yet.
2. **No market has resolved yet.** The Chainlink CRE workflow that relays Sepolia's ETH / USD and
   BTC / USD onto Arc testnet is written, tested byte-for-byte against the adapter, and passes
   `cre workflow simulate` with live reads. Deploying it needs Chainlink to grant deploy access
   to our CRE organisation, which is pending. Until a price lands, the adapter reverts `NoValue()`
   and the keeper waits rather than voiding. A market that freezes with no price voids after
   its 3-day timeout and refunds every position at accepted principal.
3. **Substreams cannot stream.** It builds, tests and packs, but there is **no public Firehose
   endpoint for Arc yet**. This is an external dependency, not an omission — `make run` has
   nothing to connect to until it is resolved.
4. **The agent has never run live.** Dry-run is its default and the only mode that works
   today. The full research → decide → enter → monitor → claim loop is exercised against
   fixtures. The keeper is the same: dry run unless `--live`, and `--live` without a key is
   refused rather than silently downgraded.
5. **No stranger has staked through the UI yet.** The live read path is proven: production reads
   both published Studio subgraphs. Only the deployer's seed positions exist, though, and a
   third-party wallet has not yet walked approve → enter → claim on the live site.
6. **Selfie Check is not implemented.** The AgentKit verifier is wired and tested against
   fixtures; the canonical AgentBook address is a placeholder, and the viem-backed verifier
   refuses to start when handed it rather than pretending.
7. **`vpm.playhunch.xyz` does not resolve.** It is the name reserved for this surface, not a
   name that answers. The apex `playhunch.xyz` resolves because it is the parent product.

## Provenance

This is a new feature of an existing product, so the line between the two matters.

**Pre-existing**, vendored or depended on rather than written here: the Vested Parimutuel paper
and its 118 conformance vectors; `VestedParimutuel.sol` and its Foundry suite (see
[`contracts/VENDORED.md`](../contracts/VENDORED.md)); Hunch's `HunchParimutuelVault`, agent
rail, MCP server, x402 implementation and published SDKs; Base settlement; the market
catalogue.

**New in this repository**: `FeedResolver` and its oracle adapters; `MarketFactory`; the
`ClassicParimutuel` port behind a shared settler interface; the `hunch-vpm` subgraph; the
ERC-8004 subgraph for Arc; the Substreams package; `@hunch-vpm/client` and the Arc settlement
rail; `@hunch-vpm/mcp` and the SKILL; `@hunch-vpm/agentkit-tier`; the demo agent; the web
surface; and the documentation under `docs/`.

`VestedParimutuel.sol` is vendored byte-for-byte from the paper's reference implementation.
The 118 published conformance vectors run against it in CI — if anyone edits it, they stop
passing.

## Verification

One gate, and CI runs the same thing:

```sh
pnpm verify
```

| Suite | Tests | Measured by |
|---|---|---|
| `contracts` (Foundry, 11 suites) | 59 | `forge test --root contracts` |
| `packages/client` | 232 | `pnpm --filter @hunch-vpm/client test` |
| `packages/agentkit-tier` | 224 | `pnpm --filter @hunch-vpm/agentkit-tier test` |
| `agent` | 185 | `pnpm --filter @hunch-vpm/agent test` |
| `packages/mcp` | 182 | `pnpm --filter @hunch-vpm/mcp test` |
| `apps/web` | 124 | `pnpm --filter @hunch-vpm/web test` |
| `subgraph-erc8004-arc` (node + matchstick) | 38 + 38 | `pnpm --filter @hunch-vpm/subgraph-erc8004-arc test` |
| `subgraph` (matchstick) | 17 | `pnpm --filter @hunch-vpm/subgraph test` |
| `substreams` (Rust, separate job) | 91 | `cd substreams && make check` |

**1,190 tests.** That is a reading taken on 12 September 2026 and it goes stale the moment
anyone adds a test — the right-hand column is the source of truth.

## Running it

```sh
git clone --recurse-submodules https://github.com/rajkaria/hunch-vpm
cd hunch-vpm
pnpm install
pnpm verify
```

Nothing needs to be deployed and nothing needs a key:

```sh
pnpm --filter @hunch-vpm/web dev       # http://localhost:3000, fixtures, no network
node agent/dist/cli/main.js research   # the demo agent, dry-run
```

[`RUNBOOK.md`](RUNBOOK.md) is the deploy path. [`DEMO.md`](DEMO.md) is a four-minute walkthrough
in seven beats, every one of which runs with nothing deployed.
