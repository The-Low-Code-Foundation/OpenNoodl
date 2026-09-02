# Next session — §47 the named Object built, gated, mutated (13 arms), driven 57/57 + a sabotage control, and committed; picker 88 → 89/127; the Data bucket's two handoff names answered (one built, one re-derived and kept refused)

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 75 ran every gate alone and **queued the full
suite behind a peer's idling look-test jest** (`while kill -0 <pid>`) instead of stacking on it; the
drive tore its Chrome and preview down in a `trap` (0 listeners, twice). Memory:
`do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0`; a peer's EXP-001 + README rows still uncommitted (theirs) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + three lines for Richard remain |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 96 translated |
| EXP-009 backend connection | 🟢 AC4 driven (§42); untouched by §47 (client-side state, no backend) |
| EXP-010 | 🟢 |
| EXP-011 picker coverage | 🟡 **89/127 committed** — §47 added `Set Object Properties` and lifted the explicit half of `Object`; Data: 19 left, Cloud Services: 2, both refused by name |
| EXP-012 | 🟢 |

## What session 75 did (EXP-011 §47)

1. **Built the named Object.** `Object` in "Specify explicitly" mode (the picker's default) with a
   literal Id is a **store module** — `src/stores/<id>.ts`, `store<IdState>('<id>', {})`, the Global
   Store machinery with a second declarer kind (`StorePlan.origin: 'object'`, printed "Read by");
   its `prop-<key>` reads are `useStore(profile, (s) => s.key)` in render and `profile.get().key` in
   a handler. `Set Object Properties` with the same Id is one patch, `profile.set({ name, city })`
   in the node's own list order, then its Done chain — a new action `object-set` and its toll.
   The runtime told the shape: a Global Store *is* a `Model` keyed with a prefix (globalstore.ts),
   and `@nodegx/core`'s `store()` doc already said "the exported equivalent of a Global Store or an
   Object node". An Id that is also a Global Store's name refuses the Object side (two records in
   the runtime, one `store()` in the export); the store keeps its module.
2. **Three findings on the way:** the first emit dropped the Save wire — `Set Object Properties` was
   not on the control-mint `outputRead` list (fifth family on s19's rule); a writer-less key typed
   `string` through `[].every` (fixed for Object keys, registered for Global Store keys); the
   neighbour `array-vocabulary.test.ts` pinned the sentence this slice re-wrote (re-sentenced, the
   behaviour unchanged).
3. **Fixture** `tests/fixtures/profile-desk` (16 nodes + a 3-node badge component reading the same
   object from a second file). **Spec** `tests/object-store.test.ts`, 35 rows.
4. **Gates one at a time:** tsc 0 first pass; suite 58 files 1635/1635 (first run 1632/1634, two neighbour rows re-sentenced); editor tsc 0;
   ledger OK — 176 types, 96 translated; picker 89, floor 89. **Thirteen arms, 13/13 kill** — I
   survived round one (a reachable branch with no row: a Set nothing fires whose compile still
   refused), C12 written, killed alone; L killed by B12, the row written *before* the arm.
5. **Drive** (`EXPECTED47.md` first, no backend): run 1 **57/57, 0 diffs, consoleErrors []**; the
   arm-H build through the same instrument read **53/57 — the four `status` cells and nothing
   else** (the prediction named three; D4's persisting status was the one it forgot).
6. Committed by pathspec (the peer's README + EXP-001 rows left alone).

## 🔴 Do this next — BUILD (the defect farm is still empty)

Rank the remaining 38 by the product surface (`node scripts/export-ledger/picker-coverage.js`):
- **`Sign In With`** if provider sign-in is wanted — the client's return leg first (`_consumeAuthReturn`).
- **The two Global Store gaps §47.3 registered** — one clause each: `Set Global Store` on the
  control-mint list; the vacuous `every` on a Set-only key with no value wire.
- **The `Date` column** (§46.6) — `fromWire` unwrapping and `tsColumnType('Date')`; A5 in
  `file-record.test.ts` reddens when it lands.
- Data bucket after that: `Action Dispatcher`/`Action Handler` (a dispatch pair), `Repeater Item`.
  `Create New Array` stays refused by decision (§47.3) — its only consumer is a wired Array Id.

Same shape as §41–§47: the runtime file first, the expected answers written before any run, the
toll table, refusals by name, a fixture on disk, the arms, the drive with a `trap` teardown, then
commit by pathspec.

## Open residuals (registered, none blocks an AC)

- §47.3: `Set Global Store` not on the control-mint list — an input read from a button into it drops; owner EXP-011.
- §47.3: Global Store key typed `string` over zero writers (`[].every`) — owner EXP-011.
- §47.3: the Object's `id` output / the Set's `id` and `error` — refused by the gate when consumed.
- §47.3: `Create New Array` — refused by decision, re-derived; the consumer side would move it.
- §46.6 / §46.3 / §45.3 / §44.3 / §43.3 / §41.3 unchanged.

## The numbers (last honest readings, s75)

```
packages/nodegx-export: tsc 0 · jest 58 files, 1635/1635, exit 0 · 13/13 arms kill (I on round two, C12)
noodl-editor tsc: 0 (alone, after the drive)
export-ledger:check OK — 176 types, 96 translated · picker 89/127 (70.1%), floor 89
drive: 57/57 cells (EXPECTED47.md), consoleErrors [], 0 listeners after teardown; arm-H control 53/57, exactly the four status cells
```

## Instruments (s75 scratchpad `1e6f484d-f657-40fe-b1bd-8f28f9eebbb7/scratchpad`)

`EXPECTED47.md`, `drive47.mjs` (CDP: types, clicks, six paragraphs by position, grades its own
cells), `drive47-run.sh` (emit → build → Chrome → preview → drive → trap teardown; no backend),
`drive47.log` + `drive47-run1.*` (run 1) + `drive47-armH.log` (the control), `mut47.py` /
`runmut47.sh` / `mut47-summary.txt` (+ `-round1`), `arm47-*-{tsc,jest}.log`, `jest-full-s75*.log`,
`editor-tsc-s75.log`, `harness47/` (node_modules symlinked to s70's `harness43`), `emit47/`,
`*.before` / `*.s47` source snapshots, `section47-draft.md`.

## 🔴 What session 75 would tell you if it could only say three things

1. **`[].every(…)` is `true`, and it typed "nothing wrote this" as `string`.** A key that exists
   because a *read* names it has an empty writer list as its ordinary case. Assert cardinality
   where a vacuous quantifier decides a type.
2. **A new handler-argument reader owes the control-mint list.** Five families now (record verbs,
   user verbs, files, this Set — and `Set Global Store` is missing). The first emit tells you:
   *"the action reads values that only exist in another handler"* is that clause's own sentence.
3. **A surviving arm can be a branch only a half-built graph reaches.** Arm I's "ask the compiler
   first" is met by a Set nobody wired whose Id is blank — ordinary in an editor, absent from every
   fixture. Write the row for the graph a person leaves at 5pm, not only the finished one.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git status | grep '^??'` first (`git add` untracked
before a pathspec commit or they are skipped silently); delete probe specs before committing;
reconcile the suite count against disk (58); `grep -a`; absolute paths (the shell's cwd resets
between calls — two edits this session went to the wrong directory before that was noticed);
**`vm_stat` + `ps` before any suite, never more than one of mine, queue behind a peer's with
`while kill -0`, tear servers down in a `trap`.**
