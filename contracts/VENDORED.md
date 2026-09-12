# Vendored, pre-existing code

These files were written before ETHOnline 2026 and are **not** part of what this project
submits as new work. They are vendored verbatim so the new contracts around them can be
proven not to have changed the mechanism.

| File | Origin | Modified? |
|---|---|---|
| `src/VestedParimutuel.sol` | reference implementation published with *The Vested Parimutuel* (MIT, no dependencies) | no — byte-for-byte |
| `src/NaiveVestedParimutuel.sol` | the paper's §4.1 loop form, for gas comparison only | no |
| `src/mocks/MockERC20.sol` | the reference project's transfer-exact test token | no |
| `test/Vectors.t.sol` | the reference project's differential replay | fixture path only |
| `test/Mechanism.t.sol` | the reference project's hand-checked paths | no |
| `test/Gas.t.sol` | the reference project's gas measurements | no |
| `test/vectors/vpm-vectors.json` | published conformance suite 1.2.0 — 118 vectors | no |

`test_ReplayAllVectors` is the regression guard on the vendoring itself: if anyone edits the
settler, the published vectors stop passing and CI goes red. Everything else in `src/` is new.
