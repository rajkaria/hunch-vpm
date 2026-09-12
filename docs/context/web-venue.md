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
  - packages/mcp/src/client-loader.ts
updated: 2026-09-13
---

# The market surface, as a venue

Covers `apps/web` — wallet layer and network toggle, staking and the acceptance estimate,
claims, portfolio, design system.

## Current state — what's working, deployed, broken

**Live:** <https://hunch-vpm.vercel.app> (Vercel `hunch-vpm`, auto-deploys from `main`). Merged
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

**Serving fixtures on both networks.** Nothing deployed; transactional controls gated on
`isDeployed()`. The transactional path is **untested against a real chain**.

**Broken / absent:**
- **Data layer is single-network.** The toggle switches the chain and addresses you transact
  with, but the board reads one subgraph (`NEXT_PUBLIC_HUNCH_SUBGRAPH_URL`). For real
  dual-network use, `lib/data` + both API routes need a per-network subgraph URL and a
  `network` parameter. Not built.
- **Live per-address positions return nothing** — client has no `positions(where:{owner})`
  read. Fix is a client read + one call in `live.ts`; `test/portfolio.test.ts` pins it.
- **Mainnet cannot add-to-wallet** until `NEXT_PUBLIC_ARC_RPC_URL` is set (no published RPC).
  Mainnet explorer links suppressed until `NEXT_PUBLIC_ARC_EXPLORER_URL` is set.
- `ARC_MAINNET_ADDRESSES` all placeholders (ours, ERC-8004, Stork).
- Server-rendered displays (footer, ContractsPanel network row, /agents registry links) still
  read testnet facts regardless of the toggle.
- No per-market OG image; no rate limiting on `/api/claimable`, `/api/positions`.

## Recent changes — files touched and why

- `src/lib/chain.ts` — `ARC_MAINNET_ADDRESSES`, `NETWORKS`, `networkForChainId`, mainnet explorer
  from env.
- `src/lib/wallet/network.tsx` (new) — `NetworkProvider`/`useNetwork`, localStorage choice.
- `src/lib/wallet/chains.ts` — `CHAINS` for both, `DEFAULT_NETWORK` (testnet); 18-decimal native.
- `src/lib/wallet/config.ts` — both chains + transports; WalletConnect id defaults to Hunch's.
- `src/lib/wallet/useWallet.ts` — compares wallet chain against the *selected* network.
- `src/components/wallet/NetworkToggle.tsx`, `MainnetNotice.tsx` (new); header + layout wired.
- `src/components/market/EntryFlow.tsx` — addresses/explorer from the selected network.
- Tests: `network-toggle.test.tsx` (new), `wallet-config.test.ts`, `wallet-chains.test.ts`.

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

1. **Per-network data layer:** `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL_{TESTNET,MAINNET}` (and ERC-8004),
   `network` param on `/api/claimable` + `/api/positions`, board/market pages network-aware, and
   make footer/ContractsPanel/agents read the selected network.
2. Client `positions(where:{owner})` read → `live.ts:getPositions`.
3. After testnet deploy: fill `ARC_TESTNET_ADDRESSES`, walk approve → enter → partial → close
   vintage → claim → void on real testnet.
4. After mainnet launch: set mainnet RPC/explorer env and addresses; rate-limit the API routes.
