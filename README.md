# Hunch VPM

**The Vested Parimutuel, on Arc.** An open-source, USDC-native prediction market where every
stake vests the moment it lands, AI agents backed by verified humans trade it, and the whole
book is readable through The Graph.

- Mechanism paper: [*The Vested Parimutuel*](https://www.playhunch.xyz/vpm-whitepaper)
- Parent product: [Hunch](https://www.playhunch.xyz)
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Operations: [`docs/RUNBOOK.md`](docs/RUNBOOK.md)
- Submission: [`docs/SUBMISSION.md`](docs/SUBMISSION.md) · Checklist: [`docs/SUBMISSION-CHECKLIST.md`](docs/SUBMISSION-CHECKLIST.md)

## Why

Order-book prediction markets only quote questions a market maker shows up for. Pools work
from the first dollar — but a classic pool pays late money the same multiple as early money,
so whoever takes the risk at open is diluted by whoever arrives ten seconds before the buzzer
already knowing the answer.

Measured on Hunch's own tape — 5,291 resolved markets, 779,549 trades — winners entering in
the last decile captured a median 70.1% of the losing pool, and early winners were diluted by
a median 38.7%. Under the vested parimutuel, stake vests into the opposing books the moment it
lands and is accepted only up to the capacity those books have to cover it. On the same tape
the last-decile share falls to 0.08% and early dilution to 0.00%. Those figures and the replay
that produced them are in the paper, §13.4; this repository is the mechanism, not the study.

And today none of it is on-chain: every Hunch bet settles against a Postgres book with the
operator as resolver, payer and custodian. This repository puts the mechanism on Arc, indexes
it through The Graph, and ties agent identity to a verified human.

## Run it

Requires Node 20+, [pnpm](https://pnpm.io) and [Foundry](https://getfoundry.sh).

```bash
git clone --recurse-submodules https://github.com/rajkaria/hunch-vpm
cd hunch-vpm
pnpm install
pnpm verify          # contracts + workspace: build, typecheck, test
```

`pnpm verify` is the single gate; CI runs the same thing. Individual pieces:

```bash
forge test --root contracts -vv              # the settlement layer
pnpm --filter @hunch-vpm/client test         # the typed client and the Arc rail
pnpm --filter @hunch-vpm/web dev             # the market surface, on fixtures, no network
node agent/dist/cli/main.js research         # the demo agent, dry-run
```

The market surface is live at **<https://hunch-vpm.vercel.app>** — serving the fixture
dataset, because no contract is deployed yet. Every manifest and address file carries an
explicit zero-address placeholder, and the agent defaults to dry-run. The site says so on
every page rather than implying a book that does not exist.
[`docs/RUNBOOK.md`](docs/RUNBOOK.md) is the deploy path for the rest.

## What is in here

| Path | What |
|---|---|
| [`contracts/`](contracts) | the settlement layer: two settlers behind one interface, a feed resolver, a market factory, oracle adapters |
| [`subgraph/`](subgraph) | the book indexed as decisions — headroom, implied odds, vesting, preview payouts |
| [`subgraph-erc8004-arc/`](subgraph-erc8004-arc) | the standardized ERC-8004 schema, retargeted at Arc's registries |
| [`substreams/`](substreams) | a Rust package streaming market and position tables off the same events |
| [`packages/client/`](packages/client) | typed reads that answer questions, viem writes that never hold a key, and the Arc settlement rail |
| [`packages/mcp/`](packages/mcp) | three MCP tools, so any agent can use the venue without this SDK |
| [`packages/agentkit-tier/`](packages/agentkit-tier) | human-backed agent verification and tiering |
| [`agent/`](agent) | a demo agent on a Circle Agent Wallet, paying for intel with nanopayments |
| [`apps/web/`](apps/web) | the market surface |
| [`skills/hunch-vpm/`](skills/hunch-vpm) | a SKILL that teaches an agent the mechanism and the tools |

## The mechanism, in one paragraph

Stake offered on an outcome vests into the *opposing* books as it arrives, and is accepted
only up to the headroom those books have left — `H = capacity − vested`. Beyond that it is
refused and refunded, which is a normal outcome and not an error. Entries in the same block
form one vintage and never vest to each other. The market freezes at a timestamp fixed when it
opens, settlement is pull-based, and the flooring remainder has a named owner set at creation.
The consequence, which `ClassicParimutuel` exists to show side by side: the payout multiple per
unit staked is flat across arrival order under a classic pool, and strictly decreasing under
this one.

## Provenance

This is a new feature of an existing product, so the line between the two matters.

**Pre-existing**, and vendored or depended on rather than written here: the Vested Parimutuel
paper and its 118 conformance vectors; `VestedParimutuel.sol` and its Foundry suite (see
[`contracts/VENDORED.md`](contracts/VENDORED.md)); Hunch's `HunchParimutuelVault`, agent rail,
MCP server, x402 implementation and published SDKs; Base settlement; the market catalogue.

**New in this repository**: `FeedResolver` and its oracle adapters; `MarketFactory`; the
`ClassicParimutuel` port behind a shared settler interface; the `hunch-vpm` subgraph; the
ERC-8004 subgraph for Arc; the Substreams package; `@hunch-vpm/client` and the Arc settlement
rail; `@hunch-vpm/mcp` and the SKILL; `@hunch-vpm/agentkit-tier`; the demo agent; the web
surface; and the documentation under `docs/`.

## License

MIT — see [LICENSE](LICENSE). `VestedParimutuel.sol` is vendored from the paper's reference
implementation, also MIT.
