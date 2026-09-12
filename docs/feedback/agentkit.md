# AgentKit integration notes

Written while building `packages/agentkit-tier`, a resource-server middleware that verifies an
AgentKit proof and tiers access on whether a real unique human stands behind the agent. It is
framework-agnostic by design: a core `verify(request)` that takes headers and returns a typed
result, with thin adapters for Hono, plain Node, and the fetch API.

This is a working diary, not a review. It records what was straightforward, what took a long
time, and where an independent implementation had to guess. Everything here is something hit
while writing that package, with one exception that is flagged in full at the top of section 3.

**Scope note, stated up front:** the Sandbox App could not be exercised. Sandbox feature access is
gated behind a request to a World contact; that access was requested and had not been granted when
this was written. Section 3 therefore describes the sandbox from documentation rather than from
use, and says so line by line. Nothing in it should be read as tested.

---

## 1. Docs and the integration flow

### What went well

The registration side is genuinely short. `npx @worldcoin/agentkit-cli register <wallet>`,
approve in World App, done; registration goes to World Chain through a hosted relay and is
gasless by default. There is nothing to work out and nothing to fund. For a product whose whole
premise is "a human stands behind this wallet", making the human's one step a single command is
the right shape.

Base being supported alongside World Chain mattered more than it might look. This venue's
existing x402 rail is already on Base, so proof-of-human did not drag a new chain into the
system. That is the difference between "we can adopt this" and "we would have to re-plumb first".

The SDK surface is coherent if you are using it end to end: `createAgentkitClient()` /
`agentkit.fetch()` on the agent, `createAgentBookVerifier()` and `createAgentkitHooks()` on the
server, `agentkitResourceServerExtension` to mount it, `InMemoryAgentKitStorage` to get moving and
an `AgentKitStorage` interface to implement for production. That is the right set of pieces.

### Where it got slow: the wire format is spread across three documents

We were not able to use the hooks (see 1.3 for why), so we needed the wire format. Assembling one
valid request took three sources:

- `docs.world.org/agents/agent-kit/integrate` gives the signer configuration — `type: 'eip191'`,
  `signMessage: message => agentWallet.signMessage(message)` — but does not name the request
  header and does not show the message.
- The repo README says the server "challenges the agent to sign a CAIP-122 message" and points at
  `x402/DOCS.md`.
- `x402/DOCS.md` is where it actually is: the `agentkit` header carrying the base64-encoded signed
  challenge response, and the SIWE field list (`domain`, `address`, `statement`, `uri`, `version`,
  `chainId`, `issuedAt`, `expirationTime`, `nonce`).

None of those three is wrong. The problem is that the page an implementer lands on first is the
one that omits the header name, and the page with the header name is in the source tree.

**Ask:** one "wire format" page on the docs site — header name, envelope JSON shape, the exact
message template with every field, and a worked example. It would have saved most of the time
spent on this package's first day.

### 1.2 The chain model is the thing most likely to be got wrong

The single most valuable sentence found anywhere was in `x402/DOCS.md`:

> AgentBook lookup always resolves on World Chain (caller side is chain-agnostic)

Our first implementation had this wrong. It bound the registry read to the chain named in the
proof, which reads as the obvious design and would have refused every Base-side agent in
production. The fix is visible in the package: `acceptedChainIds` (caller side, `[480, 8453]`) and
`AGENT_BOOK_CHAIN_ID` (registry side, always 480) are deliberately separate, with a comment
saying why.

That sentence is not on the integration page — which is the page that introduces Base support, and
therefore the page where somebody forms the wrong mental model.

**Ask:** put it next to the sentence that says Base is supported.

### 1.3 `Chain ID:` has two legal spellings and the docs pick neither

EIP-4361 specifies the chain line as a bare integer (`Chain ID: 480`). CAIP-122, and World's own
field list, specify CAIP-2 (`chainId` "in CAIP-2 format, e.g. `eip155:8453`"). Both appear in
implementations in the wild.

An independent verifier cannot tell which one AgentKit's client emits, and a verifier that guesses
wrong rejects every valid proof with an error indistinguishable from a forgery. We made
`parseChainId` accept both forms and tested both. That is a workaround for a documentation gap, not
a design choice we wanted to make.

**Ask:** state, in the message template, which spelling goes on the wire.

### 1.4 There is no published test vector

No `(message, signature, expected result)` triple exists anywhere we could find. That is the one
artifact that would let an independent implementation prove interoperability with no credentials,
no registered wallet and no sandbox.

Its absence is the reason this package's README contains this sentence:

> This verifier has been tested against proofs produced by its own `buildProof()` [...] What is
> proven here is the verification logic and its failure behaviour; what is not proven is
> byte-level interoperability with AgentKit's client.

