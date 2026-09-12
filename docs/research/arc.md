# Arc, The Graph and oracles — verified integration facts

Every value here was read from a primary source on 2026-09-12. Anything unresolved is in
[Open](#open) with the fallback we build against, so no contract waits on an answer.

## Arc

| Item | Value |
|---|---|
| Chain ID (testnet) | `5042002` |
| Chain ID (mainnet) | `5042` |
| RPC (testnet) | `https://rpc.testnet.arc.network` |
| Explorer (testnet) | `https://testnet.arcscan.app` |
| Gas token | USDC, native — 18 decimals as a native balance, 6 through the ERC-20 interface |
| USDC | `0x3600000000000000000000000000000000000000` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Faucet | `https://faucet.circle.com` → Arc Testnet |
| Mainnet opens | 2026-09-16 |

USDC being the gas token is the reason the settler needs no fee token plumbing: a market's
stake asset and its gas are the same unit.

### ERC-8004 registries (live on Arc testnet)

| Registry | Address |
|---|---|
| Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Validation | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |

## The Graph

| Network | Slug | CAIP-2 |
|---|---|---|
| Arc mainnet | `arc` | `eip155:5042` |
| Arc testnet | `arc-testnet` | `eip155:5042002` |

Both are supported networks with their own documentation pages, so subgraphs deploy to
Subgraph Studio and are queried through the gateway at
`https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`.

Agent0 publishes standardized ERC-8004 subgraphs for Ethereum, Base, BSC, Polygon and Monad,
and testnets for Ethereum Sepolia, Base Sepolia, BSC Chapel and Monad — **not Arc**. Retargeting
that manifest at Arc's three registries is what `subgraph-erc8004-arc/` does.

## Oracles

Arc documents Chainlink, Chronicle, Pyth, RedStone and Stork as available. Only one publishes
a usable Arc address today:

| Provider | Arc testnet address | Status |
|---|---|---|
| Stork | `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62` | published, usable now |
| Chainlink | — | Arc joined Chainlink Scale; no Data Feed addresses published yet |
| Pyth | — | listed as available, no Arc address found |
| RedStone | — | listed as available, no Arc address found |

**How we handle it.** `FeedResolver` never talks to a provider. It talks to `IPriceOracle`:

```solidity
function read(bytes32 feedKey) external view returns (int256 price8, uint256 updatedAt);
```

One method, 8-decimal price, provider-defined `feedKey`. Adapters implement it per provider,
the deploy script picks one from configuration, and the choice is a constructor argument rather
than a code change. Stork is what we can wire today; Chainlink remains the target and becomes a
one-line deployment change the moment addresses are published.

## Open

| # | Question | What we build meanwhile |
|---|---|---|
| 1 | Chainlink Data Feed addresses on Arc | `ChainlinkFeedOracle` is written and tested against a mock `AggregatorV3Interface`; deploying it needs only an address |
| 2 | Subgraph Studio indexing lag on Arc testnet | Subgraph is written against the contract's events; lag affects demo timing, not correctness |
| 3 | Firehose availability for Arc | Substreams package targets `substreams-ethereum`, which covers any EVM chain; the hosted-sink deploy is gated on an Arc Firehose endpoint existing |
