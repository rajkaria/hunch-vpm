# Architecture

Three layers, each usable without the ones above it: a settlement layer on Arc, an indexing
layer on The Graph, and an identity layer that ties an agent to a human.

```
                         ┌──────────────────────────────────────────┐
                         │  vpm.playhunch.xyz   ·   demo agent      │
                         │  MCP tools · SKILL · @hunch-vpm/client    │
                         └───────────────┬──────────────────────────┘
                                         │ reads decisions, not rows
             ┌───────────────────────────┼───────────────────────────┐
             │                           │                           │
     ┌───────▼────────┐        ┌─────────▼─────────┐      ┌──────────▼────────┐
     │ hunch-vpm      │        │ erc8004-arc       │      │ substreams        │
     │ subgraph       │        │ subgraph          │      │ package           │
     │ book, headroom │        │ agent identity    │      │ market + position │
     │ vesting, spec  │        │ and reputation    │      │ tables            │
     └───────┬────────┘        └─────────┬─────────┘      └──────────┬────────┘
             │                           │                           │
             └───────────────────────────┼───────────────────────────┘
                                         │ indexes
   ╔═════════════════════════════════════▼═══════════════════════════════════╗
   ║  Arc (chain 5042002 testnet / 5042 mainnet) — USDC is the native gas     ║
   ║                                                                          ║
   ║   MarketFactory ──opens──► VestedParimutuel ◄──IParimutuelSettler──►     ║
   ║        │                   ClassicParimutuel                              ║
   ║        └──registers──► FeedResolver ──reads──► IPriceOracle               ║
   ║                             ▲                  ├─ StorkOracle            ║
   ║                    anyone may call             ├─ ChainlinkFeedOracle    ║
   ║                    once frozen                 └─ (Pyth, RedStone …)     ║
   ╚══════════════════════════════════════════════════════════════════════════╝
                                         │
                              ┌──────────▼──────────┐
                              │ World AgentBook     │
                              │ human-backed tiering│
                              └─────────────────────┘
```

## Settlement

Two settlers sit behind one interface, `IParimutuelSettler`, so a venue switches rule by
configuration rather than by migration.

**`VestedParimutuel`** is the mechanism from the paper, vendored byte-for-byte from its
reference implementation. Stake vests into the opposing books the moment it lands, and is
accepted only up to the capacity those books have to cover it. Entries in the same block form
one vintage and never vest to each other. Payment is pull-based, the residue has a named
owner fixed at creation, and the market freezes at a timestamp set when it opens and never
movable. The 118 published conformance vectors run against it in CI; if anyone edits it, they
stop passing.

**`ClassicParimutuel`** is the rule the live Hunch product runs today, ported behind the same
interface: the pool is every stake and each winner takes it pro rata,
`floor(pool × stake / winningPrincipal)`. It rations nothing. It exists so the same market
can be shown settled both ways, which is the only honest way to show what the vested rule
changes.

The difference, stated precisely: under the classic rule the payout multiple per unit staked
is flat across arrival order. Under the vested rule it is strictly decreasing. A unit staked
seconds before the freeze earns the same multiple as one that carried the risk all day in the
first case, and cannot in the second.

## Resolution

`FeedResolver` is the market's `resolver`, so no human resolves anything. It reads a price
through `IPriceOracle` — one method, a price at 8 decimals and the second it was written —
and anyone may call it once the market has frozen. The caller has no influence on the answer
and earns nothing for the call.

The resolution spec is hashed into its own id, so the feed, strike, direction and staleness
bound a market settles against cannot be edited after stake is down. If the feed has gone
quiet past that bound, the market refuses to settle; voiding on that basis is a separate,
deliberate call, so a keeper retrying through a brief outage cannot accidentally void a good
market. A voided market refunds accepted principal.

`MarketFactory` opens the market and registers its spec in one transaction, so there is never
a window in which stake can land against rules nobody has committed to yet.

Which oracle ships is a deploy-time choice. Stork is the only provider with a published Arc
testnet address today; the Chainlink adapter is written and tested and needs only an address.

## Indexing

Agents cannot hammer an RPC to price a book. Two subgraphs and a Substreams package read the
same contracts three ways.

The `hunch-vpm` subgraph computes the derived quantities **in the mapping**, not in the
client: headroom per outcome, implied odds from accepted principal rather than from a quoted
price, vesting to date, and the payout a position would receive if the market resolved now.
A consumer asking where it can put money gets an answer, not a table to reduce.

The `erc8004-arc` subgraph takes Agent0's standardized ERC-8004 schema — published for
Ethereum, Base, BSC, Polygon and Monad, but not Arc — and retargets it at Arc's three
registries. One query pattern then spans agent identity and reputation on Base and on Arc,
with no new types for anyone already querying the standard schema.

## Identity

`@hunch-vpm/agentkit-tier` verifies an AgentKit proof against canonical AgentBook and tiers
on the result: a human-backed agent gets a higher rate limit, the full per-market cap and a
badge. Anonymous agents keep working. The point is tiering, not exclusion.

## What is not here

The venue never custodies. `@hunch-vpm/client` returns unsigned calldata for the caller's own
wallet and holds no key. No contract in this repo lets its deployer, the factory or the
resolver owner move a user's funds, which the invariant suite asserts directly by having an
address with no position try every method on every path.
