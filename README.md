# Hunch VPM

**The Vested Parimutuel, live on Arc.** An open-source, USDC-native prediction market where
every stake vests the moment it lands, AI agents backed by verified humans trade it, and the
whole book is readable through The Graph.

- Mechanism paper: [*The Vested Parimutuel*](https://www.playhunch.xyz/vpm-whitepaper)
- Parent product: [Hunch](https://www.playhunch.xyz)
- Built for [ETHOnline 2026](https://ethglobal.com/events/ethonline2026), Continuity Track

## Why

Order-book prediction markets only quote questions a market maker shows up for. Pools work from
the first dollar — but a classic pool pays late money the same multiple as early money, so
whoever takes the risk at open is diluted by whoever arrives ten seconds before the buzzer
already knowing the answer.

Measured on Hunch's own tape — 5,291 resolved markets, 779,549 trades — winners entering in the
last decile captured a median **70.1%** of the losing pool, and early winners were diluted by a
median **38.7%**. Under the vested parimutuel, stake vests into the opposing books the moment it
lands and is accepted only up to the capacity those books have to cover it. On the same tape the
last-decile share falls to **0.08%** and early dilution to **0.00%**.

And today none of it is on-chain: every Hunch bet settles against a Postgres book with the
operator as resolver, payer and custodian. This repo puts the mechanism on Arc, indexes it
through The Graph, and ties agent identity to a verified human.

## How it fits together

```
              Arc (chain 5042002, USDC as native gas)
              ├─ VestedParimutuel   flow vesting + capacity matching, pull-based claims
              ├─ ClassicParimutuel  same interface, for side-by-side comparison
              └─ FeedResolver       permissionless resolution from a price feed
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
   The Graph                         World
   market book, headroom,            AgentBook proof binds an agent
   vesting, positions,               to a human; Selfie Check gates
   ERC-8004 reputation               prize eligibility (never trading)
        │
        ▼
   agents — typed client, MCP tools, a demo agent on a Circle Agent Wallet
```

**Stack.** Solidity 0.8.28 + Foundry · graph-cli / AssemblyScript · Substreams (Rust) ·
TypeScript + viem · Next.js (App Router) · Circle Agent Wallets · World AgentKit + IDKit.

## Status

Scaffolding. Contracts, subgraphs and the web surface land over the course of the event; the
commit history is the record.

## Continuity declaration

This is a new feature of an existing product, so the line matters.

**Pre-existing, built before the event and not judged:** the Vested Parimutuel paper and its 118
conformance vectors; `VestedParimutuel.sol` and its Foundry suite; Hunch's `HunchParimutuelVault`;
Hunch's agent rail, MCP server, x402 implementation and published SDKs; Base settlement; the
market catalogue.

**New, built here during the event:** `FeedResolver` and its oracle adapters; `MarketFactory`;
the `ClassicParimutuel` port behind a shared settler interface; Arc deployment and verification;
the `hunch-vpm` subgraph; an ERC-8004 subgraph for Arc; the Substreams package; the typed client,
agent-tiering and eligibility packages; the MCP tools and agent SKILL; the demo agent; the web
surface at `vpm.playhunch.xyz`; and the Arc settlement rail in the parent app.

## License

MIT. See [LICENSE](LICENSE). `VestedParimutuel.sol` is vendored verbatim from the paper's
reference implementation, also MIT.
