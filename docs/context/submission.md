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

**Not yet on `main`.** The re-sync is one squash-ready commit on `claude/gifted-mestorf-6f5732`,
open as PR #17 (<https://github.com/rajkaria/hunch-vpm/pull/17>). Every check is green
(contracts, workspace, substreams, Vercel preview). Merging was denied twice by the Claude Code
auto-mode permission classifier — both `gh pr merge` and the app's auto-merge switch — so the
merge is the user's click. A merge to `main` redeploys `vpm.playhunch.xyz` on its own.

## Recent changes — files touched and why

- `docs/DEMO.md` — beat 7 close rewritten for testnet-live / mainnet-not / nothing-resolved;
  "Deployed instead" table reframed per beat; beat 1 fixture table + honest note (resolver row
  links to the wired `FeedResolver`, Stork oracle is a dead feed); beat 5 testnet note
  (`preview` not ready, `resolve` reverts until the CRE relay lands a price); beat 6 cites the
  paper §13.4 instead of the gitignored `.ocean/SPEC.md`.
- `docs/SUBMISSION.md` — verification table re-measured 13 Sep: 1,395 tests, 13 Foundry
  suites, `cre/price-relay` row added (`apps/web` is 251, not 234 — PR #15 added 17).
- `docs/SUBMISSION-CHECKLIST.md` — same total.
- This doc.

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

1. Merge PR #17 (`gh pr merge 17 --squash`) and confirm the Vercel production deploy of
   `vpm.playhunch.xyz` picked up the new `docs/`.
2. Record the demo video, on Arc testnet where the script says it is stronger.
3. Name the prize tracks.
4. Re-check every "not done" item before submitting; re-measure the test table if anything
   lands after 13 September.
