---
feature: submission
globs:
  - docs/SUBMISSION.md
  - docs/SUBMISSION-CHECKLIST.md
  - docs/DEMO.md
  - README.md
updated: 2026-09-13
---

# ETHOnline 2026 submission

## Current state

`docs/SUBMISSION.md` (judge-facing) and `docs/SUBMISSION-CHECKLIST.md` (operator's list) are
written and current. Both describe the venue as built, and both list what is not done rather
than letting a judge discover it.

**Re-synced 2026-09-13 with the testnet deployment.** `DEMO.md` beat 7 now tells the presenter
to say "live on Arc testnet" (five contracts + `ChainlinkCreOracle` verified, two markets open,
both subgraphs in Studio, `vpm.playhunch.xyz` in production) and not "on mainnet" or "resolved";
its "Deployed instead" table shows fixtures / testnet today / still to come per beat. Beat 1's
fixture note reflects that the resolver row links to the wired `FeedResolver`. The verification
table in `SUBMISSION.md` is a 13 September reading: **1,395 tests**, `cre/price-relay` (bun)
row added. Substreams' 91 is CI's number — cargo is not installed on the dev machine.

**Two things block submission, and both are the user's:**
1. **No demo video.** `docs/DEMO.md` is a complete four-minute script in seven beats; every
   beat runs on fixtures, and beats 1, 4 and 7 are stronger recorded on Arc testnet.
2. **Prize tracks are not named.** `SUBMISSION.md` carries an explicit callout instead of a
   guess; read them off the ETHOnline page and replace it.

## Key decisions

- The submission states all gaps plainly — mainnet not deployed, no market resolved yet (CRE
  deploy access pending), Substreams cannot stream (no
  public Arc Firehose; external dependency, not an omission), the agent has never run live,
  Selfie Check is not implemented, live per-address positions are absent.
- Test counts are a dated reading, with the command as the source of truth.
- Provenance is explicit: `VestedParimutuel.sol` is vendored byte-for-byte; the 118
  conformance vectors run in CI.

## Next steps

1. Record the demo video.
2. Name the prize tracks.
3. Re-check every "not done" item before submitting — several change once testnet is deployed.
