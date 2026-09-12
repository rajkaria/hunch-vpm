---
feature: deploy-ops
globs:
  - scripts/**
  - contracts/script/**
  - deployments/**
  - agent/src/keeper/**
  - docs/RUNBOOK.md
  - .github/workflows/**
  - vercel.json
updated: 2026-09-12
---

# Deploying and operating the venue

Covers the deploy path, the resolver keeper, CI, and the Vercel project.

## Current state — what's working, deployed, broken

**Deployed:** the web surface only — Vercel project `hunch-vpm`, production at
<https://hunch-vpm.vercel.app>, connected to the GitHub repo so a push to `main` redeploys.

**Not deployed:** everything on-chain. `deployments/` has no address file, and a network with
no file has not been deployed to. Neither subgraph is published.

**CI is green** on all three jobs for the first time. Two stacked bugs were fixed: `hashFiles()`
is illegal in a job-level `if` (it killed the whole workflow at compile time — every run
finished in 0s with no jobs), and `pnpm/action-setup` was pinned to `version: 10` while
`package.json` pins `packageManager: pnpm@10.33.0`.

**`pnpm verify` is green** — it was failing before this session: matchstick shells out to
`<package>/node_modules/assemblyscript/bin/asc`, which pnpm's isolated layout never creates.
`assemblyscript@0.19.23` is now a direct devDependency of both subgraph packages (graph-ts
pulls `0.27.31`, whose bin is `asc.js` and does not satisfy the path matchstick builds).

**The keeper** (`agent/src/keeper/`) is written, tested (26 tests) and documented, but its
**binary has never been executed** — `node` is blocked in this sandbox. `runKeeperCli` is
covered directly including `--help` and every validation branch; `main.js` is a six-line shim.

**Blocked on credentials the machine does not have:** no Foundry keystore
(`~/.foundry/keystores/` does not exist), no `ARC_TESTNET_RPC_URL`, no `ARCSCAN_API_KEY`, no
Graph Studio deploy key.

## Recent changes — files touched and why

- `scripts/preflight-deploy.sh` **(new)** — read-only checks before a deploy spends gas.
  Refuses rather than warns; prints the exact deploy command on a clean pass.
- `agent/src/keeper/` **(new)** — `decide.ts` (pure), `run.ts`, `chain.ts`, `cli.ts`,
  `main.js`; `hunch-keeper` added to the agent's `bin`.
- `.github/workflows/ci.yml` — removed the job-level `hashFiles()` guard and the pnpm version
  pin.
- `docs/RUNBOOK.md` — new "The keeper" section with a cron line, a preflight section, the five
  new web environment variables, and a corrected clean-clone step (`forge-std` has been a
  pinned **submodule** since `93f9e35`; the old "there are no git submodules" line was false).
- `subgraph/package.json`, `subgraph-erc8004-arc/package.json` — `assemblyscript` devDependency.
- `contracts/foundry.lock` — pins the forge-std submodule revision.

## Key decisions — choices and trade-offs, why X over Y

- **The keeper is its own binary**, not an agent subcommand. Different jobs, different risk:
  the agent holds a bankroll, the keeper holds only gas money and decides nothing. Threading
  it through the agent's CLI would put a settlement key in a process with no need of one.
- **`--allow-void` is OFF by default.** `resolve` reverts rather than voids on a stale reading
  precisely so a keeper retrying through a brief outage cannot destroy a market that still had
  a good answer coming. `--void-after` adds a second belt. **A wrongly voided market cannot be
  un-voided.** Eleven tests pin this.
- **Dry run is the default**, and `--live` without a key is an **error**, not a silent
  downgrade — an operator who believes markets are settling while nothing is sent is worse off
  than one who gets an exit code.
- **`.ocean/` stays untracked.** `.gitignore` excludes it as local tooling state, and this is a
  public submission repo. Run memory lives on disk, which is what `resume` reads.

## Traps that cost money (all checked by the preflight)

- The RPC answering but being **the wrong chain**.
- USDC is the **native gas token at SIX decimals**, not 18 — the easiest number on Arc to misread.
- An unrecognised `ORACLE_KIND` falls through to Stork **silently**.
- `Deploy.s.sol` **writes no file**; it logs a JSON block that must be cut out of `deploy.log`.
- `forge script --account` **prompts for the keystore password interactively**, which an agent
  cannot reliably drive. Either the operator runs it, or a `--password-file` is supplied.

## Next steps

1. **Testnet deploy.** Operator creates the keystore (`cast wallet import arc-deployer
   --interactive`), funds it with testnet USDC, exports `ARC_TESTNET_RPC_URL`, then
   `bash scripts/preflight-deploy.sh arc-deployer testnet`.
2. Cut `deployments/arc-testnet.json` from the run, wire the addresses through the **six**
   unlinked places listed in `docs/RUNBOOK.md`.
3. Deploy `erc8004-arc` (needs only a Graph Studio key — deployable today, independent of 1),
   then `hunch-vpm` after 2.
4. Set `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` + `NEXT_PUBLIC_HUNCH_MARKET_IDS` on Vercel — keyless
   Studio URL only; the build fails on a keyed one, by design.
5. Run `node agent/dist/keeper/main.js --help` once before relying on the keeper.
6. Mainnet is gated on an audit — `FeedResolver`, `MarketFactory`, `ClassicParimutuel` and the
   oracle adapters are new, unaudited code that holds user funds.
