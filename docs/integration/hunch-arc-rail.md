# Routing an existing agent product through the Arc rail

This is for the engineer maintaining an agent-facing prediction product whose markets live in
Postgres, with the operator as resolver, payer and custodian. It explains how to put Arc markets
behind the **same four verbs** that product already exposes — `research`, `quote`, `positions`,
`trade` — without changing the agent-facing API.

The claim this document has to earn: **nothing changes for your existing agent users at the API
surface.** Same verbs, same arguments, same order, same gating. What changes is underneath:

| | Postgres rail | Arc rail |
| --- | --- | --- |
| Who holds the stake | the venue | the settler's escrow, entered from the agent's own wallet |
| Who is the counterparty | the venue | whoever staked the other outcomes |
| Can a stake be partly rejected | no | **yes** — only up to the room the opposing books have |
| What `quote` answers | a price | **how much would be accepted** |
| Who decides the outcome | the operator | a registered price feed spec, callable by anyone |
| How a winner is paid | pushed | **pulled** — the winner sends a transaction |
| Who signs | the venue | **the agent** — this package never signs |

Everything below is the mechanics of that table.

---

## 1. Install

```bash
pnpm add @hunch-vpm/client
```

Peer requirements: Node 20+, ESM, `viem` 2.x (a direct dependency of the package, not a peer).
The package is TypeScript-first and ships its own declarations. It has no runtime dependency on a
chain node: every read goes to a subgraph over HTTP, and every write is calldata handed back to
you.

You also need:

- the **hunch-vpm subgraph** endpoint for the network you are pointing at, and
- optionally the **ERC-8004 subgraph** endpoint for the same network, if you want counterparty
  reputation in `research`.

If you use The Graph's gateway, the API key is a **path segment**, not a header:

```
https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>
```

which makes the URL itself a credential. Keep it server-side, keep it out of logs, and never ship
it to a browser. `gatewayUrl(apiKey, subgraphId)` is exported if you want to build it yourself, and
errors raised by the package deliberately omit the URL from their message.

---

## 2. Config shape

```ts
import { createArcRail } from '@hunch-vpm/client';

const arcRail = createArcRail({
  // Either a full endpoint…
  subgraphUrl: process.env.HUNCH_SUBGRAPH_URL,
  // …or a Studio id plus a key, and the rail builds the gateway URL:
  // subgraphId: process.env.HUNCH_SUBGRAPH_ID, apiKey: process.env.GRAPH_API_KEY,

  // Optional. Without it, `research` cannot report counterparty reputation.
  erc8004SubgraphUrl: process.env.ERC8004_SUBGRAPH_URL,

  // The labels your agents already send, mapped to outcome indices.
  // Without this, only outcome indices are accepted.
  sides: { yes: 0, no: 1 },

  // Whether `research` also reads who is on the other side and what the
  // reputation registry says. Two extra index reads. Default false.
  includeCounterparty: false,
});
```

Every field:

| Field | Type | Meaning |
| --- | --- | --- |
| `subgraphUrl` | `string` | The venue subgraph's query endpoint. Required unless `subgraphId` + `apiKey` are given. |
| `subgraphId` / `apiKey` | `string` | Studio deployment id and gateway key, expanded into the URL above. |
| `erc8004SubgraphUrl` / `erc8004SubgraphId` | `string` | The reputation subgraph for the same chain. |
| `chain` | `viem` `Chain` | Defaults to Arc testnet (`5042002`). Arc mainnet is `5042`. |
| `addresses` | `Partial<HunchAddresses>` | Overrides for the chain's default contract addresses. Merged over the defaults. See the note in §6 — the rail does not need these to build a trade. |
| `sides` | `Record<string, number>` | Side labels → outcome index. Matched case-insensitively. |
| `includeCounterparty` | `boolean` | Whether `research` also reads counterparty reputation. Default `false`. |
| `readOpenVintage` | `boolean` | Whether market reads also pull the stake queued in the current block. Default `true`; turning it off makes every acceptance figure an upper bound, flagged as `demandUnknown`. |
| `pageSize` | `number` | Entities per page when a read walks a collection. Default 500, max 1000. |
| `transport` | `GraphQLTransport` | Swap in a recorded transport for tests, or a fetch with your own retry and caching policy. |
| `now` | `() => bigint` | Unix seconds. Injectable so every verb can be evaluated at a fixed instant. |
| `client` | `HunchClient` | Reuse an existing client instead of building one from the fields above. |

