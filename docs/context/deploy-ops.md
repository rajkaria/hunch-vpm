---
feature: deploy-ops
globs:
  - scripts/**
  - contracts/script/**
  - contracts/broadcast/**
  - contracts/foundry.toml
  - contracts/.gitignore
  - deployments/**
  - agent/src/keeper/**
  - subgraph/package.json
  - subgraph/networks.json
  - subgraph/subgraph.yaml
  - subgraph/tools/**
  - subgraph-erc8004-arc/networks.json
  - docs/RUNBOOK.md
  - .github/workflows/**
  - vercel.json
updated: 2026-09-13
---

# Deploying and operating the venue

Covers the deploy path and preflight, address wiring, the resolver keeper, subgraph deploys, CI,
and Vercel.

## Current state — what's working, deployed, broken

**Deployed on Arc testnet (2026-09-13), all five verified on Arcscan** — `deployments/arc-testnet.json`:

| Contract | Address | Block |
|---|---|---|
| VestedParimutuel | `0xC743940C75619f65F6178b7e49c0C3A0bE012Eec` | 61840931 |
| ClassicParimutuel | `0x21603b2176aB8495A81fF3B3bE853C64f3860D57` | 61840931 |
| StorkOracle (adapter) | `0x5938F12246642aE8E6A47Efbaa72a454EafD4287` | 61840931 |
| FeedResolver | `0xd9Fde9112a5dE78075fae334D8A9a67fDcAee3f3` | 61840931 |
| MarketFactory | `0x0380C6FC136AE64432558e407706a5C7E7652f07` | 61840932 |

Deployer / keystore `arc-deployer` = `0x763e4A729cF78e33B8fdE36B9b6f29bBce120dE0` (password file
`~/.foundry/arc-deployer.password`, mode 600, outside the repo). Gas ~0.123 USDC; ~19.88 left.

**Wired** into all four committed readers by `pnpm wire:testnet`; `pnpm wire:check` is a
`pnpm verify` stage. Web: `https://hunch-vpm.vercel.app` (auto-deploys `main`).

**Not done:** neither subgraph is published — both **build** against arc-testnet with the real
addresses; only the Studio deploy key is missing (operator: create `hunch-vpm-arc-testnet` and
`erc8004-arc-testnet` on Arc Testnet in Studio, run `graph auth`). Env readers not set anywhere:
MCP `HUNCH_VPM_SETTLER_ADDRESS`/`HUNCH_VPM_CLASSIC_SETTLER_ADDRESS`, agent `HUNCH_SETTLER`.
Nothing on mainnet. No market opened yet.

## Verified Arc facts (checked 2026-09-13, primary sources + on-chain)

- **Native USDC = 18 decimals; ERC-20 view at `0x3600…0000` = 6.** One balance (faucet's 20 USDC
  read 20e18 native, 20e6 via `balanceOf`).
- **Testnet:** chain 5042002, RPC `https://rpc.testnet.arc.io`, explorer
  `https://testnet.arcscan.app`, faucet `https://faucet.circle.com` (CAPTCHA — operator only;
  no faucet MCP exists).
- **Arcscan is Blockscout**, no API key. It **rate-limits** (`Too many requests`): `--verify`
  and `forge verify-contract` both failed on FeedResolver/MarketFactory. **Blockscout v2
  standard-input** (`POST /api/v2/smart-contracts/<addr>/verification/via/standard-input`,
  multipart, `compiler_version=v0.8.28+commit.7893614a`) worked first try.
- **Mainnet: public launch 16 Sept 2026**, chain 5042; RPC/explorer unpublished; **no verified
  oracle** — mainnet markets cannot resolve until one exists.
- **The Graph:** `arc-testnet` and `arc`; graph-cli 0.98.1. Studio subgraphs must be created in
  the UI before `graph deploy`.

## Recent changes — files touched and why

- `scripts/preflight-deploy.sh` — Foundry 1.5 lists `name (Local)`, so the exact match refused a
  real keystore; `ETH_PASSWORD` password-file support; **compiles first** (empty forge-std in a
  worktree failed the first deploy); balance floor 0.35 USDC; printed command has `pipefail`
  (`| tee` had masked forge's failure) and `pnpm wire:<network>`.
- `scripts/wire-deployment.mjs` (new) — writes `subgraph/networks.json`, `subgraph/subgraph.yaml`,
  `packages/client/src/addresses.ts`, `apps/web/src/lib/chain.ts` (+ web-only `priceOracle`) from
  `deployments/arc-<net>.json`; derives `startBlocks` from broadcast receipts; checks code via RPC;
  `--check` mode. `scripts/verify.sh` runs it.
- `package.json` — `wire:testnet|mainnet|check`, `preflight:testnet`.
- `subgraph/package.json` + `subgraph/tools/with-network.mjs` — `deploy:testnet`/`deploy:mainnet`
  via the restore-the-manifest wrapper; stray `deploy:studio` (slug `hunch-vpm`) removed.
- `contracts/broadcast/Deploy.s.sol/5042002/` — receipts committed (no secrets; sensitive values go
  to ignored `cache/`).
- Docs: RUNBOOK, deployments/README, SUBMISSION, SUBMISSION-CHECKLIST, DEMO, package READMEs,
  CLAUDE.md standing fact.

## Key decisions — choices and trade-offs, why X over Y

- **Wiring is a script with a check, not a table in the runbook** — four readers that cannot
  import each other drift silently; the gate now fails instead.
- **Start blocks live in the deployments file**, so the record outlives `broadcast/`.
- **Keeper is its own binary**; **`--allow-void` OFF by default**; **dry run default**.
- **No guessed mainnet RPC/explorer/oracle anywhere.**
- **Verification on the CLI / v2 API, not in foundry.toml.**
- **Deploy key never enters the repo or chat** — `graph auth` stores it in graph-cli's config.

## Traps that cost money

- RPC answering on the **wrong chain** (preflight checks; wire script checks code).
- **18 vs 6 decimals** — `cast balance`/gas are 18; `balanceOf`/stakes are 6.
- Unrecognised `ORACLE_KIND` silently becomes Stork.
- **Empty `contracts/lib/forge-std` in a new worktree** — `git submodule update --init --recursive`.
- **`| tee` without `pipefail`** reports a failed deploy as success.
- `Deploy.s.sol` writes no file — cut the JSON from `deploy.log`, then `pnpm wire:testnet`.
- `graph build/deploy --network X` **rewrites `subgraph.yaml` in place** — use the package scripts.

## Next steps

1. **Operator:** in Subgraph Studio create `hunch-vpm-arc-testnet` and `erc8004-arc-testnet`
   (network Arc Testnet); run `pnpm --dir subgraph exec graph auth <DEPLOY_KEY>` locally.
2. Deploy both: `pnpm --filter @hunch-vpm/subgraph-erc8004-arc run deploy:arc-testnet --version-label v0.0.1`
   and `pnpm --dir subgraph run deploy:testnet --version-label v0.0.1`.
3. Put the keyless Studio query URLs in Vercel as `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL_TESTNET` and
   `NEXT_PUBLIC_ERC8004_SUBGRAPH_URL_TESTNET`; open a market via MarketFactory, add its id to
   `NEXT_PUBLIC_HUNCH_MARKET_IDS_TESTNET`.
4. Set the env readers (MCP, agent); run the keeper `--help`, then schedule it on testnet.
5. **Mainnet, after 16 Sept:** RPC/explorer from docs.arc.io, a verified oracle (blocking), then
   the same preflight → deploy → `pnpm wire:mainnet` path.