224 tests pass — `pnpm --filter @hunch-vpm/agentkit-tier test`, 9 files — and none of them can
close that gap.

**Ask:** publish three static fixtures — a valid proof, an expired one, and one signed by the
wrong key — with the expected verdict for each. Three files. It would let every independent
verifier self-check on day one.

### 1.5 Verification and metering arrive as one call

`createAgentkitHooks({ agentBook, storage, mode })` answers "is there a human behind this wallet"
and "has that human used their free allowance" together, and `free-trial` mode is the default
shape of that answer.

What this venue needed was the first half without the second. Human-backing here is not a payment
gate; it is a tier. An anonymous agent keeps working — it reads every market, stakes into every
market and settles by identical rules — and what a human buys is 10x the rate limit, no tier
ceiling on a single market, a leaderboard badge, and standing in reward distributions. That is a
policy the venue owns, and it is not expressible as "bypass payment N times".

Taking only the identity meant not using the hooks and writing the verification path ourselves.
That is most of what `packages/agentkit-tier` is.

**Ask:** expose the resolved identity on its own — something shaped like
`verifyAgentProof(headers) -> { humanId, wallet, chainId } | { reason }` — independent of the
payment hooks. Metering is one thing a server might do with a human identifier. It is not the only
thing.

### 1.6 The server extension assumes a framework

`agentkitResourceServerExtension` targets Hono, with Express and Next also supported. That covers
most servers, and it did not cover the way we wanted to structure this one.

A framework-free core would have removed the reason this package exists. The pattern is cheap:
one function that takes a header map and returns a typed result, and adapters on top. This package
does exactly that, and the Hono adapter imports nothing from Hono — the context is described
structurally by the two members the middleware touches, and the test suite mounts it on a real
Hono app so the structural types cannot silently drift.

---

## 2. Finding things: portal, search, product discovery, debugging guidance

**Honest framing first:** a server-side verifier needs no portal credential, so nothing in this
work forced a Developer Portal sign-in and we did not do one. What follows is about finding
technical material, which is real, and not about the portal's account-management UI, which we did
not touch. We would rather say that than invent an opinion.

What we actually used: `docs.world.org`, the `worldcoin/agentkit` GitHub repository, and DeepWiki's
generated index of it.

### 2.1 Guessable URLs

`https://docs.world.org/agentkit` returns 404. The working path is
`https://docs.world.org/agents/agent-kit/integrate`.

The first URL an implementer types is the product name. A redirect from `/agentkit` to the
section root costs nothing.

`https://docs.world.org/agents/agent-kit/sandbox` also returns 404, which is part of why section 3
reads the way it does — we could not find a sandbox page under the obvious path.

### 2.2 The best reference is not on the docs site

`x402/DOCS.md` in the repository is the most complete technical document about AgentKit that we
found: header, message fields, storage interface signatures, mode configuration, expiry defaults.
It is one level down in a source tree, reached from a README link.

Site navigation leads to the integration guide, which is a guide. The reference is somewhere else.
For an implementer who is not following the guide path — which is anyone writing their own
verifier — that ordering is backwards.

**Ask:** render `x402/DOCS.md` on the docs site, or link it from the integrate page under a
heading that says "reference".

### 2.3 Search found the guide; a generated index found the reference

The `AgentKitStorage` method signatures were located through DeepWiki's index of the repository
rather than through the docs site. When a third-party generated index is the fastest route to an
interface signature in your own SDK, the signature is not indexed where developers look.

### 2.4 Debugging guidance is the biggest gap

We found nothing on what a rejected proof looks like from the server's side, and nothing on how to
tell one rejection from another. For a verification product this is the most common support
question there will ever be: *it says no, why does it say no.*

"Signature does not recover to the address in the message" and "wallet is not registered" and
"proof was minted for a different domain" and "this nonce was already spent" are four completely
different bugs in four different places, and a boolean cannot tell them apart.

We ended up enumerating eighteen distinct failure reasons and giving each one a test. That table is
the most useful part of this package, and it exists because there was nothing to copy:

```
no_proof_presented        headers_malformed          proof_malformed
proof_unsupported_version proof_chain_unsupported    proof_domain_mismatch
proof_uri_mismatch        proof_expired              proof_not_yet_valid
proof_stale               proof_lifetime_too_long    signature_malformed
signature_mismatch        agentbook_unregistered     agentbook_revoked
agentbook_unavailable     nonce_replayed             nonce_store_unavailable
```

**Ask:** a failure-reason enum in the SDK, and a docs page that maps each reason to the likely
cause. `agentbook_unavailable` versus `agentbook_unregistered` is the one that matters most: "this
wallet has no human" and "we could not find out whether this wallet has a human" are opposite
situations and only one of them is worth retrying.