There is no field that takes a private key, a signer, an operator account or a custody wallet, and
there will not be one.

---

## 3. Registering it behind a `settlementRail` switch

`SettlementRail` is the interface both rails implement. Type your existing Postgres implementation
against it and the two become interchangeable at the call site.

```ts
import type { SettlementRail } from '@hunch-vpm/client';
import { createArcRail, custodialRailCapabilities } from '@hunch-vpm/client';

// Your existing book, typed against the shared interface. `capabilities` is the
// only member it does not already have; the helper fills in the descriptor for a
// venue-custodied, operator-resolved rail.
const postgresRail: SettlementRail = {
  capabilities: custodialRailCapabilities('postgres'),
  research: (marketId) => existing.research(marketId),
  quote: (marketId, side, amount) => existing.quote(marketId, side, amount),
  positions: (wallet) => existing.positions(wallet),
  trade: (marketId, side, amount) => existing.trade(marketId, side, amount),
};

const arcRail = createArcRail({ subgraphUrl: process.env.HUNCH_SUBGRAPH_URL, sides: { yes: 0, no: 1 } });

const rails: Record<string, SettlementRail> = { postgres: postgresRail, arc: arcRail };

export function railFor(market: { settlementRail: 'postgres' | 'arc' }): SettlementRail {
  return rails[market.settlementRail] ?? postgresRail;
}
```

Then the four HTTP handlers stop caring which rail they are on:

```ts
app.post('/quote', gate402, async (req, res) => {
  const rail = railFor(await loadMarket(req.body.marketId));
  const quote = await rail.quote(req.body.marketId, req.body.side, parseUsdc(req.body.amount));
  res.json(serialize(quote));            // see §5 on bigint
});
```

`settlementRail` is a per-market column, not a global flag. A market routed to `arc` carries the
subgraph id (`<settler>-<index>`) as its `marketId` on this rail; that string is what every verb
here takes and what `research` echoes back.

### The capability descriptor

Branch on a capability, never on the rail's name:

```ts
const { custody, refusal, payout, signing, resolution } = rail.capabilities;

if (custody === 'self') {
  // Do not debit an internal balance: the stake never passes through your books.
}
if (refusal) {
  // Show the agent what would be refused before it signs.
}
if (payout === 'pull') {
  // Your payout job surfaces claims instead of sending money.
}
```

The Arc rail declares:

```ts
{
  rail: 'arc',
  custody: 'self',
  counterparty: 'other-stakers',
  refusal: true,
  quote: 'acceptance',
  resolution: 'feed',
  payout: 'pull',
  signing: 'agent-wallet',
  cancellable: false,
  chainId: 5042002,
  asset: { symbol: 'USDC', decimals: 6, address: '0x3600000000000000000000000000000000000000' },
}
```

Every behavioural field differs from the custodial descriptor. None of them is a detail you can
carry over untouched.

---

## 4. Verb by verb

### `research(marketId, options?) → ArcResearch`

Maps to the client's book, headroom, odds and (optionally) counterparty reads. Two index reads by
default — the book and the headroom, which are the same query and collapse into one request behind
a caching transport. `includeCounterparty: true` adds two more (the market again, and a walk of its
holders), plus two reputation reads when an ERC-8004 endpoint is configured.

The common fields are the ones your Postgres rail already returns — status, outcomes with their
backing and implied probability, total accepted, winner, close time. On top of them:

| Field | Only this venue has it because… |
| --- | --- |
| `headroom[]` | capacity is finite per book, so each outcome has a different amount of room. `ownBookHeadroom` is informational; **`bindingHeadroom` and `maxFullyAccepted` are what decide a stake**, and they belong to the OPPOSING book. |
| `resolution` | the market is bound at creation to an oracle, a strike, a direction and a staleness bound. `by: 'feed'` means nobody — including the venue — can resolve it any other way. `by: 'unknown'` means it was opened with no spec registered, which is a reason not to stake. |
| `secondsToClose` | the freeze is a timestamp fixed at creation and never movable. |
| `demandUnknown` | when the stake queued in the current block could not be read, every acceptance figure is an upper bound rather than a promise. |
| `index` | every number here is as of a subgraph block, not as of now. |

`counterparty` is `null` unless you asked for it. When present and `unavailable: true`, no
reputation source is configured, so every wallet counts as unrated — which is a different statement
from "scores badly". The number worth showing an agent is `unratedSharePpm`: the fraction of the
money opposing it that belongs to wallets no registry has heard of.

