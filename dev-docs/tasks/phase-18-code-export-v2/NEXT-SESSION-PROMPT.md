# Next session — §69 (a `Set Variable`'s typed-in `Value` is written on every Do) is BUILT and DRIVEN (session 93, 2026-09-05): §67.5 row 3 / §68.5 row 2 closed. Picker 117/127 (92.1%) unchanged — the third divergence INSIDE a translated node in three sessions, and the biggest: the refused Set had been dropping the whole Save chain in front of it. Next = the FOURTH sibling, `Global Store Set`'s typed-in Value (§69.5 row 2), then §66.5 #1's runtime measurement, then the residual registers

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 93 ran the arms, the emit+build, the drive and every gate strictly one after
another (`final-gates.sh`: `uptime` load < 8 AND no `jest-worker|vitest` of anyone's before each step). At 21:22 a PEER's editor jest
(`tests-unit/syl-003/avatargenerator.test.ts`) pushed the load to 19 — the chain sat at its gate and waited, as designed; find the
owner with `ps -Ao pid,ppid,%cpu,command | sort -k3 -nr` before deciding anything. Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## 🔴 Re-measure before inheriting — and measure the PARAMETER, not the workaround

Session 92's hand-off said *"every fixture feeds it through a String node"*. Walking every `nodes.json` for the PARAMETER found four
`Set Variable`s with a typed-in `value` (mood-desk) — all four under a wire, the shadowed shape, so the claim held for the unshadowed
case only. The corpus had 89 Set Variables in 33 fixtures and NOT ONE with a value typed in and nothing wired: the common authoring had
no presence, which is why the gap sat green. The register's one-clause estimate was right about the write and silent about the type —
two files again (`plan.ts` compile, `appState.ts` discovery); arm both.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (4 `0.1.1` rows carried) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's); §69.4 #1 registers the cascade sentence it shows on the wrong node |
| EXP-008 | ✅ `export-ledger:check` OK — the `Set Variable` note now names §69 |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 Route B built + driven s34 (the PROGRESS row saying "🔴 Not started" is STALE — the task file is the truth) |
| EXP-011 picker coverage | 🟡 **117/127 (92.1%)** — every scheduled tier built and driven; **§69 built this session**; §67.5 row 3 + §68.5 row 2 CLOSED; the 10 left are §50 out-of-scope RULINGS |
| EXP-012 | 🟢 built + driven s67 (and again §55.6) |
| EXP-013 "Not exportable yet" | 🟢 — no scheduled row remains |

## What session 93 did

1. **Re-measured** the row: `setvariablenode.ts`'s `value` is a dynamic input (`registerInputIfNeeded` → `setValue` stores it);
   `nodescope.ts` queues every authored parameter at creation; `scheduleStore` writes `internal.value` on Do. `probe69.ts` (profile-desk,
   String node removed, `value: 'Saved.'` typed in): the Set refused *nothing is wired into value* AND the refusal cascaded — the Save
   button emitted with **no `onClick`**, 4 refusals on a page that had 0. The type read `value<string | undefined>` for a number too
   (§67.5 #2's `all([])`, seen live).
2. **§69** — `plan.ts` Set Variable case: no wire ⇒ `literalParam(node, 'value')` ⇒ a literal `store-set`; the `setWith` gate stays in
   front; under a wire shadowed; an expression / nothing typed ⇒ the old sentence. `appState.ts`: a literal `SourceRef` beside the
   writer, unwired only ⇒ **the literal types the variable** (`7` ⇒ `value<unknown>`, the read goes through `String()`).
3. **Fixture** `profile-desk` RE-AUTHORED: the String node and its wire gone, `Saved.` typed into `setStatus`. **Output byte-identical**
   (`pre69.json` = `post69.json`, 16 files) ⇒ no pin in object-store moved; B3/B9/B7/C3 adjusted for the missing String node.
4. **Spec** `tests/object-store.test.ts` **51 rows** (+8, §F). **Arms** `mut69.py` **10/10 killed**, md5-restored. **One pin moved
   elsewhere**: `variable-seed.test.ts` C6 (§67) pinned the OLD refusal (*not* `status.set('Pulsed.')`) — the whole-package run found
   it, a grep would not have; it now asserts the write on the pulse and no mount effect.
5. **Drive** (`EXPECTED69.md` FIRST, `drive69.sh`, built `profile-desk-out` — s92's bundle to the byte, 237.88 kB): boot all `''`; Save ⇒
   `Saved.`, `Ada`, `2026`; errs `[]`; 0 listeners after. **C1 control**: the SAME fixture emitted by HEAD's source in a detached
   worktree (`git worktree add --detach … 8ecb5248` + `ln -s node_modules`, removed after) ⇒ `<button className={styles.saveButton}>Save
   profile</button>`, no handler, the two dropped-wire notes as predicted.
6. **Docs**: EXP-011 §69 (seven subsections), §67.5 row 3 + §68.5 row 2 ticked, the ledger note, the PROGRESS row.

## The final gate chain — READ on the final tree

`final-gates.sh` (s93 scratchpad `59b4575c-…`), each step behind the load gate, restarted once after the C6 pin moved so the whole package
read the FINAL tree: **whole pkg jest 79 files (79 on disk) 2928/2928 exit 0** (`whole.*`, 21:25–21:27; the first pass, 21:19–21:21, read
1 red = C6, then the peer's suite parked the chain at its gate) · **editor tsc exit 0** (`editor-tsc.*`, 21:30, an EMPTY log — s88–s92's
shape) · **`export-ledger:check` OK — 176 types, 124 translated** · **`export-ledger:picker` 117/127 exit 0** · **editor `test:ci` 2943
specs, 5 failures = the known floor BY NAME** (AIX-006 ×4 + SB-017 acceptance 6; seed 23233, HEAD `45d8f4c6` — a PEER's commit landed
mid-run, not mine; `test-results.json` fresh 21:32; `.webpack-cache` cleared first; the enforced gate exits 1 on the floor, as in s88–s92).
Feature commit: see `git log -2 -- packages/nodegx-export/src/analyze/plan.ts`.

## Uncommitted at hand-off

- Nothing of session 93's (see the commit line in the gate section). `EXP-001-NODEGX-CORE.md` still carries a PEER's edit, untouched and
  not committed. `library/prefabs/**` and `library/modules/avatar/**` modifications/deletions are a peer's (P78), untouched.

## 🔴 Do this next

1. **`Global Store Set`'s typed-in `Value` — the FOURTH sibling** (§69.5 row 2). `globalstoresetnode.ts` has a STATIC `value` input whose
   setter stores `internal.value`, written on `Set` (`globalStoreManager.setKey`); the export's `net.noodl.GlobalStore.Set` case in
   `plan.ts` (grep `'nothing is wired into value'` — the FIRST hit, one screen above the Set Variable case) refuses it by that sentence.
   Same fix as §69: a clause after the `key`/`merge`/`transaction` gates, a literal `SourceRef` in `appState.ts` under `storeKeySources`
   (beside the wired `GLOBAL_STORE_SET` registration, ~line 660) — mind the store key's `number`/`boolean`-typed-by-initial-state
   refusal, which a literal must respect too. RE-MEASURE first (probe, then the corpus walk for the parameter — `value` on
   `net.noodl.GlobalStore.Set` nodes). Fixture: the global-store fixture (`tests/global-store.test.ts`, line ~276 pins the refusal —
   that pin moves). ≥8 arms, a drive. **Make it EXP-011's** when you start.
2. **§66.5 #1** — measure in the RUNTIME whether a Variable nothing has written delivers `undefined` into `Enabled` at boot (⇒ OFF) or
   never runs the setter (⇒ ON). Only then may a fixture wire Enabled from a Variable.
3. **§67.5 finding 2** — a variable with NO sources is typed `string` (`all([])`); store keys read `unknown` since §47. Owner NONE;
   count the fixtures whose variables are written only by refused logic first.
4. **§68.5 row 3** — the `Object` node's OWN `prop-*` inputs as authored literals. Owner NONE; measure the runtime first.
5. **§69.4 #1** — the cascade sentence lands on the node IN FRONT of the refused sink (*Save profile — nothing is wired into value*);
   EXP-004's report is where a person reads it. Owner NONE.
6. The residual registers (§57.5–§69.5); EXP-004's two Richard items.

🔴 **The typing rule and the write rule live in two files** — `appState.ts` (discovery) and `plan.ts` (compile); arm BOTH. 🔴 **A
whole-package run is the pin sweep a grep cannot do** — C6's pin was a NEGATIVE on emitted text, no sentence to grep for. 🔴 **A zsh
`rm -f a.* b.*` with ONE unmatched glob removes NOTHING** (`no matches found` aborts the command) — `rm` per file, or `setopt +o nomatch`;
a stale `whole.exit` would have read as a fresh gate. 🔴 **`echo ======` in zsh is `=cmd` expansion** — quote it. 🔴 **Arm at the
VALUE level.** 🔴 **`grep -a` for a pin sweep.** 🔴 **Every exporter change owes the editor `tsc` AND `test:ci`, run by YOU, alone;
`rm -rf .webpack-cache` first.** 🔴 **`ts-node` here needs
`-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.** 🔴 **`emit.ts` REMOVES its
output directory — copy `node_modules` in AFTER the emit** (s93 copied from s92's `profile-desk-out`). 🔴 **A reverted arm = `git
worktree add --detach <scratch> HEAD` + `ln -s <repo>/node_modules`, `R=<worktree>/packages` for `emit.ts`; remove it after. NEVER a
stash.** 🔴 **The shell cwd resets between calls, but a `cd` INSIDE a call persists to the next** — absolute paths always (s93 wrote two
docs into the wrong directory this way; the heredoc reported success).

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §69.5: a literal under a wire (mood-desk's four); `Global Store Set`'s typed-in Value (→ job 1); `setWith` coercions with a typed-in
  value; a refused Set's literal still types the variable; the cascade sentence on the node in front (→ job 5).
- §68.5: a literal under a wire; the `Object` node's own authored `prop-*` (→ job 4).
- §67.5: the same wire residual; a no-source variable typed `string` (→ job 3); StrictMode's double seed write (idempotent).
- §66.5 / §65.5 / §64.5 / §63.5 / §61.5 / §62.5 / §57.5–§59.5 unchanged; §60.5 has no EXP-011-owned row left.

## Instruments

s93 scratchpad `59b4575c-dbbe-419b-b055-3877c34de425`: `probe69.ts` (the pre-change measurement; `num` arg), `snap.ts` + `pre69.json` /
`post69.json` (the byte-identity proof), `mut69.py` + `mut69-summary.txt` + `mut69.log` (10 arms), `EXPECTED69.md`, `drive69.sh` +
`drive69.log`, `drivelib.sh` + `emit.ts` (from s92, paths rewritten), `profile-desk-out` (the built app) + `profile-desk-build.log`,
`profile-desk-rev-out` (C1, the reverted source's emit of the same fixture), `final-gates.sh` + its `*.log/.exit/.start/.files`.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (79 spec files);
`grep -a`; absolute paths; **`pgrep -f jest-worker` before any suite, never more than one of mine, wait for a peer's suite, tear
servers down the moment the drive is read (s93: 0 listeners on 4369 / 9370 at teardown).**