---

## 3. Sandbox App — what we could and could not do

**Read this paragraph before the rest of the section.** Sandbox feature access is gated behind a
request to a World contact. We requested that access and it had not been granted when this was
written. **The sandbox App states, proof flows, test users and error cases were never exercised
first-hand.** Everything below is read out of documentation. It is included because the gap itself
is feedback, not because we have experience to report. A feedback document that invents experience
it did not have is worth nothing to whoever reads it.

### 3.1 What the documentation says about the states

From `x402/DOCS.md`, not from use:

- Access modes are configured on `createAgentkitHooks` via `mode`, defaulting to `{ type: "free" }`,
  with `{ type: "free-trial", uses: N }` and a discount mode alongside it.
- `free-trial` usage is counted **per human per endpoint**, and multiple agents belonging to the
  same human share one counter. That is the correct choice, and it is the kind of detail that only
  shows up in a reference — it is invisible from the API shape.
- Storage is required for `free-trial` and `discount` and not for `free`.
- Challenge TTL is configurable through `expirationSeconds` on `declareAgentkitExtension`.
- `issuedAt` "must be recent (default: 5 minutes)" and `expirationTime` must be in the future.

We copied the last one deliberately: `maxProofAgeSeconds` in this package defaults to 300 for the
same reason, and it is a separate check from expiry. A proof that is still inside its expiry window
but was minted forty minutes ago is worth refusing — it means somebody is holding proofs.

One small discrepancy worth fixing, because it is the kind of thing an implementer assumes: we came
into this expecting the free-trial default to be 3 uses. The extension reference says the default
is 1. Only one of those can be right, and the integration page states neither.

### 3.2 What not having sandbox access actually cost

Concretely, not abstractly:

1. **No AgentKit-generated proof.** We could not take a real proof and run it through our
   verifier, so interoperability is untested. This is the single biggest hole in the deliverable
   and it is stated plainly in the package README rather than glossed.
2. **No real `humanId`.** We do not know its encoding (the ABI we wrote guesses `bytes32`), and
   more importantly we do not know whether it is stable *across resource servers*. That question
   decides whether it can ever appear on a public leaderboard. Because we could not answer it, the
   package badges human-backed agents rather than displaying any identifier — the conservative
   choice, made out of ignorance rather than design.
3. **No revocation path to exercise.** Whether a registration can be revoked, and what the registry
   read returns afterwards, is not something we could test. We modelled a `revoked` flag
   defensively and gave it a failure code. It may not exist.
4. **No mid-session registration.** Our AgentBook cache deliberately holds negative answers for 30
   seconds and positive answers for 5 minutes, because an agent that registers while we hold a
   negative entry is stuck anonymous until it expires. That asymmetry is tuned for a scenario we
   could not once reproduce.
5. **No sight of AgentKit's own error responses.** Our 401 and 429 bodies are RFC 9457 problem
   documents of our own invention. If AgentKit's middleware returns something else, clients written
   against it will see two different shapes from the same venue.

### 3.3 What would have closed it

A public sandbox needing no access request, with three fixed test wallets — one registered, one
unregistered, one revoked — and a published proof for each. Static files served from the docs site
would be enough. Every one of the five items above is a thing that fixture set would resolve, and
none of them needs a live environment or a real human.

If sandbox gating has to stay, an access request form with a stated turnaround would still be
better than a contact request, because right now an implementer cannot tell whether to wait or to
proceed without it.

---

## 4. Confusing, missing, broken, hard to test

Ranked by how much time each one cost.

### 4.1 `AgentKitStorage`'s nonce methods cannot be implemented correctly

This is the sharpest technical finding in this document. The interface is:

```ts
tryIncrementUsage(endpoint: string, humanId: string, limit: number): Promise<boolean>
hasUsedNonce?(nonce: string): boolean
recordNonce?(nonce: string): void
```

`tryIncrementUsage` is right: async, and shaped so the check and the increment are one atomic
operation the implementer is told to make atomic. The nonce methods have three problems and each
one is independently serious.

**They are two calls, which is a race.** `hasUsedNonce` then `recordNonce` is check-then-act. Two
concurrent requests carrying the same nonce can both observe it unused before either records it,
and both pass. That is precisely the replay the nonce exists to prevent, and it is reachable by
anyone who can send two requests at once. The window is small; it is not zero, and an attacker
picks the moment.

**They are synchronous.** `hasUsedNonce(nonce): boolean`, not `Promise<boolean>`. A durable
implementation — Redis, Postgres, a Durable Object, anything shared between instances — cannot
satisfy that signature without blocking. Which means the signature quietly pushes implementers
towards in-process storage, which is exactly the thing that is wrong behind a load balancer: a
nonce spent on instance A replays cleanly on instance B.