### `quote(marketId, side, amount, options?) → ArcQuote`

**This is the verb that changes meaning.** On the Postgres rail a quote is a price: `amount` at
price `p` buys `amount/p` of exposure, and the fill is total. Here there is no price and no order
book. A quote answers the acceptance question:

```ts
const quote = await arcRail.quote(marketId, 'no', parseUsdc('20'));

quote.requested;      // 20_000000n  — what was asked for
quote.accepted;       // 14_000000n  — what the opposing books can cover right now
quote.refused;        //  6_000000n  — what they cannot
quote.acceptance;     // 'partial'
quote.refusal;        // { kind: 'headroom', refused: 6_000000n, detail: '…', revertsWith: null }
quote.escrowed;       // 20_000000n  — the settler pulls the WHOLE offer
quote.refund;         // { amount: 6_000000n, call: 'withdrawRefund', availableWhen: '…' }
quote.binding;        // the opposing book that cut it, with its headroom and queue
quote.maxFullyAccepted; // the largest offer taken whole right now
quote.payoutIfResolvedNow; // { wins, loses, voided }
```

Four things to carry into your UI and your agent-facing docs:

1. **`accepted + refused === requested`, always.** A quote that surfaces only `accepted` misstates
   what leaves the wallet; a quote that surfaces only `requested` misstates what gets a position.
2. **The whole offer is escrowed, including the part that will be refused.** The refused part is
   not rejected when the transaction is sent — it lands, fails to find room, and becomes
   refundable. Showing the
   agent "20 USDC" as the cost is correct; showing "14 USDC" is not.
3. **The refused part comes back by pull.** `withdrawRefund` returns it, from the block after the
   entry lands — the call finalizes the entry's vintage itself, so nothing has to be poked first.
   Nothing returns it automatically.
4. **`payoutIfResolvedNow.wins` equals `accepted` on a vested market, and that is not a bug.** A
   position is paid its accepted principal plus whatever vests into its book *after* it enters, and
   entries in the same block never vest to each other. The upside is entirely stake that arrives on
   the other side later. `research(...).outcomes[].decimalOddsPpm` is the pool-share figure if you
   want a number that looks like odds, but it is not what this settler pays.

Refusal kinds, and what each means for your error handling:

| `refusal.kind` | `revertsWith` | What actually happens |
| --- | --- | --- |
| `headroom` | `null` | The entry lands. The accepted part takes a position, the rest is refundable. |
| `market-frozen` | `Frozen` | Past the freeze. The transaction reverts; nothing is escrowed. |
| `market-not-open` | `NotOpen` | Resolved or voided. The transaction reverts; nothing is escrowed. |
| `no-counterparty` | `null` | The outcome has no opposing book, so there is nothing for stake to vest into. |

A quote is true **for the block it was computed against** (`quote.quotedAtBlock`). Another entry
landing in the same block rations alongside it and can lower what is accepted. That is stated in
`quote.notes` on every open market; do not cache a quote across blocks and present it as a promise.

### `positions(wallet, options?) → ArcPositions`

Reads through the subgraph. Returns every position the wallet has **not yet claimed**, priced under
whichever rule its market runs, with totals across markets. A claimed position is not a holding and
is not listed.

Per position: `state` (`pending-vintage` | `open` | `won` | `lost` | `voided` | `claimed`),
`staked`, `accepted`, `refused`, `earned`, `payoutIfOutcomeWins`, `claimableNow`, and:

```ts
position.claim; // null, or { call, amount, signed: false, unsigned: { to, data, value }, note }
```

`claim` is the difference from a custodial book. There is no balance to credit and no payout job to
run: the money sits in the settler's escrow until the owner sends one of two calls.

- While the market is open, the only thing available is the refused remainder, through
  `withdrawRefund`. `claim` would revert.
- Once it has settled, one `claim` pays the settlement **and** any outstanding remainder together.
  There is exactly one call per position, never two; sending it twice reverts.

A position whose vintage has not been finalized reports `state: 'pending-vintage'`,
`payoutIfOutcomeWins: null` and nothing claimable — `accepted` is not fixed until the settler
rations the vintage, and a number there would be a guess.

If you also need residue (the flooring remainder on a market whose residue owner is this wallet),
that lives on the underlying client as `rail.client.claimable(wallet)`, which walks positions and
residue together.

