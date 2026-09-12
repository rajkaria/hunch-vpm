# Deployments

One JSON per network, so the app, the subgraph and the client all read the same addresses from
one place.

**This directory is empty of address files, and that is the honest state: nothing is deployed.**

## Where the file comes from

`contracts/script/Deploy.s.sol` does **not** write it. The script `console.log`s a deployments
JSON to stdout and stops there — `fs_permissions` in `contracts/foundry.toml` grants write
access to `./GAS.md` and nothing else, so the script has no permission to write here. You
create the file from what it printed.

```bash
ORACLE_KIND=stork \
forge script contracts/script/Deploy.s.sol \
  --root contracts \
  --rpc-url arc_testnet \
  --account <keystore-account> \
  --broadcast \
  --verify --verifier blockscout --verifier-url https://testnet.arcscan.app/api/ \
  | tee deploy.log
```

Two things about that command that are easy to get wrong:

- The script path is relative to the directory you are standing in, not to `--root`. From the
  repository root it is `contracts/script/Deploy.s.sol`; `script/Deploy.s.sol --root contracts`
  fails with `contract source info format must be <path>:<contractname>`.
- `--broadcast` needs a signer. `--account <keystore-account>` reads an encrypted Foundry
  keystore and prompts for the password; `--ledger`, `--trezor` and `--interactive` work too.
  **Never `--private-key` on a command line** — it lands in your shell history. `docs/RUNBOOK.md`
  says the same thing in the Secrets table, and this file agrees with it.

`forge script` wraps the JSON in its own output, indented two spaces under a `== Logs ==`
header, so redirecting stdout straight into the file gives you something that is not JSON. Cut
the block out instead:

```bash
sed -n '/^  {$/,/^  }$/p' deploy.log | sed 's/^  //' > deployments/arc-testnet.json
```

Read the result before committing it — that is a text cut, not a parser, and those six
addresses are the only record of the deploy. Retyping them by hand out of the terminal is an
equally good answer.

## The oracle switch

`ORACLE_KIND` is `stork` (default), `chainlink` or `mock`. Stork is the only provider with a
published Arc testnet address today; the Chainlink adapter takes the feed address per market as
its `feedKey`, so it needs no address at deploy time. `mock` is local chains only. Anything
unrecognised falls through to Stork silently, so check the adapter address the script printed
against the one you expected.

## The files

| File | Network | Chain ID | Present |
|---|---|---|---|
| `arc-testnet.json` | Arc testnet | 5042002 | no — not deployed |
| `arc-mainnet.json` | Arc mainnet | 5042 | no — not deployed |

Each file carries `chainId`, `vestedParimutuel`, `classicParimutuel`, `priceOracle`,
`feedResolver` and `marketFactory`. A network that has not been deployed to has no file —
absence means "not deployed yet", never "look somewhere else".

Six places read these addresses and none of them are wired to each other; `docs/RUNBOOK.md`
lists all six under "Wiring the addresses through".
