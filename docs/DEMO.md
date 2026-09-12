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
| 1 | An open market, and the contracts behind it | 0:00 | 0:35 |
| 2 | An agent registers, and its tier flips | 0:35 | 1:05 |
| 3 | What the agent reads before it acts | 1:05 | 1:45 |
| 4 | It enters, and the position starts earning | 1:45 | 2:25 |
| 5 | Freeze, feed, resolve, claim | 2:25 | 3:05 |
| 6 | The same market under the other rule | 3:05 | 3:40 |
| 7 | Close | 3:40 | 3:55 |

Five seconds under four minutes, which is the margin for the cut, not for talking.

## Before you record

Two windows: a browser at `http://localhost:3000`, and a terminal wide enough for the
agent's decision table. **The table is 105 columns**, so 105 is the floor. The widest line the
run prints is not the table at all — it is the closing `nanopayments` summary at **187
columns**, because it carries a full transaction hash. At 105 columns that one line wraps onto
two; at 187 nothing wraps. Pick whichever you would rather show.

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

## 1. An open market, and the contracts behind it

**0:00 – 0:35**

**Do.** Open `http://localhost:3000`. The board lists every market with its book, per-outcome
headroom bars and time to freeze. Click **Will ETH be above $3,000 on 30 September 2026?**
That is `/m/eth-3000-sep30`. Scroll to the **Contracts** panel in the right column and click
the settlement asset address.

**On screen.** The market page: accepted principal, the freeze counting down, the capacity
meter per outcome, the book, the vesting curve over the market's life, the resolution spec in
full, and the Contracts panel. That panel has exactly six rows, in this order:

| Row | Reads, on the fixture recording |
|---|---|
| Settler | `0x0000…0000`, badged **not deployed** |
| Market id on the settler | `1` |
| Resolver | `0x0000…0000`, badged **not deployed** |
| Settlement asset | `0x3600…0000`, linked |
| Residue owner | `0x6D2a…5b42`, linked |
| Network | Arc Testnet, chain id 5042002 |

There is no factory row — `MarketFactory` opens markets but is not something a reader of one
market needs. Clicking the settlement asset opens USDC at
`0x3600000000000000000000000000000000000000` on `testnet.arcscan.app`.

**Say.** This is a parimutuel market whose escrow, matching rule and resolver are all
contracts on Arc, and the stake asset is the chain's own gas token. Every number on this page
is derived from the settler's bookkeeping, not from a quoted price.

**Honest note for the fixture recording.** The settler and resolver rows read `0x0000…0000`
and carry a **not deployed** badge instead of a link, because nothing of ours is deployed —
`addressExplorerUrl` returns `null` for the zero address rather than linking into an explorer
that has nothing to show. Three addresses on this page do link, and only one of them is real:
USDC (`0x3600…0000`) and the Stork oracle in the resolution spec (`0xacC0…fd62`) are live Arc
testnet contracts; the residue owner (`0x6D2a…5b42`) is a fixture address, so that link opens
an explorer page with nothing on it. Click the settlement asset, not the residue owner. The
ERC-8004 registries on `/agents` are live too, and are the other safe click.

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
  vitest run test/gate.test.ts -t 'policy' --reporter=verbose --hideSkippedTests
```

Then switch to `/agents` in the browser.

**`--hideSkippedTests` is not optional for a recording.** `-t 'policy'` selects two of the 29
tests in that file and *skips* the other 27 — the verbose reporter prints a `↓` line for every
one of them unless you hide them. Without the flag this beat is 29 test lines instead of 2.

**Run it once before recording.** The first run pays for the transform cache and takes about
fifteen seconds; warm runs land between 1.1 and 1.7 seconds.

**On screen.** Two lines, about a second and a half:

```
 ✓ test/gate.test.ts > a human-backed request > passes with the human-backed policy and advertises it 41ms
 ✓ test/gate.test.ts > an anonymous request > passes with the anonymous policy, which is the whole point 2ms

 Test Files  1 passed (1)
      Tests  2 passed | 27 skipped (29)