### `trade(marketId, side, amount, options?) → ArcTrade`

**`trade` does not trade. It returns calldata for the agent's own wallet.**

```ts
const trade = await arcRail.trade(marketId, 'no', parseUsdc('20'), { wallet: agentAddress });

trade.kind;     // 'unsigned-calldata'
trade.signed;   // false — the literal, not a flag you can set
trade.custody;  // 'self'
trade.from;     // the wallet that must sign
trade.steps;    // [{ id: 'approve', when: 'if-allowance-below-amount', call }, { id: 'enter', when: 'always', call }]
trade.quote;    // the acceptance this calldata was built against
trade.warnings; // partial fill, stale index, and the fact that nothing here is signed
```

Each `call` is `{ to, data, value }` and nothing else. There is no transaction hash, no signature,
no `send()`, and no key in the package; the returned object is frozen, so nothing downstream can
decorate it with one and have it still look like this rail's answer. If the agent never signs,
nothing happens: there is no pending order, no reservation, and no way for the venue to have done
it on the agent's behalf.

Send the steps **in order**, from `from`:

1. `approve` — the settler pulls the stake with `transferFrom`, so an allowance has to exist first.
   The rail cannot read the current allowance from an index, which is why the step is marked
   `when: 'if-allowance-below-amount'` rather than asserted as necessary. Skip it if the wallet's
   allowance already covers the amount, or pass `includeApproval: false`.
2. `enter` — offers the **whole** requested amount. Offering only the accepted part would be a
   different trade.

`RailTrade` is a union, so a call site cannot accidentally treat calldata as a fill:

```ts
import { isUnsignedTrade } from '@hunch-vpm/client';

const result = await rail.trade(marketId, side, amount, { wallet });
if (isUnsignedTrade(result)) {
  return { action: 'sign', chainId: result.chainId, steps: result.steps, warnings: result.warnings };
}
return { action: 'filled', reference: result.reference, accepted: result.accepted };
```

Options:

| Option | Effect |
| --- | --- |
| `wallet` | The agent's address, echoed as `from`. The calldata itself is wallet-agnostic — the settler credits `msg.sender` — so whoever sends it owns the position. |
| `requireFullAcceptance` | Throw `TradeRefusedError` rather than return calldata for a partial fill. |
| `acceptTotalRefusal` | Build the calldata even when the books would accept nothing. Off by default: it costs two transactions and achieves nothing. |
| `includeApproval` | Leave out the allowance step. Default `true`. |
| `now` | Evaluate at a fixed instant. |

`trade` throws `TradeRefusedError` — which carries `.quote` — when the entry could not land at all:
a market past its freeze or already settled (the settler would revert), or books with no room. Tell
the agent what the venue would have done; do not report it as a failure of your service.

**`trade` is safe to retry.** It is a read plus a calldata build, with nothing written anywhere, so
a client that retries on timeout cannot double-place. The idempotency key your Postgres rail needs
for `trade` has no counterpart here; the transaction the agent signs is its own idempotency
boundary.

---

## 5. Amounts, ids and the HTTP boundary

**Every token amount in this package is a `bigint` in the asset's smallest unit.** USDC on Arc has
6 decimals, so 20 USDC is `20_000000n`. Nothing is ever a JS `number`: a float round-trip silently
moves someone's money, and balances exceed `2^53` smallest-units past about 9 billion USDC.

At your HTTP boundary, convert explicitly:

```ts
import { parseUsdc, formatUsdc } from '@hunch-vpm/client';

const amount = parseUsdc(req.body.amount);   // "20.5" → 20_500000n; rejects extra decimals
const wire = formatUsdc(quote.accepted);     // 14_000000n → "14"
```

`JSON.stringify` throws on a `bigint`, so serialize with a replacer that turns them into decimal
**strings** — never into numbers:

```ts
const serialize = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)));
```

Two id shapes, and mixing them up is the most common integration mistake:

- **Subgraph id** — `<settler>-<index>`, e.g. `0x1111…1111-7`. This is what every *read* verb takes.
- **On-chain index** — the settler's own `uint256`, e.g. `7n`. This is what a *transaction* takes.

`research` and `quote` both report the second as `onChainMarketId`, so you never have to parse the
first. The rail builds calldata from it for you.

`side` accepts an outcome index (`0`), the string an HTTP body carries (`"0"`), or a label you
configured (`"yes"`, case-insensitive). An unmapped label raises `UnknownSideError`, whose message
names the labels that are configured — the fix is one line of rail config, not anything in the
agent.

