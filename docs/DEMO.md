# Demo

A four-minute walkthrough in seven beats. Each beat below gives the exact command or click,
what appears on screen, and the one sentence that says why it is there.

The whole thing runs with nothing deployed. The web surface serves a replayed fixture
dataset when `NEXT_PUBLIC_HUNCH_SUBGRAPH_URL` is unset, and the agent's dry-run mode is its
default — no key, no network, no contracts. Where a beat looks different against a real
deployment, the beat says so, and [Deployed instead](#deployed-instead) collects those
differences in one place.

## Timing

| # | Beat | Runs | Ends |
|---|---|---|---|
| 1 | A live market, and the contract behind it | 0:00 | 0:35 |
| 2 | An agent registers, and its tier flips | 0:35 | 1:05 |
| 3 | What the agent reads before it acts | 1:05 | 1:45 |
| 4 | It enters, and the position starts earning | 1:45 | 2:25 |
| 5 | Freeze, feed, resolve, claim | 2:25 | 3:05 |
| 6 | The same market under the other rule | 3:05 | 3:40 |
| 7 | Close | 3:40 | 3:55 |

Five seconds under four minutes, which is the margin for the cut, not for talking.

## Before you record

Two windows: a browser at `http://localhost:3000`, and a terminal wide enough for the
agent's decision table (it is 96 columns).

```sh
pnpm install
pnpm --filter @hunch-vpm/agent build        # the CLI runs from dist/
pnpm --filter @hunch-vpm/web dev            # http://localhost:3000, ready in about a second
```

Load `/`, `/m/eth-3000-sep30` and `/agents` once before recording so the first beat is not
a compile. Nothing else needs warming.

One production note about the fixture dataset: the market **questions** carry fixed dates
("30 September 2026") while every **timer** is computed relative to the moment the page
renders. Frame the question or the countdown, not both in one shot, unless you are recording
close to those dates.

---

## 1. A live market, and the contract behind it

**0:00 – 0:35**

**Do.** Open `http://localhost:3000`. The board lists every market with its book, per-outcome
headroom bars and time to freeze. Click **Will ETH be above $3,000 on 30 September 2026?**
That is `/m/eth-3000-sep30`. Scroll to the **Contracts** panel in the right column and click
the settlement asset address.

**On screen.** The market page: accepted principal, the freeze counting down, the capacity
meter per outcome, the book, the vesting curve over the market's life, the resolution spec in
full, and the Contracts panel — settler, market id on the settler, resolver, settlement asset,
residue owner, network. USDC at `0x3600000000000000000000000000000000000000` opens on
`testnet.arcscan.app`.

**Say.** This is a parimutuel market whose escrow, matching rule and resolver are all
contracts on Arc, and the stake asset is the chain's own gas token. Every number on this page
is derived from the settler's bookkeeping, not from a quoted price.

**Honest note for the fixture recording.** The settler, factory and resolver rows read
`0x0000…0000` and are labelled as placeholders rather than linked, because nothing of ours is
deployed — `addressExplorerUrl` returns `null` for the zero address instead of linking into an
explorer that has nothing to show. USDC and the ERC-8004 registries on `/agents` are live
addresses and do link, which is the explorer click to use until a deployment exists.

---

## 2. An agent registers, and its tier flips

**0:35 – 1:05**

**Do.** Two halves, one on each side of the wire.

World's side, which is a single command from World's own CLI and is not ours:

```sh
npx @worldcoin/agentkit-cli register <wallet>
```

Ours, the resource server that reads what that wrote:

```sh
pnpm --filter @hunch-vpm/agentkit-tier exec \
  vitest run test/gate.test.ts -t 'policy' --reporter=verbose
```

Then switch to `/agents` in the browser.

**On screen.** Two lines, about a second and a half:

```
✓ test/gate.test.ts > a human-backed request > passes with the human-backed policy and advertises it
✓ test/gate.test.ts > an anonymous request > passes with the anonymous policy, which is the whole point
```

On `/agents`: the **Human-backed** tile, and the badge on the rows that carry one.

**Say.** An agent signs a CAIP-122 message, the venue recovers the signature and resolves the
wallet through AgentBook on World Chain, and what that buys is a tier, not permission: ten
times the request rate, no per-market cap, and standing in venue-funded distributions. An
anonymous agent reads every market, stakes into every market and is paid by exactly the same
settlement rule. It is slower and smaller. It is not excluded.

**Honest note.** The tier flip is exercised against a stubbed AgentBook with real secp256k1
signing and real EIP-191 recovery — the signature path is genuine, the registry read is not.
`CANONICAL_AGENT_BOOK` is deliberately the zero address and `createViemAgentBook` throws if
you pass it, so there is no live lookup to demonstrate until a registry address is configured.
`packages/agentkit-tier/README.md` and `docs/feedback/agentkit.md` both say where that gap is.

---

## 3. What the agent reads before it acts

**1:05 – 1:45**

**Do.**

```sh
node agent/dist/cli/main.js run --rounds 3
```

Hold on the `research` block and the first `decide` table. The whole run takes about a
quarter of a second, so this beat is scrolling, not waiting.

**On screen** (trimmed — the run prints all six markets and a table for each):

```
research  <timestamp>  5 paid quote(s), 1250 µUSDC (0.00125 USDC) authorized
  market                    pool      headroom  book odds -> own estimate
  btc-72k               10000.00     119900.00  above 42.0%->88.3%   below 58.0%->11.7%
  ...

decide    btc-72k  ENTER outcome 0 for 184.615385 USDC
  86400s to freeze, 92.3% of the arrival window still ahead
  outcome        book      own     edge   trust  eff.edge      headroom       stake  verdict
  above         42.0%    88.3%    46.3%    0.71     32.9%     169100.00  184.615385  chosen
  below         58.0%    11.7%   -46.3%    0.68    -31.5%     119900.00        0.00  edge-below-threshold
```

**Say.** Four things in that table and every one of them comes from the index rather than an
RPC sweep. **Headroom** is `capacity − vested` per book, computed in the subgraph mapping.
**Book odds** are implied by accepted principal, not by a quoted price. **Own** is the agent's
own estimate — it buys a spot and a volatility per distinct feed and prices the digital itself,
because taking the book's price as evidence about the book would make the edge test vacuous.
**Trust** is the principal-weighted ERC-8004 reputation of the books it is trading against,
and it discounts the edge rather than gating the trade.

The quotes are paid. One authorization per intel call at 250 µUSDC — that is 250 USDC base
units, a quarter of a thousandth of a dollar — and they settle in a single on-chain payment at
the end of the loop. Arc gas for one transaction dwarfs a quarter of a mil, so batching is
what makes an agent that re-reads the feed every round affordable at all.

Two abstentions are worth naming as they scroll past: `sol-180-full` refuses because both
books are at zero headroom, and `xau-2400-anon` refuses because a 5.5-point raw edge against
anonymous counterparties survives as 1.4 points after the trust discount.

---

## 4. It enters, and the position starts earning

**1:45 – 2:25**

**Do.** Same run, keep scrolling to the `enter` lines and then the `monitor` block. Then
switch to the browser and scroll `/m/eth-3000-sep30` to **Your position** and to **Vesting
over this market's life**.

**On screen** (transaction hashes abbreviated here; the run prints them in full):

```
enter     btc-72k outcome 0: offered 184.615385, 184.615385 accepted, 0.00 refused
          confirmed 0x9d7b…ad03
          confirmed 0x80bc…821a

monitor
  p1    btc-72k        outcome 0  accepted 184.615385  vested in 18.121706  = 1.0982x if it wins
  p2    btc-68k-short  outcome 0  accepted 180.00      vested in 47.525859  = 1.2640x if it wins
```

**Say.** Two transactions, because `enter` pulls the stake with `transferFrom` and needs the
allowance first. The entry reports offered, accepted and refused separately: a book takes
stake only up to its headroom and hands the remainder back as refundable, so "accepted" is an
answer the chain gives, not a number the client chose.

Then the line that does not exist in a classic pool. `vested in 47.53` on a principal of
180 is money that arrived *after* this position and vested into its book. The position is
worth 1.2640x before the market has resolved, and nothing that arrives later can take that
back — its multiple is monotone, because vesting only ever accrues forward.

**On the page.** The position panel shows accepted, refused and what the position would pay if
the market resolved right now; the vesting curve shows the accumulator over the market's life
with the entry marked on it. Both are read from the same derived fields the subgraph publishes
(`Position.accepted`, `Position.previewPayout`), not recomputed in the browser.

---

## 5. Freeze, feed, resolve, claim

**2:25 – 3:05**

**Do.** Keep scrolling the same run into round 3.

**On screen.**

```
  eth-3200-late          2550.00      26108.00  market is resolved
  btc-68k-short      4379.999996  59967.169758  market is resolved

nanopayments  13 authorization(s) for 13 paid quote(s), 3250 µUSDC (0.00325 USDC) total, settled in 1 on-chain payment (0x5925…23ee)
              per-call settlement would have been one transaction each; batching is what makes the loop affordable

claim
  p2    payout 227.525859  refund 0.00  confirmed

balance   1000.00 -> 862.910474 USDC
```

**Say.** Nobody resolved this. The market's `resolver` is `FeedResolver`, which reads a price
through a one-method `IPriceOracle` adapter and settles on it. Anyone may call it once the
market has frozen; the caller has no influence on the answer and earns nothing for the call.
The strike, the direction, the feed and the staleness bound are hashed into the spec id when
the market opens, so none of them can be edited after stake is down.

Payment is pull-based. 227.525859 out on 180 of accepted principal, and the closing balance
satisfies `closing = opening − staked + returned` exactly — `test/loop.test.ts` asserts that
identity end to end.

**Deployed instead.** This is the beat that gains the most from a real deployment, because
"an unrelated address calls it" is a claim you can show rather than assert. Pull the spec id
out of the `MarketOpened` log, then, from a key that is neither the deployer nor a participant:

```sh
cast call  "$FEED_RESOLVER" "preview(bytes32)(bool,uint8,int256,uint256)" "$SPEC_ID" \
  --rpc-url "$ARC_TESTNET_RPC_URL"
cast send  "$FEED_RESOLVER" "resolve(bytes32)" "$SPEC_ID" \
  --rpc-url "$ARC_TESTNET_RPC_URL" --private-key "$KEEPER_PRIVATE_KEY"
```

`preview` answers what `resolve` would do this second without sending anything: ready, winner,
the reading behind it, and how old that reading is. Show the keeper's balance before and after
and it is visibly down by gas and up by nothing.

---

## 6. The same market under the other rule

**3:05 – 3:40**

**Do.** Back to `/m/eth-3000-sep30`, the **Vested against classic** panel. It opens on
**Your position** because this wallet has one. Read the two columns, then switch the segmented
control to **A stake placed now**, leave the stake at 2500 and change the outcome.

**On screen.** Two columns for the same position — what the vested rule pays it, and what the
classic rule would have paid it — and, under a new stake, the acceptance breakdown (offered,
accepted, refused, which book was binding) plus the line that states the cost to everyone
already there: under the classic rule this stake moves the incumbents from one multiple to a
lower one, because the money it earns comes out of theirs.

**Say.** This is the comparison the repo exists to make, and it is why `ClassicParimutuel` is
in here at all: the rule the live product runs today, ported behind the same
`IParimutuelSettler` interface so the same market can be shown settled both ways. Under the
classic rule the payout multiple per unit is flat across arrival order — a unit staked seconds
before the freeze earns exactly what a unit that carried the risk all day earns. Under the
vested rule it is strictly decreasing, and it cannot.

The early position took the unpopular side nine days out and is paid for it. A buzzer-beater
entering now takes almost nothing with it, because almost nothing lands after it to vest in.
On Hunch's own tape — 5,291 resolved markets, 779,549 trades — last-decile winners captured a
median 70.1% of the losing pool and early winners were diluted by a median 38.7%; under this
rule those figures are 0.08% and 0.00%.

**Honest note.** The comparator's arithmetic runs on integers in the browser and is tested
against hand-computed values in `apps/web/test/vpm.test.ts`. It is the same rule the contract
implements, but on this page it is a model of the classic settler, not a read from a deployed
one. A deployment that runs both settlers makes it a read: query both markets by their shared
`specId` and compare `previewPayout` per position.

---

## 7. Close

**3:40 – 3:55**

**Say.** A parimutuel works from the first dollar, which is why it can quote a question no
market maker will show up for — and it has always paid late money the same multiple as early
money, which is why it has always been worth arriving late. Vesting stake on arrival and
rationing it against the room the opposing books have to cover it removes that, and it is a
settlement rule rather than a policy, so it holds for every wallet including ours. It is on
Arc, the whole book is readable through The Graph, and nobody — not the deployer, not the
factory, not the resolver's owner — can move a position that is not theirs. The invariant
suite asserts that last part directly, by having an address with no position try every method
on every path.

**On screen for the close.** `/docs`, or the board. Not a terminal.

---

## Deployed instead

| Beat | Runs on fixtures today | Changes with a deployment |
|---|---|---|
| 1 | Yes | Settler, factory and resolver rows become explorer links to verified sources instead of labelled placeholders |
| 2 | Yes, against a stubbed AgentBook | A real AgentBook address turns the registry read from a stub into a lookup; byte-level interop with AgentKit's own client is still unproven |
| 3 | Yes | `HUNCH_MODE=live` reads the real subgraph and buys real quotes; the table is identical |
| 4 | Yes | `enter` becomes two real transactions; the position appears in the subgraph and on the page from the index rather than the fixture replay |
| 5 | Yes | `FeedResolver.resolve()` can actually be sent from an unrelated key, which is the whole point of the beat |
| 6 | Yes | Both settlers deployed makes the comparison a query over a shared `specId` rather than a model |
| 7 | Yes | — |

Beats 1, 6 and 7 are visually identical either way. Beats 3 and 4 are identical in shape.
Beat 5 is the one worth re-recording once the contracts are up, and beat 2 is the one whose
caveat has to be spoken either way.

## Commands used, in order

```sh
pnpm install
pnpm --filter @hunch-vpm/agent build
pnpm --filter @hunch-vpm/web dev
npx @worldcoin/agentkit-cli register <wallet>          # World's CLI, not ours
pnpm --filter @hunch-vpm/agentkit-tier exec \
  vitest run test/gate.test.ts -t 'policy' --reporter=verbose
node agent/dist/cli/main.js run --rounds 3
```

The agent CLI has three other commands if you would rather split beat 3 from beat 4:
`research` prints the book alone, `decide` prints the book plus the decision table for every
market, and `claim` settles whatever the resolved markets owe. `--json` prints decisions as
JSON, `--rounds N` and `--bankroll USDC` change the shape of the run. `node
agent/dist/cli/main.js --help` lists them.

Deployment, address wiring and every secret the live path needs are in
[RUNBOOK.md](RUNBOOK.md).
