# Submission checklist

Everything between here and a submitted project, in dependency order. Each item says who it is
blocked on and what "done" looks like. The judge-facing write-up is
[`SUBMISSION.md`](SUBMISSION.md); this file is the operator's list.

Legend: **[you]** needs a credential, a wallet, a recording or a DNS record that only the
operator has. **[either]** is mechanical once its blocker clears.

---

## Done

- [x] `pnpm verify` green — 1,190 tests across contracts, workspace and Substreams
- [x] CI green on all three jobs (`contracts`, `workspace`, `substreams`)
- [x] Market surface deployed to production — <https://hunch-vpm.vercel.app>
- [x] Vercel project connected to the repository; a push to `main` redeploys
- [x] Submission write-up drafted
- [x] **The venue is built.** Connect Wallet (no Privy), Arc add/switch, approve + enter with
      the acceptance estimate shown before signing, the three-state entry flow the contract
      actually has, address-driven claims, a portfolio, a resolver keeper, and the four
      degraded states. 181 web + 211 agent tests. It is gated on deployment, not on code —
      see `.ocean/REPORT.md`

---

## Blocking — the project cannot be submitted without these

### 1. Record the demo video **[you]**

ETHOnline requires a demo video and there is no recording in this repository.

[`DEMO.md`](DEMO.md) is a complete four-minute script in seven beats, with the exact command
or click for each. **Every beat runs on fixtures** — no deploy, no key, no network — so this
can be recorded right now, before anything below is done.

Before recording:

```sh
pnpm install
pnpm --filter @hunch-vpm/agent build
pnpm --filter @hunch-vpm/web dev
```

Terminal width matters: the decision table is **105 columns**, and the closing nanopayments
summary is **187**. Pick which one you would rather not wrap. Load `/`,
`/m/eth-3000-sep30` and `/agents` once before recording so the first beat is not a compile.

Record against <https://hunch-vpm.vercel.app> rather than localhost if you would rather show a
live URL — the data is identical.

**Done when:** a ≤4-minute video exists and is uploaded wherever the submission form wants it.

### 2. Fill in the prize tracks **[you]**

[`SUBMISSION.md`](SUBMISSION.md) lists what is integrated but deliberately does not guess at
track titles. Read them off the ETHOnline page and replace the callout under *Integrations*.

**Done when:** that callout is gone and the tracks are named.

---

## High value — real on-chain data, in dependency order

### 3. Deploy the `erc8004-arc` subgraph **[you]** → then **[either]**

**This does not wait on anything else.** Arc testnet's three ERC-8004 registries are live,
they are not ours to deploy, and their addresses and start blocks are already committed in
`subgraph-erc8004-arc/networks.json`.

What is needed from you: a Graph Studio deploy key.

1. Create the subgraph at <https://thegraph.com/studio>, network **Arc Testnet**. Studio issues
   a deploy key and a slug.
2. Authenticate once per machine — the key goes into graph-cli's own config, **never into a
   file in this repository**:

   ```sh
   npx graph auth <DEPLOY_KEY>
   ```

3. Then deploy:

   ```sh
   pnpm --filter @hunch-vpm/subgraph-erc8004-arc deploy:arc-testnet
   ```

**Done when:** Studio shows the subgraph syncing and hands back a development query URL.

### 4. Point `/agents` at it **[either]**

Set `NEXT_PUBLIC_ERC8004_SUBGRAPH_URL` in the Vercel project to the Studio **development query
URL** and redeploy.

> **Use the keyless Studio URL, not a gateway URL.** The Graph gateway carries its API key as a
> **path segment**, so a keyed URL in a `NEXT_PUBLIC_*` variable publishes that key to every
> visitor. `apps/web` refuses to build in that case, by design, and the error names the
> variable without printing the value.

**Done when:** `/agents` shows live registry data instead of saying reputation reads are
unavailable.

### 5. Deploy the contracts to Arc testnet **[you]** → then **[either]**

The big one — everything remaining depends on it.

What is needed from you:

- **A funded Foundry keystore.** There is none on this machine. USDC is Arc's native gas token,
  so the deployer needs testnet USDC. Create it with `cast wallet import <name> --interactive`.
  Never `--private-key` on a command line — it lands in your shell history.
- **`ARC_TESTNET_RPC_URL`** in the environment.
- **No explorer API key.** Arcscan is Blockscout: verification needs only `--verifier blockscout
  --verifier-url https://testnet.arcscan.app/api/`, which the preflight prints for you.

Then:

```sh
ORACLE_KIND=stork \
forge script contracts/script/Deploy.s.sol \
  --root contracts --rpc-url arc_testnet --account <keystore-account> --broadcast --verify \
  | tee deploy.log
```

Two traps, both documented in [`RUNBOOK.md`](RUNBOOK.md) and repeated here because they cost
real time:

- The script path is relative to **where you are standing**, not to `--root`.
- An unrecognised `ORACLE_KIND` falls through to Stork **silently**. Read the adapter address
  the script printed against the one you expected.

`Deploy.s.sol` writes no file — it logs a JSON block to stdout. Cut it out:

