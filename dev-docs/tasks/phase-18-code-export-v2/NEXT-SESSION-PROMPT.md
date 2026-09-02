# Next session — §46 the file ↔ record pair built, gated, mutated (12 arms), driven 85/85 and committed; picker 88/127 unchanged (no node added, two refusals lifted); Tier 2.6's buildable list is still empty

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 74 ran every gate alone (a peer's webpack watch
was on the box throughout; each gate waited for the last of mine), the drive runner tore its three
servers down in a `trap` and brought the backend back on its data dir only for the verify. Memory:
`do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0`; a peer's EXP-001 + README rows still uncommitted (theirs) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 95 translated |
| EXP-009 backend connection | 🟢 AC4 driven (§42); the client is **untouched** by §46 — the envelope lives in `files.ts` |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **88/127 committed** — §46 lifted the file↔record refusals; Cloud Services: 2 left, both refused by name |
| EXP-012 | 🟢 |

## What session 74 did (EXP-011 §46)

1. **Built** both legs of the pair. Into a record: an upload's Cloud File into a record verb's or
   Set User Properties' `prop-*`, wrapped as `fileRef(file)` = `{ __type: 'File', name, url }` (the
   runtime's `_serializeObject` literal, the tag the backend types a File column from) — the wrap
   keyed on the value's own type, the import earned in the walker. Out of a record: a Cloud File or
   a Sign File URL fed from a `Record`'s column the snapshot declares `File` — a new `file-field`
   expression kind (a member off the record's row) for the Cloud File, the column read itself for
   the Sign. `tsColumnType('File')` is `CloudFile` now (it read `string` since EXP-002); the
   collection and session modules import the type, and `files.ts` is emitted for the types alone
   when a project has a File column and no files node.
2. **Three defects the build found:** the record family's attach-order trap (a sibling handler
   compiles before the Id-effect pass attaches; `recordWillFire` asks the effect's own
   order-independent preconditions); a File column typed `string` for fourteen sessions (`Date`
   still is — registered); §7.2's TDZ a third time (`isCloudFileExpr` as a `const` read by an
   earlier walker; a `function` hoists).
3. **Fixture** `tests/fixtures/gallery-desk` (47 nodes, 39 wires, `Photo { caption, image: File }`).
   **Spec** `tests/file-record.test.ts`, 26 rows; four §45 rows re-sentenced.
4. **Gates one at a time:** tsc 0; 26/26; suite 57 files 1584/1584 (twice); editor tsc 0 (twice);
   ledger OK; picker 88. **Twelve arms, all kill** — D re-armed (tsc-only kill is not a kill), L
   needed row B11 (two earners), K deleted (an unreachable sweep clause) and its gap registered.
5. **Drive** (`EXPECTED46.md` first): run 1 81/85, every diff the instrument's (a guessed route
   name, a never-cleared Error row mispredicted, the verify after the D12 kill); run 2 **85/85,
   VERIFY OK** — the stored record's `image` and the user's `avatar` are exactly the envelope.
6. Committed by pathspec (README + EXP-001 left to their peer).

## 🔴 Do this next — BUILD (the defect farm is still empty)

Rank the remaining 39 by the product surface (`node scripts/export-ledger/picker-coverage.js`):
- **`Set Object Properties` and `Create New Array`** — the two Data nodes an ordinary page reaches.
- **`Sign In With`** if provider sign-in is wanted: the client's return leg first (`_consumeAuthReturn`).
- **The `Date` column** (§46.6) if a project with a Date column shows up — `fromWire` unwrapping and
  `tsColumnType('Date')`; A5 in `file-record.test.ts` reddens when it lands.

Same shape as §41–§46: the runtime file first, the expected answers written before any run, the
toll table, refusals by name, a fixture on disk, the arms, the drive with a `trap` teardown, then
commit by pathspec.

## Open residuals (registered, none blocks an AC)

- §46.6: `Date` columns typed `string`, the wire's `{ __type: 'Date', iso }` never unwrapped — owner EXP-011.
- §46.3: a sibling handler cannot read a **button-fetched** Record in either wire order (C5 measures
  both); the effect form carries the surface — owner EXP-011.
- §46.3: the late sweep's one gap (an Id effect whose chain snapshot defers after a sibling took the
  row form) — unconstructed, loud not silent.
- §46.3: the interpreter writes a CloudFile into an undeclared column untagged — runtime, owner NONE.
- §45.3 / §44.3 / §43.3 / §41.3 unchanged.

## The numbers (last honest readings, s74)

```
packages/nodegx-export: tsc 0 · jest 57 files, 1584/1584, exit 0 (twice) · 12/12 arms kill
noodl-editor tsc: 0 (twice; second after the sweep-clause removal)
export-ledger:check OK — 176 types, 95 translated · picker 88/127 (69.3%), floor 88
drive: 85/85 cells (EXPECTED46.md), VERIFY OK, 0 listeners left after teardown; run 1 preserved (81/85, instrument)
```

## Instruments (s74 scratchpad `6be3ffae-c12a-4990-87b9-8dad6a088553/scratchpad`)

`EXPECTED46.md`, `control46.mjs` (seed / verify — reads the record and `/users/me` as alice, asserts
the envelope's keys, fetches both signed urls), `drive46.mjs` (queries the backend as alice for the
ids it must type — two queries, subtracted by name in the create count), `drive46-run.sh` (emit →
build → backend → seed → Chrome → preview → drive → backend back → verify → trap teardown),
`drive46.log` + `*-run1.*` (the control), `backend46.log`, `photos46/`, `mut46.py`/`runmut46.sh`/
`mut46-summary.txt` (+ `-round1`), `arm46-*-{tsc,jest}.log`, `jest-full-s74{,b}.log`,
`editor-tsc-s74{,b}.log`, `harness46/` (node_modules symlinked to s70's `harness43`), `emit46/`,
`*.before` / `*.s46` source snapshots, `section46-draft.md`.

## 🔴 What session 74 would tell you if it could only say three things

1. **A mutant that only tsc kills is not killed.** Arm D's `=== 'never'` was a type error, not a
   behaviour; re-armed as `.length === 0` it was killed by three rows. Read the killer, not the tally.
2. **A surviving arm is either two earners or dead code — find out which.** L was two earners (write
   the row: B11). K was a guard nothing could reach (delete it, register the gap). Same tally line,
   opposite fixes.
3. **"Not attached yet" is not "never fired".** The record family had §45.3's trap one pass over;
   ask the question the later pass will ask, at the earlier time — and pin, in both wire orders,
   what you chose not to lift.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked
before a pathspec commit or they are skipped silently); delete probe specs before committing;
reconcile the suite count against disk (57); `grep -a`; absolute paths; **`vm_stat` + `ps`
before any suite, never more than one of mine, wait out a peer's, tear servers down in a `trap`.**