---

## 6. Operational differences that are not in the types

**No custody.** Your ledger never holds the agent's stake, so there is nothing to debit, reconcile
or hold in reserve for an Arc market. If your product credits an internal balance on `trade`, that
code path must be skipped when `capabilities.custody === 'self'` — there is no money to credit and
the position will not exist until the agent signs.

**No cancel.** `capabilities.cancellable` is `false`. An entry is demand against the opposing books
from the moment it lands; there is no endpoint that removes it.

**Pull-based claims.** Your payout job stops sending money and starts surfacing calls. The natural
shape is a periodic `positions(wallet)` per active agent, showing `totals.claimableNow` and the
per-position `claim.unsigned` calldata. Nothing expires — an unclaimed settlement sits in escrow
indefinitely — but residue on a resolved market cannot be swept until every winner has claimed, so
prompting winners is worth doing.

**Resolution by feed.** There is no operator resolve endpoint to call and no dispute queue to
staff. A market resolves when anyone calls the resolution in after the freeze, against the spec
registered at creation. If the only available reading is older than the spec's `maxStaleness`, the
market **voids** instead of resolving, and a void refunds accepted principal exactly — no vesting
is paid. `research(...).resolution` carries the whole spec, including `voidableFrom`, the point
from which anyone may void a market that has not resolved.

**Addresses.** The rail builds every transaction against the settler and asset the *index* reports
for that market, not against anything in `addresses`. You do not need to configure deployment
addresses for `trade` to work, and a market on a settler you have never heard of still produces
correct calldata.

**Index lag.** Every read carries `index.block` and `index.hasIndexingErrors`. The rail is
deliberately conservative when the index is behind: it reasons about competing demand as of the
index head, so it understates the room rather than overstating it.

---

## 7. Errors

| Error | Raised when | What to do |
| --- | --- | --- |
| `NotFoundError` | The market or position id is not in the index, or the index has not reached the block that created it. | 404 the agent, or retry if you have just created it. |
| `UnknownSideError` | A side label the rail has no mapping for. Carries `.known`. | Fix `sides` in the rail config. |
| `TradeRefusedError` | `trade` would produce calldata that cannot do what was asked. Carries `.quote`. | Return the refusal and the quote to the agent. Not a 500. |
| `RangeError` | A non-positive stake, an amount past `uint128`, or an outcome the market does not have. | 400 the agent. |
| `GraphQLHttpError` / `GraphQLRequestError` | The subgraph endpoint failed. `.url` carries the endpoint (which may contain your API key — do not log it). | Retry, then 502. |

All of the rail's own errors extend `RailError`, so one `catch` can separate "the venue said no"
from "the venue is broken".

---

## 8. Testing your integration without a network

The client takes a `GraphQLTransport`, and every read goes through it. Recorded responses are keyed
by operation name, so your own tests can run the whole rail with no socket:

```ts
import { createArcRail } from '@hunch-vpm/client';

const rail = createArcRail({
  subgraphUrl: 'https://subgraph.invalid/hunch-vpm',
  sides: { yes: 0, no: 1 },
  now: () => 1_999_999_000n,
  transport: {
    async request({ operation }) {
      if (operation === 'market') return recordedMarket;
      throw new Error(`no fixture for ${operation}`);
    },
  },
});
```

The operations a rail verb issues: `research` and `quote` issue `market` twice; `positions` issues
`walletPositions`, paged with `first`/`skip`; `trade` issues whatever `quote` issues and nothing
more. With `includeCounterparty`, `research` also issues a third `market`, then `marketPositions`,
then — when a reputation endpoint is configured — `agents` and `agentsByOwner`.

Pinning `now` makes freeze-dependent behaviour deterministic, and every verb takes a `now` override
per call as well.

---

## 9. What changes for your existing agent users

At the API surface: nothing. Same four verbs, same arguments, same x402 gating, same side labels.

Underneath, four things an agent can observe, and all four are in the response rather than in a
changelog it has to read:

1. A quote can come back partially accepted. `accepted`, `refused` and `refusal.detail` say so in
   the response the agent already parses.
2. `trade` returns something to sign instead of a fill. The `kind` discriminant forces the agent's
   handler to notice, rather than silently reading a field that is not there.
3. Winnings have to be collected. `positions(wallet)` returns the call that collects them.
4. Nobody at the venue can settle the market for it, or against it.