```sh
sed -n '/^  {$/,/^  }$/p' deploy.log | sed 's/^  //' > deployments/arc-testnet.json
```

Read that file before committing it. Those six addresses are the only record of the deploy, and
the `sed` is a text cut, not a parser.

**Done when:** `deployments/arc-testnet.json` exists, is committed, and its addresses match
what the script printed.

### 6. Wire the addresses through **[either]**

Six places read them and **none are wired to each other**:

| Where | What |
|---|---|
| `deployments/arc-testnet.json` | the file itself |
| `subgraph/networks.json` | all four addresses and each one's deployment block as `startBlock`. Do **not** hand-edit `subgraph.yaml` |
| `packages/client/src/addresses.ts` | `arcTestnetAddresses` |
| `apps/web/src/lib/chain.ts` | `ARC_TESTNET_ADDRESSES` — deliberately duplicated, not imported |
| `packages/mcp` env | `HUNCH_VPM_SETTLER_ADDRESS`, `HUNCH_VPM_CLASSIC_SETTLER_ADDRESS` |
| `agent` env | `HUNCH_SETTLER` — live mode refuses to start on the zero address |

**Done when:** `pnpm verify` is still green and no zero address remains in committed config.

### 7. Deploy the `hunch-vpm` subgraph **[either]**

Same Studio key as step 3, second subgraph, after step 6:

```sh
cd subgraph
pnpm codegen
npx graph build --network arc-testnet
npx graph deploy hunch-vpm --network arc-testnet
```

**Done when:** Studio reports it synced past the contracts' deployment block.

### 8. Take the surface off fixtures **[either]**

Set `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` (keyless Studio URL — same warning as step 4) and
`NEXT_PUBLIC_HUNCH_MARKET_IDS` in Vercel, then redeploy.

`NEXT_PUBLIC_HUNCH_MARKET_IDS` is the complete set of `/m/<id>` routes, because the market page
sets `dynamicParams = false`. A market not listed there has no page.

**Done when:** the **SAMPLE DATA** banner is gone and the board lists real markets.

### 9. Open a market, and resolve one **[you]**

The demo is far stronger with one real market that actually settled.

Approve the factory, then `open(Terms, Feed)` — the full field-by-field breakdown is in
[`RUNBOOK.md`](RUNBOOK.md#opening-a-market). Read `specId` off the `MarketOpened` log; you need
it for every resolver call.

Set `resolutionTime` early enough that it freezes **before** you submit, so you can show the
whole arc. Check with `preview` (costs nothing) before calling `resolve`.

**Watch the error name.** `NotStale()` is raised by both paths and means the opposite thing in
each: from `resolve` the reading **is** stale; from `voidStale` it is **not**. `preview`
reports `age` directly — use it to decide which you have.

**Done when:** one market has opened, frozen, resolved and paid a claim, and you have the
transaction hashes.

---

## Optional polish

### 10. `vpm.playhunch.xyz` **[you]**

Add the domain under Project → Settings → Domains, then create the record on `playhunch.xyz`:

```
vpm    CNAME    cname.vercel-dns.com.
```

Vercel issues the certificate once it resolves. `metadataBase` in
`apps/web/src/app/layout.tsx` is already `https://vpm.playhunch.xyz`, so OpenGraph URLs are
correct the moment the name answers — and are pointing at a name that does not resolve until
then.

### 11. The agent, live **[you]**

Needs `CIRCLE_API_KEY`, `CIRCLE_WALLET_ID`, `CIRCLE_ENTITY_SECRET_CIPHERTEXT` (already
encrypted — the raw secret never enters the process), `GATEWAY_API_KEY` and
`GATEWAY_ACCOUNT_ID`, plus step 6's `HUNCH_SETTLER`.

The agent's `ConsoleLogger` is constructed with whatever secret values the process holds and
replaces them with `***` before writing anything — so a live run is safe to record.

### 12. Substreams — blocked externally, not on you

It builds, tests and packs today. It cannot stream: **there is no public Firehose endpoint for
Arc yet.** Say so in the submission rather than leaving a judge to discover it;
[`SUBMISSION.md`](SUBMISSION.md) already does.

If an endpoint appears:

```sh
cd substreams
export SUBSTREAMS_API_KEY=<your key>
export SUBSTREAMS_API_TOKEN=$(make token)
make deploy VESTED=0x... CLASSIC=0x... FACTORY=0x... RESOLVER=0x...
```

---

## Before you hit submit

- [ ] Demo video uploaded
- [ ] Prize tracks named in [`SUBMISSION.md`](SUBMISSION.md)
- [ ] `pnpm verify` green on `main`, CI green on `main`
- [ ] <https://hunch-vpm.vercel.app> loads, and its banner matches reality — fixtures if you
      stopped at step 2, live if you finished step 8
- [ ] Every "not done" in [`SUBMISSION.md`](SUBMISSION.md) still true, or struck
- [ ] No secret in the repository. `.gitignore` excludes `.env` and `.env.*` while keeping
      `.env.example`; the two example files carry names and placeholders only
