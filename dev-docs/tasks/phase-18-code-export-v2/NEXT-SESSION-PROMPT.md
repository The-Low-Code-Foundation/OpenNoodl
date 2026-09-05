# Next session — §68 (a `Set Object Properties`' typed-in `prop-<key>` value is written on every Do) is BUILT and DRIVEN (session 92, 2026-09-05): the §60.5 register's second EXP-011-owned row closed. Picker 117/127 (92.1%) unchanged — a defect INSIDE a translated node again. Next = the THIRD sibling with the same runtime rule, `Set Variable`'s authored Value (§67.5 row 3 / §68.5 row 2), then §66.5 #1's runtime measurement, then the residual registers

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 92 ran the arms, the emit+build, the drive and every gate strictly one after
another (`final-gates.sh`: `uptime` load < 8 AND no `jest-worker|vitest` of anyone's before each step). The load of 7.5 at 20:46
was macOS's XProtect scanners, not a peer — `ps -Ao pid,ppid,%cpu,command | sort -k3 -nr` before deciding. Memory:
`do-not-pile-cpu-work-on-a-shared-box`.

## 🔴 Re-measure before inheriting

Session 91's first job was RIGHT this time (the register said "one clause in `compileSetObjectProperties`", and it was), but the
re-measure still paid: it found the typing half lives in a second file (`appState.ts` discovery), which the register's sentence did
not say — a clause in `plan.ts` alone would have emitted `profile.set({ since: '2026' })` against an interface with no `since`
(TS2353 in the built app). Open the compiler AND the discovery pass before believing a one-clause estimate.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (4 `0.1.1` rows carried) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's) |
| EXP-008 | ✅ `export-ledger:check` OK — the `SetModelProperties` note now names §68 |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 Route B built + driven s34 (the PROGRESS row saying "🔴 Not started" is STALE — the task file is the truth) |
| EXP-011 picker coverage | 🟡 **117/127 (92.1%)** — every scheduled tier built and driven; **§68 built this session**; the §60.5 register has NO EXP-011-owned row left; the 10 left are §50 out-of-scope RULINGS |
| EXP-012 | 🟢 built + driven s67 (and again §55.6) |
| EXP-013 "Not exportable yet" | 🟢 — no scheduled row remains |

## What session 92 did

1. **Re-measured** the row: `compileSetObjectProperties` skipped any key with no wire without reading its parameter; the runtime
   (`nodescope.ts` queues every authored parameter into the node at creation → `_setInputValue`; `modelcrudbase.ts`
   `_pushInputValues` writes every listed key that is not `undefined` on Do) writes the typed-in value on every Do. `probe68.ts` on
   profile-desk's Set with `prop-since: '2026'`: the patch was `{ name, city }`, the module had no `since`, no note — silent.
2. **§68** — `plan.ts`: on an unwired listed key, `literalParam('prop-<key>')` ⇒ a literal entry **in the loop** (list order holds);
   the acting-selector refusal (Array `eval`s, Object dereferences) stands in front of BOTH paths; a literal under a wire is shadowed
   (never read); an unlisted key is filtered out like a wire there and leaves nothing to drop; an `expression` parameter stays refused.
   `appState.ts`: a literal `SourceRef` per listed, unwired, authored key ⇒ **the literal types the key** (`'2026'` ⇒ `since?: string`,
   `2026` ⇒ `unknown`, and the patch typechecks against it); under a wire the wire governs the type too.
3. **Fixture** `profile-desk` extended (the ONLY fixture of 39 with a `SetModelProperties`, and none carried a `prop-*` parameter —
   the shape had no presence anywhere): the Set lists `name,city,since` with `prop-since: "2026"`, the Object lists `since`, a fourth
   Text reads it. Spec `tests/object-store.test.ts` **43 rows** (+8, §E); moved pins: `SAVE`, the module golden, B1, B2, B8, B9, D4.
4. **Arms**: `mut68.py`, **11/11 killed**, md5-restored. **Drive** (`EXPECTED68.md` FIRST, `drive68.sh`, built `profile-desk-out`):
   boot all `''`; Save ⇒ `since` reads **`2026`** (the old export would read `''`); a second Save keeps it; errs `[]`; 0 listeners after.
5. **Docs**: EXP-011 §68 (six subsections), §60.5's row ticked, the ledger note, the PROGRESS row.

## The final gate chain — READ on the final tree

`final-gates.sh` (s92 scratchpad `f539fd01-…`), each step behind the load gate: **whole pkg jest 79 files (79 on disk) 2920/2920
exit 0** (`whole.*`, 20:49–20:51) · **editor tsc exit 0** (`editor-tsc.*`, an empty log — s88–s91's shape) · **`export-ledger:check`
OK — 176 types, 124 translated** · **`export-ledger:picker` 117/127 exit 0** · **editor `test:ci` 2943 specs, 5 failures = the known
floor** (AIX-006 ×4 + SB-017 acceptance, by name; seed 90147, HEAD 1bcc3535; `test-results.json` fresh 20:56; `.webpack-cache` cleared
first; the enforced gate exits 1 on the floor, as in s88–s91).

## Uncommitted at hand-off

- Nothing of session 92's (feature `e6bbe6ec`, docs in the commit after it). `EXP-001-NODEGX-CORE.md` still carries a PEER's edit,
  untouched and not committed. `library/prefabs/**` modifications are a peer's (P78), untouched.

## 🔴 Do this next

1. **`Set Variable`'s authored `Value`** — the THIRD sibling with the same runtime rule (§67 `Variable`, §68 `Set Object Properties`
   both built; §60's Set read the literal from the start). The export refuses it (*nothing is wired into value*, §60.4 finding 7)
   where the runtime writes the literal on the pulse — and "Set status to `Saved.`" typed straight into the node is the COMMON
   authoring; every fixture feeds it through a `String` node instead, which is why it never showed. **RE-MEASURE first**: read the
   `Set Variable` compile in `plan.ts` (`compileSetVariable` or its neighbour — grep `'Set Variable'`) AND `setvariablenode`'s
   runtime setter; then one clause mirroring §68's, a literal `SourceRef` in discovery (`appState.ts` already registers the WIRED
   `Set Variable` source — the literal goes beside it), a fixture that types the value in, ≥8 arms, a drive. Registered §67.5 row 3
   and §68.5 row 2; **make it EXP-011's** when you start.
2. **§66.5 #1** — measure in the RUNTIME whether a Variable nothing has written delivers `undefined` into `Enabled` at boot (⇒ OFF)
   or never runs the setter (⇒ ON). Only then may a fixture wire Enabled from a Variable.
3. **§67.5 finding 2** — a variable with NO sources is typed `string` (`all([])`); store keys read `unknown` since §47. Owner NONE;
   moving it changes every fixture whose variables are written only by refused logic — count them first.
4. **§68.5 row 3** — the `Object` node's OWN `prop-*` inputs as authored literals (a write through the Object at creation) are
   silently not written (`objectNodeGate` refuses only a WIRED prop input). Owner NONE; measure the runtime first (`Model2`'s setter).
5. The residual registers (§57.5–§68.5), each owner NONE unless named; and EXP-004's two Richard items.

🔴 **The typing rule and the write rule live in two files** — `appState.ts` (discovery, types the key/variable) and `plan.ts`
(compile, writes it); arm BOTH (M5/M8 vs M1 were different kills). 🔴 **`typecheck-emitted` / the spec's own typecheck row
before the first arm.** 🔴 **Arm at the VALUE level** — `if (false) …` reads NO SUMMARY, not a kill. 🔴 **`grep -a` for a pin
sweep.** 🔴 **Every exporter change owes the editor `tsc` AND `test:ci`, run by YOU, alone; `rm -rf .webpack-cache` first.**
🔴 **`ts-node` on this package needs `-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.**
🔴 **`emit.ts` REMOVES its output directory — copy `node_modules` in AFTER the emit** (s92 copied from s91's `panel-desk-out`).
🔴 **A page's heading Text is a `<p>` too** — count it in the prediction sheet (s92's sheet predicted six, the page had seven,
the six followed the heading exactly). 🔴 **The shell cwd resets between calls, but a `cd` INSIDE a call persists to the next** —
absolute paths always.

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §68.5: a literal under a wire (shadowed; the runtime shows it until the wire first delivers); `Set Variable`'s authored Value
  (→ job 1); the `Object` node's own authored `prop-*` (→ job 4).
- §67.5: the same wire residual for `Variable`; a no-source variable typed `string`; StrictMode's double seed write (idempotent).
- §66.5 / §65.5 / §64.5 / §63.5 / §61.5 / §62.5 / §57.5–§59.5 unchanged; §60.5 has no EXP-011-owned row left.

## Instruments

s92 scratchpad `f539fd01-2737-4bd6-b421-60e61ca1d899`: `emit.ts` + `drivelib.sh` (from s91, paths rewritten), `probe68.ts` (the
pre-change measurement; `num` arg for the number literal), `mut68.py` + `mut68-summary.txt` (11 arms), `EXPECTED68.md`, `drive68.sh`,
`drive68.log`, `profile-desk-out` (the built app, `node_modules` copied from s91's `panel-desk-out`), `profile-desk-build.log`,
`final-gates.sh` + its `*.log/.exit/.start/.files`.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (79 spec files);
`grep -a`; absolute paths; **`pgrep -f jest-worker` before any suite, never more than one of mine, wait for a peer's suite, tear
servers down the moment the drive is read (s92: 0 listeners on 4368 / 9369 at teardown).**
