---
feature: deploy-ops
globs:
  - scripts/**
  - contracts/script/**
  - contracts/broadcast/**
  - contracts/src/oracles/**
  - contracts/foundry.toml
  - contracts/.gitignore
  - cre/**
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

Covers the deploy path and preflight, address wiring, oracles (Chainlink CRE relay), the resolver
keeper, subgraph deploys, CI, and Vercel.

## Current state — what's working, deployed, broken

**Arc testnet (all verified on Arcscan)**. Source of truth: `deployments/arc-testnet.json`.

| Contract | Address | Block |
|---|---|---|
| VestedParimutuel | `0xC743940C75619f65F6178b7e49c0C3A0bE012Eec` | 61840931 |
| ClassicParimutuel | `0x21603b2176aB8495A81fF3B3bE853C64f3860D57` | 61840931 |
| StorkOracle (unused, Stork is dead) | `0x5938F12246642aE8E6A47Efbaa72a454EafD4287` | 61840931 |
| FeedResolver | `0xd9Fde9112a5dE78075fae334D8A9a67fDcAee3f3` | 61840931 |
| MarketFactory | `0x0380C6FC136AE64432558e407706a5C7E7652f07` | 61840932 |
| **ChainlinkCreOracle** | `0x68A79146C52dcA1cBea8a0Da9aCF506D5894c621` (owner = deployer, forwarder = prod KeystoneForwarder `0x76c9…5E62`, **unconfigured: accepts nothing yet**) | 61858720 |

**Markets open** (2 USDC per side, kappa 30, voidTimeout 3 d, maxStaleness 5400 s, oracle = CRE adapter):
- `0xc743…2eec-0` BTC / USD ≥ $77,000 @ 2026-09-15 16:00 UTC, spec `0x49a5f58c…c0ff`
- `0xc743…2eec-1` ETH / USD ≥ $2,500 @ 2026-09-20 16:00 UTC, spec `0xa89bf6c8…70dc`

Deployer `0x763e…0dE0` (keystore `arc-deployer`, password-prompted, no `ETH_PASSWORD` file) holds
11.81 USDC.

**CRE relay — blocked on Chainlink, not on code.** CLI v1.33.0 is installed (`~/.cre/bin`) and logged
in as org `org_XOTc8zpv3UbdxKar`. `cre whoami` → **Deploy Access: Not enabled**. `cre account
access` needs a TTY (confirm + use-case prompt), so the operator must run it; the agent's shell
gets `could not open a new TTY`. `cre workflow simulate price-relay --target staging-settings
--non-interactive --trigger-index 0` passes: it compiles, reads ETH 2,478.55 / BTC 76,752.72 from
Sepolia, and encodes one report. Nothing has been relayed, so `read()` still reverts `NoValue()`.
**If access is not granted and deployed before 2026-09-15 16:00 UTC, the BTC market cannot resolve;**
it becomes voidable at 2026-09-18 16:00 UTC and refunds every position.

**Keeper:** `keeper.yml` is now a testnet + mainnet matrix (this branch). `KEEPER_PRIVATE_KEY` is
**not set** (`gh secret list` is empty), so it is a dry run. The last manual run reported `2 checked · 0 actionable ·
0 failed · dry run`. **The schedule has never fired**: zero `schedule`-event runs repo-wide in the
two hours after merge. Changing the workflow file on `main` re-registers it; check after merge.

**Subgraphs (09:52 UTC):** `hunch-vpm-arc-testnet` at head (61,880,042), no errors.
`erc-8004-arc-testnet` at 46,872,239 of ~61.88M at 10:19 UTC, no errors. The backfill rate is not
steady: ~1.7M blocks/h from 06:30 to 09:52 UTC, then ~0.24M blocks/h from 09:52 to 10:19 UTC. Head
could be anywhere from tonight to ~16 Sept, so re-measure rather than trusting an ETA.

**Mainnet:** not deployed. docs.arc.io still says "Arc is currently available on Testnet only". No
RPC, explorer or ERC-8004 registry addresses are published. Everything on our side is ready
(RUNBOOK "Arc mainnet": funding table, preflight, `OpenMarket.s.sol`, keeper job, Vercel vars).

## Verified facts (2026-09-13)

- **Native USDC = 18 dp; ERC-20 view `0x3600…0000` = 6.**
- **forge cannot simulate an Arc USDC transfer.** USDC's `transferFrom` calls a blocklist precompile
  at `0x1800…0001` that revm lacks, so it fails with `StackUnderflow`. `forge script --broadcast`
  simulates first, so no forge script can move USDC on Arc. `cast send`/`cast estimate` go through
  the node and work (the raw calldata form too).
- **Stork on Arc testnet is dead:** last push 2026-06-14, block 47,013,326. `getTemporalNumericValueV1`
  reverts `StaleValue()` (validity 3600 s). Pushing needs a Stork API key.
- **Pyth on Arc testnet** `0x2880…C17B43` (v1.4.5-alpha.1): Arc testnet was left out of the Pyth
  Core upgrade (2026-08-26), and Hermes now needs an API key (`pyth.dourolabs.app/hermes`). Rejected.
- **Chainlink Data Feeds: Arc MAINNET only.** 30 feeds in `feeds-arc-mainnet.json`: ETH/USD proxy
  `0x50FCDD99D6762D1C170DC6A9111db944AEE6D364`, BTC/USD `0xa109B535C70C8Be9995be64Bb6751AcDB27e03De`,
  8 dp, 24 h heartbeat. There are none on testnet.
- **CRE on Arc testnet:** production KeystoneForwarder `0x76c9cf548b4179F8901cda1f8623568b58215E62`
  ("KeystoneForwarder 1.0.0", has code). The simulation MockKeystoneForwarder `0x6E9E…dc1` checks no
  signatures, so it is never trusted. CLI ≥ 1.0.7; deploy access is gated (`cre account access`).
  The CLI installs with `curl -sSL https://app.chain.link/cre/install.sh | bash`, which redirects to
  `smartcontractkit/cre-cli` on GitHub.
- **Sepolia source feeds** (on-chain `description()` checked): ETH/USD
  `0x694AA1769357215DE4FAC081bf1f309aDC325306`, BTC/USD `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43`,
  8 dp, fresh.
- `@chainlink/cre-sdk@1.21.0` is a broken publish (`workspace:*` dep); pinned 1.20.0.
- **Shell limits.** Hooks block `curl`, `ruby`, `node` and `rm`; `timeout` is absent. bun
  (`Bun.YAML.parse`), pnpm scripts, forge and cast work. For Studio/Hermes POSTs, use the Browser
  pane's JS `fetch` from the target origin.
- Mainnet: launch 16 Sept, chain 5042. Chainlink docs name `explorer.arc.io`; the RPC is unpublished.

## Recent changes — files touched and why

- **This branch (`claude/cre-login-error-5472df`):**
  - `contracts/script/OpenMarket.s.sol` + `test/OpenMarket.t.sol` (14 tests). It checks, then prints
    `cast send` commands, ids and the `markets[]` entry, and sends nothing because of the precompile trap.
    The tests send the printed calldata and assert the predicted ids. Checked live on testnet: it
    refuses the CRE adapter (`NoValue`) and, with `SKIP_FEED_CHECK`, predicts market 2.
  - `.github/workflows/keeper.yml` — matrix per network; mainnet reads the `ARC_MAINNET_RPC_URL` variable
    and the `KEEPER_PRIVATE_KEY_MAINNET` secret; chain-id guard on file and RPC. The step script ran locally in
    all four paths (testnet run, mainnet absent, mainnet without RPC → red, wrong chain → red).
  - `apps/web`: `ResolutionPanel`, `ClaimList`, agents `Row` pass the network's `ChainFacts` to
    `AddressLink` (they linked testnet's explorer on mainnet).
  - Docs: `cre/README.md` (install the CLI, access status, simulate command), RUNBOOK (CRE status,
    the checked market script, the keeper matrix and a note that the schedule never fired, the mainnet funding table and order).
- Earlier: `ChainlinkCreOracle` + tests + deploy script, `cre/price-relay`, deployments `markets[]`,
  `wire-deployment.mjs` optional keys, web `chainlinkCreOracle`, `vercel.json`.

## Key decisions

- **Chainlink over Pyth/Stork** — the user asked for Chainlink (a hackathon sponsor). The testnet route is
  CRE, not Data Feeds; mainnet uses `ChainlinkFeedOracle` directly.
- **The adapter fails closed**: forwarder-only, requires workflow owner/id, and `lock()` makes it trustless.
- **Store the source round timestamp**, so staleness is honest; maxStaleness 5400 s over a 1 h heartbeat.
- **Markets opened before the relay runs.** Harmless: the keeper waits, and after voidTimeout anyone voids
  with full refunds.
- **Keeper on GitHub Actions**: no raw key ever passed through the agent; the operator sets the secret.
- **Market script prints, never broadcasts** — forced by the precompile, and it keeps the signing
  step in `cast` where the keystore prompt already lives.
- **Mainnet funds go to the existing deployer address** (same keystore, same address on every chain)
  plus a fresh keeper key. 10 USDC to the deployer and 1 to the keeper.

## Traps

- `vercel link` appends `.env*` to `.gitignore`, which would ignore `.env.example`. Revert it.
- `vercel env` needs the worktree linked (`vercel link --yes --project hunch-vpm --scope rajkaria67-1831s-projects`).
- **18 vs 6 decimals**; `| tee` without pipefail; **empty forge-std in a new worktree** (`git submodule
  update --init --recursive`); `graph build --network` rewrites the manifest.
- `forge fmt --root contracts <path>` ignores `--root` for path args. Run `forge fmt <path>` from `contracts/`.
- **forge + Arc USDC transfers = `StackUnderflow`**; send with `cast`.
- Web `/m/[id]` has `dynamicParams = false` — a new market id needs a redeploy.
- `cre account access` and `cre workflow simulate` prompt; pass `--non-interactive --trigger-index 0`
  to simulate, and run `access` yourself.

## Next steps

1. **Operator, today:** run `cre account access` in a real terminal (it prompts). Nothing else unblocks
   the BTC market before 2026-09-15 16:00 UTC.
2. **Once access is granted:** from `cre/`, `cre workflow deploy price-relay --target
   production-settings` → `setExpectedWorkflowId` (and/or `setExpectedAuthor`) with `--account
   arc-deployer` → `cast call … read(bytes32)` shows a price / `PriceRelayed` log → `lock()`.
3. **Operator (keeper):** `cast wallet new`, fund ~1 testnet USDC, `gh secret set KEEPER_PRIVATE_KEY`.
   Merge this branch, then confirm `gh run list --workflow keeper.yml --event schedule` is non-empty and
   `settle (testnet)` says `live`.
4. Walk a real wallet stake on production (approve → enter → claim) — needs a human wallet.
5. Re-check `erc-8004-arc-testnet` `_meta.block` against head (`cast block-number --rpc-url
   https://rpc.testnet.arc.io`). The rate varies too much for an ETA.
6. Mainnet on/after 16 Sept: RUNBOOK "Arc mainnet", in order.
