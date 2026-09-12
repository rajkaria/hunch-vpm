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
updated: 2026-09-12
---

# The market surface, as a venue

Covers `apps/web` — the wallet layer, the staking flow, claims, the portfolio, and the
design system they are all built on.

## Current state — what's working, deployed, broken

**Live:** <https://hunch-vpm.vercel.app>, production, public. Vercel project `hunch-vpm` is
connected to the GitHub repo, so a push to `main` redeploys it.

**Working.** A person can connect a wallet, be prompted onto Arc, see what the books would
accept of an offer before signing, approve USDC, enter, watch the vintage close, and pull
what they are owed. 181 web tests. `pnpm verify` green.

**Serving fixtures.** No contract is deployed, so every transactional control is gated on
`isDeployed()` and says "the settler is not deployed yet" rather than pretending. The whole
transactional path is therefore **untested against a real chain** — the largest untested
surface in the app.

**Broken / absent:**
- **Live per-address positions return nothing.** `createLiveSource.toMarketDetail` sets
  `positions: []` and always has: `@hunch-vpm/client`'s `marketBook(id)` takes no owner and
  there is no positions-by-owner read in the client at all. The portfolio works on fixtures
  and says so. Fix is **not** a schema change — the subgraph already indexes `Position` with
  an owner (that is how `claimable` finds them), so it needs a `positions(where: { owner })`
  read in the client plus one call in `live.ts`. `test/portfolio.test.ts` pins the current
  behaviour so it fails loudly when the read lands.
- Market page "Your position" shows the **sample wallet** on fixtures, and says so.
- No per-market OG *image* (per-market OG title/description do work).
- No rate limiting on `/api/claimable` or `/api/positions`.

## Recent changes — files touched and why

**Wallet layer (new).** `src/lib/wallet/chains.ts` (Arc as viem chains; USDC native gas at
**6** decimals, not 18), `config.ts` (wagmi, injected + WalletConnect), `useWallet.ts`
(`ready` vs `wrongChain` as separate states; `usableConnectors` drops `injected` when no
provider has announced itself), `abi.ts` (local ABI slices).
`src/components/wallet/` — `WalletProvider`, `ConnectWallet`, `NetworkBanner`.

**Staking.** `components/market/StakePanel.tsx` (the acceptance estimate),
`EntryFlow.tsx` (approve → enter → buffered → finalized, plus `friendlyError`),
`PositionGate.tsx` (gates "Your position" on the connected address).

**Claims and portfolio.** `app/api/claimable/route.ts`, `app/api/positions/route.ts`,
`components/claim/ClaimList.tsx`, `components/portfolio/Portfolio.tsx`,
`app/portfolio/page.tsx`; `lib/data/types.ts` gained `getPositions` + `PortfolioEntry`.

**Design system.** `src/app/globals.css` rewritten to the shipped playhunch.xyz tokens;
`components/ui/primitives.tsx` gained `Button` and a real tag, `Panel` gained radius + `.lift`.

**Shared.** `lib/units.ts` gained `parseUsdcAmount` (lifted out of `RuleComparator` so the
two amount fields cannot disagree).

## Key decisions — choices and trade-offs, why X over Y

- **Connect Wallet, never Privy.** User instruction, and right independently: this venue
  never custodies, so an embedded-wallet provider is a custody-shaped dependency.
- **The entry flow has THREE states, because the contract does.** `enter` *buffers* — it
  pushes the position with `accepted = 0`, pulls the full amount, and emits `Entered`
  carrying **`offered`, never `accepted`**. Rationing happens in `_finalizeVintage`, on the
  first call touching the market in a *later block*. A UI reading `offered` as "accepted"
  would be contradicted by a refund minutes later. Hence "Close the vintage" — callable by
  anyone, and a vintage nobody closes is a position nobody can claim.
- **The acceptance estimate precedes the signature.** A refund learned about afterwards reads
  as a bug; disclosed beforehand it reads as the rule working. Accepted and refused get equal
  weight; the refusal is never styled as a warning.
- **`vpm.simulateEntry` is the only implementation of the acceptance rule.** Already correct
  on the hard part — cap taken per opposing book and minimised in one pass, with the offer
  inside the denominator. A second copy would drift.
- **Claims and positions read through server routes**, not the browser: the Graph gateway
  carries its key as a **path segment**, and the repo already refuses to build with a keyed
  URL in a `NEXT_PUBLIC_` variable. bigint crosses as decimal strings; `cache-control: private`.
- **Corners are rounded.** This reverses `globals.css` v1.0's documented argument for square;
  the shipped product uses tag 6 / control 12 / card 16 / pill everywhere. Recorded in the file.
- **No credential has a default** — WalletConnect project id, faucet URL. A placeholder that
  half-works is worse than an honest absence.

## Constraints learned the hard way

1. Market and claim pages are **server components** — never pass a function prop to a client
   component. `StakePanel` renders `EntryFlow` itself; its `action` prop is a test seam only.
2. The app **cannot import `@hunch-vpm/client` at typecheck time** (it builds before that
   package does). Mirror ABIs and chain facts locally, as `lib/chain.ts` already did.
3. Every page must render with **no wallet and nothing deployed**.
4. `node` and `rm` are blocked in this sandbox; `curl` too. Use the browser tools to verify.

## Next steps

1. **Close the live-positions gap** — add `positions(where: { owner })` to
   `@hunch-vpm/client`, call it from `live.ts:getPositions`. Required before mainnet:
   without it a user who stakes cannot see their position anywhere but the claim page.
2. Once contracts are deployed, **walk the whole transactional path on testnet**: approve,
   enter, partial acceptance, close the vintage, claim, and one void.
3. Rate-limit `/api/claimable` and `/api/positions`.
4. Per-market OG images (needs a generated OG route).