```

The `27 skipped` in the summary is `-t` doing its job, not something broken.

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

Hold on the `research` block and the first `decide` table. The whole run finishes in well under
a second — six timed runs here landed between 0.15 s and 1.14 s, the spread being machine load,
not work — so this beat is scrolling, not waiting. All three rounds print in one burst: 165
lines land at once.

**On screen** (trimmed — `research` lists all six markets, but only four of them get a decision
table in round 1: a market that abstains for `inside-freeze-window`, `market-not-open` or
`no-estimate` prints its `decide` header and nothing else, because there was no per-outcome
arithmetic to show):

```
research  <timestamp>  5 paid quote(s), 1250 µUSDC (0.00125 USDC) authorized
  market                    pool      headroom  book odds -> own estimate
  btc-72k               10000.00     119900.00  above 42.0%->88.3%   below 58.0%->11.7%
  ...

decide    btc-72k  ENTER outcome 0 for 184.615385 USDC
  86400s to freeze, 92.3% of the arrival window still ahead
  BTC at or above $72,000 at the freeze
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

**Do.** Same run, keep scrolling to round 1's `enter` lines, then past round 2 to round 3's
`monitor` block — that is where the vesting has actually accrued. Then switch to the browser
and scroll `/m/eth-3000-sep30` to **Your position** and to **Vesting over this market's life**.

**On screen** (transaction hashes abbreviated here; the run prints them in full):

```
enter     btc-72k outcome 0: offered 184.615385, 184.615385 accepted, 0.00 refused
          confirmed 0x9d7b…ad03
          confirmed 0x80bc…821a
```

Round 1's own `monitor` block, immediately below that, reads `vested in 0.00 = 1.0000x` for
both positions: nothing has arrived after them yet. **Round 3's** is the one to hold on:

```
monitor
  p1    btc-72k           outcome 0  accepted 184.615385  vested in 18.121706  = 1.0982x if it wins
  p2    btc-68k-short     outcome 0  accepted 180.00  vested in 47.525859  = 1.2640x if it wins
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
  --rpc-url arc_testnet
cast send  "$FEED_RESOLVER" "resolve(bytes32)" "$SPEC_ID" \
  --rpc-url arc_testnet --account <keeper-keystore-account>
```

The keeper signs from an encrypted Foundry keystore, the same way every signing command in
`docs/RUNBOOK.md` does. **Do not put `--private-key` on a command line** — it lands in your
shell history, and on a recording it lands on video. `cast` prompts for the keystore password,
which is one more reason to do the signing take separately from the narration take.

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
rule those figures are 0.08% and 0.00%. Those five figures are the whitepaper's, carried into
this repo through `.ocean/SPEC.md`; they are measurements of the production venue's history and
nothing in this repository recomputes them. Say "measured on Hunch's tape", not "we measured".

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
settlement rule rather than a policy, so it holds for every wallet including ours. It is built
for Arc, the whole book is readable through The Graph, and nobody — not the deployer, not the
factory, not the resolver's owner — can move a position that is not theirs. The invariant
suite asserts that last part directly, by having an address with no position try every method
on every path.

**Do not say "it is live" or "it is on Arc".** It is not deployed. The contracts build and pass
59 Foundry tests, the subgraphs compile and pass their mapping tests, the surface renders from
a fixture dataset, and every committed contract address is the zero placeholder. There is no
hosted URL either: `vpm.playhunch.xyz` is the name reserved for it in `docs/RUNBOOK.md` and it
does not resolve. "Built for Arc, ready to deploy, nothing deployed yet" is both the true
sentence and the stronger one — a judge who checks will find exactly that.

**On screen for the close.** `/docs`, or the board. Not a terminal.

---

## Deployed instead

| Beat | Runs on fixtures today | Changes with a deployment |
|---|---|---|
| 1 | Yes | The settler and resolver rows become explorer links to verified sources instead of `0x0000…0000` with a **not deployed** badge, and the residue owner stops being a fixture address |
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
  vitest run test/gate.test.ts -t 'policy' --reporter=verbose --hideSkippedTests
node agent/dist/cli/main.js run --rounds 3
```

The agent CLI has three other commands if you would rather split beat 3 from beat 4:
`research` prints the book alone, `decide` prints the book plus the decision table for every
market, and `claim` settles whatever the resolved markets owe. `--json` prints decisions as
JSON, `--rounds N` and `--bankroll USDC` change the shape of the run. `node
agent/dist/cli/main.js --help` lists them.

Deployment, address wiring and every secret the live path needs are in
[RUNBOOK.md](RUNBOOK.md).
