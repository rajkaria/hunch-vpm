---
feature: deploy-ops
globs:
  - scripts/**
  - contracts/script/**
  - contracts/foundry.toml
  - contracts/.gitignore
  - deployments/**
  - agent/src/keeper/**
  - subgraph/package.json
  - subgraph-erc8004-arc/networks.json
  - docs/RUNBOOK.md
  - .github/workflows/**
  - vercel.json
updated: 2026-09-13
---

# Deploying and operating the venue

Covers the deploy path and preflight, the resolver keeper, subgraph deploys, CI, and Vercel.

## Current state — what's working, deployed, broken

**Deployed:** web surface only — Vercel project `hunch-vpm`, <https://hunch-vpm.vercel.app>,
auto-deploys on push to `main`. **Nothing on-chain; neither subgraph published.**

**Merged (PR after PR #8):** the native-USDC decimals fix (native 18 / ERC-20 6), documented
testnet RPC, Blockscout verification with no API key, the dry-run ignore fix, and Studio deploy
scripts. `pnpm verify` PASSED end to end with nothing else running. Never run verify alongside
`next dev` or a forge simulation — an agent test times out under that load.

**Testnet deploy is proven viable without spending anything.** Stock Foundry 1.5.1 simulated
`Deploy.s.sol` against live Arc testnet (no `--broadcast`): all five contracts deploy, ~7.35M
gas. Forge prints "0.30 ETH" — on Arc that is native USDC at 18 decimals, so **~0.30 USDC**.
`arc-forge` (Arc's Foundry fork in their docs) is not required for this script.

**Preflight run live against testnet:** RPC ok, chain 5042002, Stork has code, Blockscout
verification ready. Still refuses: **no keystore** (`~/.foundry/keystores/` empty), no Graph
Studio auth on the machine.

## Verified Arc facts (checked 2026-09-13, primary sources + on-chain)

- **Native USDC = 18 decimals; ERC-20 view at `0x3600…0000` = 6.** One balance. On-chain: one
  holder reads 3,141,473,534,331 via `balanceOf` and ×10^12 via `eth_getBalance`. The repo said
  "6 natively" everywhere — wrong, now fixed in web/client/mcp/keeper/preflight/docs.
- **Testnet:** chain 5042002, RPC `https://rpc.testnet.arc.io` (docs' primary; old
  `rpc.testnet.arc.network` still answers), explorer `https://testnet.arcscan.app`, faucet
  `https://faucet.circle.com`.
- **Arcscan is Blockscout** → verify with `--verifier blockscout --verifier-url
  https://testnet.arcscan.app/api/`, **no API key**. The old `ARCSCAN_API_KEY` never existed and
  the preflight would have skipped verification silently.
- **Mainnet: public launch 16 Sept 2026** (Circle pressroom). Chain id **5042** (The Graph lists
  slug `arc` = eip155:5042). **Official RPC and explorer NOT published yet** — Circle publishes
  at launch. Ignore third-party "mainnet RPC" claims.
- **Oracles on mainnet: none verified.** Stork lists Arc testnet only. Arc joined Chainlink Scale
  (Data Feeds among products) but no Arc feed addresses found. **Mainnet markets cannot resolve
  until one exists.**
- **ERC-8004 registries:** testnet addresses live (have code); no mainnet addresses published.
- **The Graph:** supports `arc-testnet` and `arc`; graph-cli 0.98.1 builds `--network arc`.

## Recent changes — files touched and why

- `scripts/preflight-deploy.sh` — native balance read at 18 decimals; Blockscout verify flags
  always printed for testnet, mainnet only once `ARC_VERIFIER_URL` is set.
- `contracts/foundry.toml` — removed the `[etherscan]` entry that demanded a nonexistent key.
- `contracts/.gitignore` — `broadcast/*/dry-run/` never matched (forge nests two levels); now
  `broadcast/**/dry-run/`. Real broadcast receipts stay trackable.
- `subgraph/package.json` — `deploy:testnet`/`deploy:mainnet` target Subgraph Studio (old script
  used the retired hosted service).
- `agent/src/keeper/cli.ts` — native currency 18 decimals.
- `docs/RUNBOOK.md`, `deployments/README.md`, `docs/SUBMISSION-CHECKLIST.md` — Blockscout
  verification, no API key, stock-forge note with the ~0.30 USDC figure.

## Key decisions — choices and trade-offs, why X over Y

- **Keeper is its own binary**, not an agent subcommand — it holds gas money only.
- **`--allow-void` OFF by default** — a wrongly voided market cannot be un-voided.
- **Dry run default; `--live` without a key is an error**, never a silent downgrade.
- **No guessed mainnet RPC/explorer/oracle anywhere.** Each is config until published.
- **Verification on the CLI, not in foundry.toml** — Blockscout needs no key, and a toml entry
  interpolating an unset key only fails at the worst moment.
- **`.ocean/` stays untracked** (repo gitignores it; public submission repo).

## Traps that cost money

- RPC answering but on the **wrong chain** (preflight checks).
- **18 vs 6 decimals** — `cast balance`/gas are 18; `balanceOf`/stakes are 6.
- Unrecognised `ORACLE_KIND` silently becomes Stork.
- `Deploy.s.sol` writes no file — cut the JSON out of `deploy.log`.
- `forge script --account` prompts for the password interactively — the operator runs it, or a
  `--password-file` is supplied.
- `graph build --network X` **rewrites `subgraph.yaml` in place** — never run it as a probe.

## Next steps

1. **Testnet deploy:** operator runs `cast wallet import arc-deployer --interactive`, funds it
   (~1 USDC is plenty) at faucet.circle.com, `export ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io`,
   `bash scripts/preflight-deploy.sh arc-deployer testnet`, runs the printed command.
2. Cut `deployments/arc-testnet.json`; wire addresses through the **six** places in RUNBOOK;
   record head block as subgraph `startBlock`.
3. **Subgraphs (testnet):** operator creates two Studio subgraphs (Arc Testnet) and runs
   `npx graph auth <key>` locally. Deploy `erc8004-arc` now (addresses already set), `hunch-vpm`
   after step 3. Put the keyless Studio query URLs in Vercel env.
4. Run `node agent/dist/keeper/main.js --help` once; then schedule it on testnet.
5. **Mainnet, after 16 Sept:** take chain id/RPC/explorer from docs.arc.io; set
   `ARC_MAINNET_RPC_URL`, `NEXT_PUBLIC_ARC_RPC_URL`, `NEXT_PUBLIC_ARC_EXPLORER_URL`,
   `ARC_VERIFIER_URL`; **obtain a verified oracle** (Stork mainnet address or a Chainlink Arc
   feed) — blocking; mainnet subgraph slug `arc`; ERC-8004 mainnet addresses when published.
