# Hunch VPM — context index

The Vested Parimutuel, on Arc. Mechanism, architecture and operations live in
[`docs/`](docs); this file is only the router index.

Per-feature context lives in `docs/context/`. Each doc's `globs:` frontmatter says which
source paths it covers, so touching those files loads that doc and nothing else. **Keep this
file thin — an index, never session prose.**

| Doc | Covers |
|---|---|
| [`docs/context/web-venue.md`](docs/context/web-venue.md) | `apps/web` — wallet layer, testnet/mainnet toggle, staking and the acceptance estimate, claims, portfolio, design system |
| [`docs/context/deploy-ops.md`](docs/context/deploy-ops.md) | Deploy path and preflight, verified Arc network facts, subgraph deploys, the resolver keeper, CI, Vercel |
| [`docs/context/submission.md`](docs/context/submission.md) | ETHOnline 2026 submission, checklist and demo script |

## Standing facts

- **`pnpm verify` is the single gate.** CI runs the same thing.
- **USDC is Arc's native gas token, with two views of one balance.** Natively (gas,
  `msg.value`, `eth_getBalance`, viem `nativeCurrency`) it is **18 decimals**. Through the
  ERC-20 interface at `0x3600…0000` (`balanceOf`, `approve`, `transferFrom` — how every stake
  moves) it is **6**. Raw values differ by exactly 10^12. Verified on-chain; this file said
  "six, not 18" until it was checked, and it was wrong.
- **Nothing of ours is deployed.** Every committed contract address is the zero address, on
  purpose. A network with no file in `deployments/` has not been deployed to.
- **The venue never custodies.** `@hunch-vpm/client` returns unsigned calldata and holds no
  key; the invariant suite asserts no contract lets anyone move a user's funds.
- **No secret is ever committed.** `.env` and `.env.*` are excluded, `.env.example` is kept.
  Credentials have no defaults anywhere — an honest absence beats a placeholder that
  half-works.
