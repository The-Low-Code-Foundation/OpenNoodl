# Next session — §55 `Create New Array` is 🟢 (session 83, 2026-09-03): picker 97/127. Next = EXP-011 Tier 2.8 row 6, `Filter Records`

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 83 ran every gate alone (jest → arms → editor tsc → editor
`test:ci` → the editor drive → the app build+drive), checked `ps`/`vm_stat` before each, and tore the dev stack
down (25 processes) and the headless Chrome + `vite preview` (by pid) the moment each drive was read. Memory:
`do-not-pile-cpu-work-on-a-shared-box`, `the-editor-test-ci-webpack-typechecks-a-sibling-packages-tests`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` — the exported snap-desk app builds and typechecks against the PUBLISHED package |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 104 translated |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **97/127 (76.4%)** — §55 built Tier 2.8 row 5; **row 6 `Filter Records` is next** |
| EXP-012 | 🟢 |
| EXP-013 "Not exportable yet" | 🟢 s78 |

## What session 83 did (EXP-011 §55 — `Create New Array`; type id `CollectionNew`)

1. **Designed first (§55.0)**: the handle is the id. §7.3's "its Id feeds only a wired Array Id, which has no
   module" measured the wrong thing — the wire is static. A `Create New Array` is a state row holding a
   collection (`useState<Collection<T> | null>(null)`; `const <label>New = collection<T>([...items]);
   set<Row>(<label>New)`; the Done chain reads the LOCAL); its `id` is never a string in the emitted app; every
   Array Id port resolves through ONE `arrayTargetOf(node, component)` (appState.ts: `named` module | `minted`
   handle) — `Array`, `Insert`, `Remove`, `Clear`, the repeater feed. Reads: `useCollection(<row> ?? noArray)` in
   render, `(<row>?.peek() ?? [])` in a handler. A mutator bound by wire outside the mint's chain guards on the
   handle and raises the runtime's `<prefix>/no-array` on §54's channel before its Failure chain.
2. **Measured the reverted arm** (`EXPECTED18.md`, graded at its foot; `probe18-reverted.log`): the predicted
   refusals held — and **the NAMED list died too**: `notesArray.items` also fed the mint's Items and the Array
   node's closed list of `items` consumers read that as a stray; the named list, its insert target and §30's
   Remove fell with the one untranslated node (§55.2). The reader list is now the rule (`collectionReadEligible`).
3. **Built** (§55.3): appState `ArrayTarget`/`arrayTargetOf`/`InsertChain.minted`; plan.ts `minted-array-get`,
   `MintedTarget`, `ArrayNewAction`, `mintChainScope`/`mintStateOf`/`mintRowTypeOf`/`arrayTargetIn`/
   `mintScopeConflict`, `compileCollectionNew`, the three mutators over targets, the feed pass; component.ts the
   minted read, `mintedGuard`, `array-new`, the hook AFTER the rows, `noArray`, the core value+type import, the
   interface import. Ledger `translated`, floor 97 (five pins moved).
4. **Gates alone**: pkg tsc 0 · jest 67 files (67 on disk) 2179 · editor tsc 0 · editor `test:ci` 2943 specs, 5
   failures = AIX-006 ×4 (the floor, by name) + **SB-017 acceptance 6 "Expected 38 to be 35"** (a peer's
   site-builder template count — registered in P82's NEXT-SESSION-PROMPT) · ledger OK · picker 97 `--check` 0 ·
   the emitted apps under real `tsc` 0 (snap-desk, cheer, note-desk, batch-desk) · arms 17/17 red (M1 re-cut once:
   a `never` narrowing failed TO COMPILE — "0 total" is not a kill).
5. **Driven twice** (§55.6): the editor's real write path (card dot gone, Sign In With still dotted, pre-flight
   "17 files… Everything translates", **17/17 byte-identical to `emitApp`**), and **the BUILT app** —
   `npm install` against the published core, `tsc -b` 0, `vite build`, headless Chrome over CDP,
   `EXPECTED18-drive.md` written first: **11/11 rows**, including the middle-row removal and the copy.

## 🔴 Do this next — EXP-011 Tier 2.8, row 6: `Filter Records`

The search box over a fetched list. Read the runtime first (`grep -rna "Filter Records\|FilterDBModels\|filterrecords"
packages/noodl-runtime/src`), then §43 (Record) and §7.1 (Array Filter — `applyFilter`'s loose `==`, the sort, skip/limit) for
the vocabulary it will share; write a §56.0 (what a Filter Records over a Query Records / a named array / a minted array
means — an expression over the list, or a hook?), then `EXPECTED19.md`, the fixture, the reverted arm, the build, the arms,
the drive. Then `Repeater Item`, the streaming trio, … `Sign In With` stays OUT.

🔴 **Every exporter change owes the editor `tsc` — and the editor `test:ci` webpack.**
🔴 **A new chain owner must be added to BOTH walkers** (`scanActions` AND `deepActions` in component.ts — the
latter had never descended a Clear's or a Remove's chains, §55.4.8) **and to `fillMaterialize`**.
🔴 **A new render local must print AFTER whatever it reads** (§55.4.2 — a hook over a state row printed before the
row; only the spec's real `tsc` saw it).
🔴 **A closed list of consumers silences every later one** (§55.4.1) — before adding a node that READS a list, grep
`collectionReadEligible`.
🔴 **`Collection<T>` is invariant** (§55.4.3) — stand-ins are `<any>`, typed hooks take an explicit type argument.
🔴 **Read the sibling node's rule for the same port** (§55.4.4) — Run Tasks already decided what an untyped Items is.

## Open residuals (registered, none blocks an AC)

- §55.7: the id AS A STRING (store it on an object) needs a runtime array registry the named modules also
  register into; a component-local interface from insert keys (a minted array anything inserts into is
  `Collection<any>`); `count`/`firstItemId`/`changed` on `Array` (named and minted parity); the id nodes' own
  two-spellings hazard (§55.4.6); two Dos off one button read the row the same handler just set. All owner NONE.
- The emitted console default prints no `[noodl] ` prefix (cosmetic, errorsLib). Owner NONE.
- §54.7, §53.7 rows unchanged. P80 `UNOWNED-ROWS-TO-MEASURE.md` §10 — unchanged.

## The numbers (last honest readings, s83)

```
packages/nodegx-export: tsc 0 · jest 67 files (67 on disk) 2179 rows · create-new-array.test.ts 35
noodl-editor: tsc -p tsconfig.json --noEmit 0 · test:ci 2943 specs, 5 failures (AIX-006 ×4 floor + SB-017 acc. 6, P82's)
export-ledger:check OK — 176 types, 104 translated · picker 97/127 (76.4%), floor 97, --check exit 0
arms: 17/17 red (mut18-summary.txt) — all restored, md5 unchanged
drive: editor 17 files, 17 same, 0 diff (compare18.ts); built app 11/11 rows (drive18-app.log vs EXPECTED18-drive.md)
```

## Instruments (s83 scratchpad `243de074-9514-42b8-896d-13610c754325/scratchpad`)

`EXPECTED18.md` + `EXPECTED18-drive.md` (both graded), `mkfixture18.js` (`--root=` `--name=`; writes the registry),
`probe18.ts` + `probe18-reverted.log` / `probe18-after.log`, `tsn18.sh`, `typecheck18.ts`, `patch18-appstate.py` /
`patch18-plan.py` / `patch18-component.py` (anchored, against HEAD 86fcbcc6), `mut18.py` (`check`/`apply`/`restore`) +
`runmut18.sh` + `mut18-summary.txt` + `arm18-*.log`, `jest18-full2.log`, `testci18.log`, the editor drive `drive18.sh` /
`open18.js` / `patchfs18.js` / `settings17.js` / `settings17b.js` / `readmodal17.js` / `readtoast17.js` / `reg18.sh` /
`compare18.ts`, the app drive `drive18-app.sh` / `app-hook.js` / `app-read.js` / `app-stamp.tpl.js` / `app-clearinput.js` /
`drive18-app.log`, `drive18-project/`, `drive18-out/` (installed + built), `drive18-0N-*.png`.

## 🔴 What session 83 would tell you if it could only say three things

1. **The sentence that excluded the node was measuring a string; the wire is static.** Ask what the id NAMES
   before asking how to resolve it — the same move as §30's Remove ("no id is spelled").
2. **Measure the reverted arm on the whole fixture, not the node.** The finding of the session was on the NAMED
   side, three nodes away from the one being built.
3. **Drive the built thing.** The editor drive proved the bytes; only the browser proved that removing the
   snapshot's middle row leaves the notes' `beta` — the one row every wrong emitter reads identically on.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked before a pathspec
commit or they are skipped silently); delete probe specs before committing; reconcile the suite count against disk
(67); `grep -a`; absolute paths — **the shell cwd resets between calls**; `json.dumps(…, ensure_ascii=True)` on
the ledger; `with open(...)` for every file write (an unclosed handle flushes after your append); **`vm_stat` + `ps`
before any suite, never more than one of mine, wait for a peer's webpack to idle, tear servers down the moment the
drive is read.**
