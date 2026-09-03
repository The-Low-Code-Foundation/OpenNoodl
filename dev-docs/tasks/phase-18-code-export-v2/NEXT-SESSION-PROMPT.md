# Next session — §56 `Filter Records` is 🟢 (session 84, 2026-09-04): picker 98/127, and 0.2.2 says the export is alpha. Next = EXP-011 Tier 2.8 row 7, `Repeater Item` — or row 9 if the session is short

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 84 ran every gate alone and waited on two peers' suites (a
background `until ! kill -0 <pid>` loop, not polling by hand), announced every launch and teardown to the peer, and
tore the editor (`dev:stop`, 25 processes) and the app stack (Chrome, preview, mock — by pid) down the moment each drive
was read. Memory: `do-not-pile-cpu-work-on-a-shared-box`, `the-editor-test-ci-webpack-typechecks-a-sibling-packages-tests`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` — the exported search-desk app builds against it |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's) |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 105 translated; **`pickerCoverageTotal` (127) now held by `--check` too** |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **98/127 (77.2%)** — §56 built Tier 2.8 row 6; **row 7 `Repeater Item` is next** |
| EXP-012 | 🟢 — and the pre-flight, the settings section and the emitted README now carry the **alpha notice** (commit 77d91c54) |
| EXP-013 "Not exportable yet" | 🟢 s78 — its `tests-unit/exp-013` specs were stale since §53/§54 (never re-run); un-staled in 77d91c54 |

## What session 84 did

1. **0.2.2's alpha notice** (commit `77d91c54`, P82's ask): `exportCoverage()` / `alphaNotice()` in `@nodegx/export`
   read `pickerCoverageFloor` + a new `pickerCoverageTotal` off the ledger — both held by `export-ledger:picker
   --check`, so the sentence is the gate's own number, percent rounded DOWN. The pre-flight modal leads with it
   (warning colour), the settings section carries it, the emitted README opens on it as a blockquote, the 0.2.2
   release notes say *97 of 127 (76%)… do not ship a production app from it yet* — **update that paragraph to 98/77%
   before the release cut** (`dev-docs/tasks/release-0.2.2/RELEASE-NOTES-0.2.2.md`).
2. **EXP-011 §56 `Filter Records`** (commit `e2774f5b`) — read §56 in `EXP-011-PICKER-COVERAGE.md`. The design in one
   line: Array Filter's twin takes Array Filter's shape (a derived list) and gates; the saved filter tree is read
   statically, the matcher (`queryutils.ts`) is transcribed into `src/lib/filterRecords.ts`. New expression kinds
   `query-get` (a Query Records' state row as a typed list), `record-filter`, `list-count`.
3. **Gates alone**: pkg tsc 0 · jest 68 files (68 on disk) 2233 · editor tsc 0 · ledger OK · picker 98 · 17/17 arms ·
   editor `test:ci` 2943 specs, 4 failures = AIX-006 ×4 by name (seed 61722, fresh `test-results.json`).
4. **Driven twice**: the editor's real write path (19/19 byte-identical, the alpha line read in settings AND modal, the
   Filter Records card badge-less beside a still-dotted Sign In With) and the BUILT app against a seven-row mock
   backend (7/7 rows in `EXPECTED19-drive.md`, written first).

## 🔴 Do this next — EXP-011 Tier 2.8, row 7: `Repeater Item`

Read the runtime first (`grep -rna "Repeater Item\|RepeaterItem" packages/noodl-runtime/src`), then §7.3 (the sentence that
excluded it) and §29 (the button in a list row — `itemActionItemId`, `itemOutputSignal-*`), and write a §57.0: what a
Repeater Item is in a template rendered by `For Each` (the row's own record and index, read from inside the template —
a prop the repeater already passes? a context?). Then `EXPECTED20.md`, the fixture, the reverted arm, the build, the
arms, the two drives. **If the session is short, take row 9 instead** (`Hash`, `Random Bytes`, `Screen Resolution` — one
browser API each; the `crypto/` nodes are ~150 lines apiece) and land 101/127.

🔴 **Every exporter change owes the editor `tsc` — and the editor `test:ci` webpack**, run by YOU on YOUR tree: a peer's
green run before your edits proves nothing about them (s84 relied on one for an hour; then ran its own).
🔴 **`TypeScript emitted no output for …/index.ts` + `assets by status [cached]` = the poisoned `.webpack-cache`** — `rm -rf
packages/noodl-editor/.webpack-cache`, re-run; the second run was the floor.
🔴 **A read-time mark keeps a dead artefact** (§56.4 E1): a query marked "read" when `resolveExpr` ran stayed allocated
after its reader was refused — ask the `consumed` set at disposition time, and drop the allocation.
🔴 **A text input's live text is not a render-time source** (§56.4 E2) — `onTextChanged` is the value port and
`input-text` is handler-only; a value read in render rides a Variable (the write-through rule).
🔴 **The import block prints before the body** (§56.4) — earn a lib import in the walkers, never in `exprCode`.
🔴 **A mutant that mutates nothing survives honestly; a guard-side cut that narrows a union fails TO COMPILE** — read
the arm's log, re-cut, record both cuts (`mut19-summary.txt`).
🔴 **Three of my sort expectations were wrong and the matcher was right** — pin the runtime's answer (run it), not
yours: bare `>`/`<` are stable around an absent value; lowercase sorts after every uppercase; `notContains` is
case-sensitive.

## Open residuals (registered, none blocks an AC)

- §56.7: the filter call printed twice when Items and Count are both consumed (a render local would print it once);
  `Count` on a named `Array` still refuses (§55.7 parity); `firstItemId` is one expression kind away; a condition on a
  Date column refused whole; a Query Records' own `visualFilter` still untranslated (fetches the whole class). Owner NONE.
- The `tests-unit/exp-013` specs had been red since §53 (nobody runs `test:main`) — memory says it is an unwatched CI gate;
  a session that translates a node named in a `tests-unit` spec must re-run it (`npx jest tests-unit/exp-013` in the editor).
- §55.7, §54.7, §53.7 rows unchanged. P80 `UNOWNED-ROWS-TO-MEASURE.md` §10 — unchanged.

## The numbers (last honest readings, s84)

```
packages/nodegx-export: tsc 0 · jest 68 files (68 on disk) 2233 rows · filter-records.test.ts 34
noodl-editor: tsc -p tsconfig.json --noEmit 0 · test:ci 2943 specs, 4 failures (AIX-006 ×4, seed 61722) · tests-unit/exp-012+013 157/157
export-ledger:check OK — 176 types, 105 translated · picker 98/127 (77.2%), floor 98, total 127, --check exit 0
arms: 17/17 killed (mut19-summary.txt) — all restored, md5 unchanged
drive: editor 19 files, 19 same, 0 diff (compare19.log); built app 7/7 rows (drive19-app.log vs EXPECTED19-drive.md)
```

## Instruments (s84 scratchpad `a2aa95be-c47e-4137-ab05-cd5ec33f262d/scratchpad`)

`EXPECTED19.md` + `EXPECTED19-drive.md` (both graded), `mkfixture19.js` (`--root=` `--name=`), `probe19.ts` +
`probe19-reverted.log` / `probe19-after.log`, `mut19.py` (`check`/`apply`/`restore`/`md5`) + `runmut19.sh` +
`mut19-summary.txt` + `arm19-*.log`, the editor drive `drive19.sh` / `open19.js` / `patchfs19.js` / `readmodal19.js` /
`readsettings19.js` / `reg19.sh` / `compare19.ts` (+ `s83/` copies of session 83's picker and settings seams), the app
drive `mock19-backend.js` / `drive19-app.sh` / `app19-read.js` / `reload19.js` / `drive19-project/` / `drive19-out/`
(installed + built), `drive19-0N-*.png`, `testci19b.log`.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; delete probe specs before committing; reconcile the
suite count against disk (68); `grep -a`; absolute paths — **the shell cwd resets between calls**; `with open(...)`
for every file write; **`vm_stat` + `ps` before any suite, never more than one of mine, wait for a peer's suite with a
background `until` loop, announce launches and teardowns, tear servers down the moment the drive is read.**