**They are optional.** `hasUsedNonce?` and `recordNonce?`. A storage implementation that simply
does not define them compiles, runs, and has no replay protection at all, silently.

What we did instead, in `packages/agentkit-tier/src/storage.ts`:

```ts
consumeNonce(key: string, expiresAtMs: number): Promise<'accepted' | 'replayed'>;
```

One call, async, required, and returning what happened. A correct Redis implementation is
`SET key 1 NX PX <ttl>`; a correct SQL one is an insert against a unique constraint. Both are one
round trip and both are atomic by construction.

**Ask:** replace the pair with one required async call that returns whether the nonce was fresh.

### 4.2 There is no TTL on nonce storage, and no guidance about retention

`recordNonce(nonce)` takes no deadline. So an implementer has no instruction about when a nonce may
be forgotten, and both wrong answers are bad: forget too early and a proof that is still inside its
own validity window replays successfully; never forget and the set grows without bound.

Our `consumeNonce` takes an absolute `expiresAtMs`, and the verifier refuses any proof whose
lifetime exceeds a configured ceiling (`maxProofLifetimeSeconds`, default 300) specifically so that
retention is bounded. That coupling — *the lifetime ceiling is what makes the nonce set finite* —
is the kind of thing a storage contract should state, and we had to work it out.

### 4.3 Nonce scoping is unspecified

Is a nonce globally unique, or unique per agent? It matters. If the server treats nonces as a
global set, two unrelated agents that happen to pick the same string collide, and one of them is
refused for a reason it can neither see nor fix.

We scope by chain, wallet and nonce, and there is a test asserting that two agents may pick the
same nonce string. We think that is right. We could not confirm it is what AgentKit does.

### 4.4 CAIP-122 has no method field, so a proof cannot be bound to a verb

The message carries a `uri` but nothing about the HTTP method. A proof minted for
`https://api.example.com/v1/markets/42` is equally valid presented on a `GET` and on a `POST` to
that path. For a venue where one of those reads a book and the other moves money, that is worth
knowing about.

The only thing standing between a captured read proof and a write is the nonce being single-use —
which makes 4.1 considerably more serious than a theoretical race.

We check the URI's path (ignoring query strings, so a cache-buster appended in the middle does not
break a valid proof) and documented the method gap in both the code and the README rather than
pretending the check is stronger than it is.

**Ask:** either a `Request ID` convention that carries the method, or a documented note that proofs
are path-scoped and not method-scoped, so implementers stop assuming otherwise.

### 4.5 `humanId` linkability is not specified

Stated above under 3.2 and repeated here because it is a design blocker rather than an
inconvenience. "Anonymous but persistent" tells us it is stable for one human. It does not tell us
whether two different resource servers see the same value for the same human. One answer makes the
identifier safe to show publicly; the other makes it a cross-site correlation key.

**Ask:** one sentence in the docs. It changes what integrators are allowed to build.

### 4.6 Signature type coverage is easy to miss

The docs mention `eip191` as the EOA default with `eip1271` / `eip6492` supported for smart
wallets. That is good coverage and it is stated once, in passing.

This package currently verifies `eip191` only, and its `SignerRecovery` seam is injectable
specifically so ERC-1271 can be added without touching the verification flow. That was a
deliberate decision made late, after noticing the line. An agent running from a smart account is
not an edge case, and it deserves more than a clause.

---

## Summary of asks, in priority order

1. Replace `hasUsedNonce` / `recordNonce` with one required async `consumeNonce(key, ttl)` that
   returns whether the nonce was fresh. The current pair is a check-then-act race that cannot be
   implemented correctly against a shared store.
2. Publish three static proof fixtures — valid, expired, wrong-signer — so any independent verifier
   can self-check without credentials.
3. Open the sandbox, or make its test wallets public. Five specific things could not be tested
   without it; they are listed in 3.2.
4. One "wire format" reference page on the docs site: header name, envelope, exact message
   template, worked example.
5. Say which `Chain ID:` spelling goes on the wire — bare integer or CAIP-2.
6. Put "AgentBook lookup always resolves on World Chain" next to the sentence introducing Base
   support, not only in `x402/DOCS.md`.
7. Expose the resolved identity independently of the payment hooks, and ship a framework-free
   `verify(headers)` core.
8. Publish a failure-reason enum and a page mapping each reason to its cause. Separate "no human"
   from "could not find out".
9. State whether `humanId` is stable across resource servers.
10. Redirect `docs.world.org/agentkit` to the section root.
