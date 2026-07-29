# NDA-001 corpus — what each task is expected to turn green

**Created:** 2026-07-29 · Satisfies success criterion 5 of
[`NDA-001-NODE-BEHAVIOUR-CORPUS.md`](./NDA-001-NODE-BEHAVIOUR-CORPUS.md).

The corpus itself, its row-by-row status, its harness and its recorded limitations live next
to the tests: [`packages/noodl-runtime/test/corpus/README.md`](../../../packages/noodl-runtime/test/corpus/README.md).
This file is the part phase 30's other tasks need: which rows each of them owns.

Every row that fails today is marked `test.failing`, so the suite is green in CI while the
broken behaviours stay named and executed. **`test.failing` fails when the test starts
passing** — so the task that fixes a row must delete the marker in the same commit. That is
the handshake; there is no way to fix a row quietly.

| Task | Rows it should turn green | Rows it must not disturb |
|---|---|---|
| **NDA-002** — the reactivity contract for collections | R1, R2, R3, R4, R5 | R6, R6′, R10 |
| **NDA-003** — defined semantics for empty | E1, E2, E3, E4, E4′, E6, E6′, E8 | E5, E7, E8′ |
| **NDA-013** — `Variable` swallows the first change | R7 | R7 (pinned) |
| **NDA-004 / NDA-009** — `States` coalescing | R8, R9 | both `R8–R9 (pinned control)` rows |
| **NDA-006** — `Columns` rework | F3, F3′ | F3 (pinned control) |
| **NDA-010** — popup targeting and stack policy | F2 | F2 (pinned) |
| **Run Tasks / defect class D** — owner still to be assigned in [`NODE-REGISTER.md`](./NODE-REGISTER.md) | F1, F1′ | F1 (pinned control) |

Rows carrying a `′` are corollaries added while building the corpus — a second, distinct
observable of the same defect (for example E4′: once `NaN` lands in a Number Variable,
`changed` fires on *every* subsequent set for ever, because `NaN !== NaN`).

## Where it runs

`.github/workflows/pr.yml` → job `test-packages` → `npm run test:packages`, which is
`lerna run test` over `@noodl/runtime` and `@noodl/noodl-viewer-react` among others. Both
corpus directories are picked up by those packages' default `testMatch`; the wiring was
verified by running the exact CI command rather than assumed, because RUN-004 found six jest
suites that were in no workflow at all.

## Two corrections this task made to the spec

1. **E6 is not a ✅ row.** The spec reads the `if (value !== undefined)` guard at
   `modelcrudbase.ts:308` as "silently skips the key". It has an `else`, and the `else` writes
   `_defaultValueForType[type]` — so `undefined` **overwrites** the record's real content with
   `''` (typed) or `undefined` (untyped) rather than leaving it alone. E6 is a failing row and
   belongs to NDA-003.

2. **E8's "two changes observed" half already works.** A `null` crosses a bare wire and reaches
   an Object node's property; both are now pinned. What fails is what the cleared state *is*
   downstream: a String Variable's `cast: String` turns it into the four-character text
   `"null"`, which is truthy — so every downstream `Condition` takes the wrong branch and every
   Text node shows garbage. That is the end-to-end form of Richard's report and it is what
   NDA-003 has to close.
