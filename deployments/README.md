# Deployments

One JSON per network, written by `contracts/script/Deploy.s.sol` and committed so the app,
the subgraph and the client all read the same addresses from one place.

```bash
ORACLE_KIND=stork \
forge script script/Deploy.s.sol --root contracts \
  --rpc-url "$ARC_TESTNET_RPC_URL" --broadcast --verify
```

`ORACLE_KIND` is `stork` (default), `chainlink` or `mock`. Stork is the only provider with a
published Arc testnet address today; the Chainlink adapter takes the feed address per market
as its `feedKey`, so it needs no address at deploy time. `mock` is local chains only.

| File | Network | Chain ID |
|---|---|---|
| `arc-testnet.json` | Arc testnet | 5042002 |
| `arc-mainnet.json` | Arc mainnet | 5042 |

Each file carries `vestedParimutuel`, `classicParimutuel`, `priceOracle`, `feedResolver` and
`marketFactory`. A network that has not been deployed to has no file — absence means
"not deployed yet", never "look somewhere else".
