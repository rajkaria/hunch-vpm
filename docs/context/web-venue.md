---
feature: web-venue
globs:
  - apps/web/**
  - apps/web/src/lib/wallet/**
  - apps/web/src/components/wallet/**
  - apps/web/src/components/market/**
  - apps/web/src/components/claim/**
  - apps/web/src/components/portfolio/**
  - apps/web/src/app/api/**
  - packages/client/src/chains.ts
  - packages/client/src/reads/positions.ts
  - packages/mcp/src/client-loader.ts
updated: 2026-09-13
---

# The market surface, as a venue

Covers `apps/web` — wallet layer and network toggle, staking and the acceptance estimate,
claims, portfolio, design system.

## Current state — what's working, deployed, broken

**Live:** <https://vpm.playhunch.xyz> (Vercel `hunch-vpm`, auto-deploys from `main`). Merged
so far: the full venue plus the runtime network toggle (PR #8).

**Working (merged):** connect wallet → onto Arc → acceptance estimate before signing → approve →
enter → close vintage → claim; portfolio; **testnet/mainnet toggle** (sticky, never inferred from
the wallet); **WalletConnect** using main Hunch's public project id; **non-dismissible
"not audited" notice on mainnet only**. Browser-verified on both networks, no console errors.

**Also merged:** native `nativeCurrency.decimals` 6 → **18** in
`lib/wallet/chains.ts` (and client/mcp), testnet RPC default → `https://rpc.testnet.arc.io`,
**mainnet RPC default removed** (was an unverified guess — now `NEXT_PUBLIC_ARC_RPC_URL` or
empty), tests updated. Stake amounts correctly stay on the 6-decimal ERC-20 unit
(`USDC_DECIMALS`).

**Arc testnet is LIVE in production (PR #10 merged 2026-09-13).** Contracts are wired into
`lib/chain.ts` (incl. `priceOracle` and `chainlinkCreOracle`). Vercel has both testnet subgraph URLs
and `NEXT_PUBLIC_HUNCH_MARKET_IDS_TESTNET` (`…-0` BTC/USD, `…-1` ETH/USD). The board, market
pages and `/api/positions` read the Studio subgraph. The resolution panel names "Chainlink Data
Feed, relayed by Chainlink CRE". Mainnet still serves fixtures. **Still untested:** a real wallet
signing approve → enter → claim through the UI. It needs a human wallet; seed positions exist
only for the deployer.

**Client bundling (fixed, PR #10):** `live.ts` imports `@hunch-vpm/client` by a **literal**
specifier (`@ts-ignore`). Web `build`/`dev` scripts build the client first, and vitest aliases it
to source. The old variable specifier kept the client out of Vercel's function trace, so every
live read returned 502 "The index could not be reached". Local `next start` can't catch this,
because node_modules resolve locally. Check a Vercel deployment (`vercel curl … --deployment`,
since previews are auth-protected).

**Per-network data layer (done, this session):** `dataSourceFor(network)` in `lib/data/index.ts`
reads `NEXT_PUBLIC_{HUNCH_SUBGRAPH_URL,ERC8004_SUBGRAPH_URL,HUNCH_MARKET_IDS}_{TESTNET,MAINNET}`
(unsuffixed = testnet; mainnet never falls back). The toggle mirrors its choice into the
`hunch-vpm.network` cookie; layout/board/market/agents render for `selectedNetwork()`
(`lib/network-server.ts`) and `NetworkSync` calls `router.refresh()` when they disagree.
`/api/positions` + `/api/claimable` take `?network=` (400 otherwise) and echo it. Footer,
ContractsPanel and registry links follow the network.

**Live positions (done):** client `positions(wallet)` (`reads/positions.ts`, all positions incl.
claimed, paged by id, sorted newest first) → `live.ts:getPositions` = one positions read + one
`marketBook` per distinct market. `PositionView.vintage` is now `bigint | null` (classic ≠ seed).

**Broken / absent:**
- **Pages are now dynamic** (cookie) — no ISR on board/market/agents. Fine on Fluid compute; revisit if load matters.
- ~~Client components with no network prop still link testnet's explorer~~ — **fixed on
  `claude/cre-login-error-5472df`**: `ResolutionPanel` (new required `chain` prop), `ClaimList` rows
  (`useNetwork`) and the agents table rows now pass the network's `ChainFacts`. Web typecheck and
  228 tests are green.
- **`next dev` quirk:** after a toggle, `router.refresh()` can leave the market page's own segment stale while the layout updates. `next start` refreshes it correctly — browser-verified testnet → mainnet → testnet on the production build (contracts panel, footer, cookie, no console errors). Verify network switching on a build, not dev.
- **Mainnet cannot add-to-wallet** until `NEXT_PUBLIC_ARC_RPC_URL`; explorer links suppressed until `NEXT_PUBLIC_ARC_EXPLORER_URL`.
- **Mainnet pre-launch state (branch `claude/mainnet-prelaunch`):** while `ARC_MAINNET_ADDRESSES.vestedParimutuel` is
  undeployed, the mainnet side shows a lime **"Coming to Arc mainnet"** notice instead of the unaudited warning and the
  sample-data notice. It says the venue goes live when Arc mainnet launches and has a *Go to Arc Testnet* button. The
  hero badge reads "Launching on Arc mainnet" (testnet: "Live on Arc Testnet"). `pnpm wire:mainnet` flips both
  automatically. `formatDuration` is now exact (5400 s → "1h 30m"; production showed "2h").
- `ARC_MAINNET_ADDRESSES` all placeholders. No per-market OG image; no rate limiting on the API routes.

## Recent changes — files touched and why

- `src/lib/network.ts`, `src/lib/network-server.ts`, `src/components/wallet/NetworkSync.tsx` (new).
- `src/lib/data/index.ts` (per network), `kind.ts` (`dataSourceKinds`), `request-network.ts` (new),
  `live.ts` (`network`, `createClient` injection, `getPositions`, addresses per network).
- `src/lib/wallet/network.tsx` (`initialNetwork`, cookie), `WalletProvider.tsx`, `app/layout.tsx`,
  `app/page.tsx`, `app/m/[id]/page.tsx` (static params = union of both networks), `app/agents/page.tsx`.
- `Portfolio.tsx`, `ClaimList.tsx` (network in URL + query key; `isPending` so a disabled query
  does not flash the error state), `PositionGate.tsx`, `SiteFooter.tsx`, `ContractsPanel.tsx`, `AddressLink.tsx`.
- Tests: `network-data.test.ts` (new), `portfolio.test.ts` (live source), `network-toggle.test.tsx`
  (cookie, NetworkSync, footer), `degraded.test.tsx`.

## Key decisions — choices and trade-offs, why X over Y

- **Connect Wallet, never Privy** (main Hunch uses Privy; the WalletConnect id came from inside
  it and is public by design).
- **Network is the viewer's explicit choice**; switching never moves the wallet — a mismatch is
  a visible wrong-chain state. Default testnet.
- **Mainnet notice is not dismissible.**
- **Native 18 / ERC-20 6** — `nativeCurrency` is the native view; every amount the app handles
  is the ERC-20 view.
- **No guessed mainnet values** (RPC, explorer, addresses).
- **Entry flow has three states** because `enter` buffers and emits `offered`, not `accepted`.
- **Acceptance estimate precedes signature; `vpm.simulateEntry` is the only implementation.**
- **Claims/positions via server routes** — gateway key is a URL path segment.

## Constraints learned the hard way

1. Server components can't pass function props to client components.
2. App can't import `@hunch-vpm/client` at typecheck time — mirror ABIs/chain facts locally.
3. Every page must render with no wallet and nothing deployed.
4. `node`, `rm`, `curl`, `timeout` blocked/absent in this sandbox; use `cast`, browser tools, `mv`
   to scratchpad.
5. Don't run verify concurrently with `next dev` or forge simulations — tests time out.

## Next steps

1. After PR #10 merges and a market is opened + its id set in `NEXT_PUBLIC_HUNCH_MARKET_IDS_TESTNET`
   (deploy-ops next steps 1-3): browser-verify the live board, market page and portfolio on the
   production URL, then walk approve → enter → partial → close vintage → claim → void on testnet.
2. ~~Pass the selected network's `ChainFacts` to client-side `AddressLink`s~~ — done (see Broken / absent).
   The real-wallet walk is still owed. On production testnet: connect → approve → enter (check the acceptance
   estimate matches the `offered`/`accepted` split) → claim. There is no resolved market until the CRE
   relay delivers, so the testable claim today is a **refused remainder**: stake past a book's
   headroom, then pull it back.
3. After mainnet launch: mainnet RPC/explorer env, addresses via `pnpm wire:mainnet`; rate-limit the API routes.
