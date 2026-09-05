# Next session — §67 (a `Variable`'s authored `Value` is the runtime's per-mount write) is BUILT and DRIVEN (session 91, 2026-09-05): the §60.5 register's first EXP-011-owned divergence closed. Picker 117/127 (92.1%) unchanged — this was a defect INSIDE a translated node. Next = §60.5's second EXP-011 row (`Set Object Properties` skips an authored `prop-<key>` literal), then §66.5 #1's runtime measurement, then the residual registers

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 91 ran every gate sequentially behind a load gate (`final-gates.sh`:
`uptime` load < 8 AND no `jest-worker|vitest` of anyone's). Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## 🔴 Re-measure before inheriting — session 90's "next" was stale

Session 90's hand-off named **"the editor write path drive — EXP-012 specced, never driven"** as the first job. **EXP-012's own
file says it was driven in session 67** (AC1–AC6 ✅, `diff -r` against `emit-app.ts` IDENTICAL) and §55.6 drove it again (17 files
byte-identical). The claim was a relayed conclusion that had decayed (memory: `a-none-owned-blocker-is-the-one-most-likely-already-fixed`).
Session 91 therefore built the register's first row with an owner instead.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (4 `0.1.1` rows carried) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's) |
| EXP-008 | ✅ `export-ledger:check` OK — unchanged this session |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 Route B built + driven s34 (the PROGRESS row saying "🔴 Not started" is STALE — the task file is the truth) |
| EXP-011 picker coverage | 🟡 **117/127 (92.1%)** — every scheduled tier built and driven; **§67 built this session** (a divergence inside `Variable2`, §60.5's row); the 10 left are §50 out-of-scope RULINGS; one EXP-011-owned register row left (§60.5 `Set Object Properties` literal) |
| EXP-012 | 🟢 built + driven s67 (and again §55.6) |
| EXP-013 "Not exportable yet" | 🟢 — no scheduled row remains |

## What session 91 did

1. **§67** — `variablenode2.ts`'s `value` setter stores the authored parameter at node creation, so the runtime rewrites the
   variable on EVERY mount of the holding component; the export booted `undefined` (§60.4 finding 8, CONFIRMED by §60.6's drive:
   `''` where the runtime reads `First note`). Built as **a mount effect in the host** — `useEffect(() => { note.set('First note'); }, [])`
   printed before the §60 mirrors — never a module-level seed (boots once, never resets, runs for a component nothing mounted).
   `VariableSeedPlan` on `ComponentPlan.variableSeeds`; `variableSeedAction()` is the `store-set` the seed IS, so the import sweep
   and the emitter read one object. Discovery pushes the node as a writer `{…, seed}` and a literal `SourceRef`, so **the literal types
   the variable** (`42` ⇒ `value<unknown>`, and it typechecks). Refused by name: a wire into Value (the wire governs), a non-primitive
   parameter; a non-literal name defers on the name; a logic-only component bails before the pass.
2. **Measured first**: the pre-change emit — `note = value<string | undefined>(undefined)` under *No statically-known writer*, no
   write of `note` anywhere in Home. panel-desk is the ONLY fixture of 39 with an authored Variable value (walked every `nodes.json`).
3. **Gates**: pkg tsc 0 · spec `tests/variable-seed.test.ts` **18/18** (two rows typecheck the emitted app) · the §60 trio spec
   60/60, no pin moved · **13/13 arms killed** (`mut67.py`; two arms first read NO SUMMARY — `if (false)` un-narrowed a later read
   ⇒ TS2322 ⇒ ts-jest compiled nothing; re-armed at the value level; M13 survived until C6 stood the Set's literal alone — the
   fixture's wire had hidden it).
4. **The drive** (`EXPECTED67.md` FIRST, `drive67.sh`, built `panel-desk-out`): P1 boot `First note` on Home AND the Panel where s88
   read `''`; P3 Rename ⇒ `renamed` on both (the variable still `First note`, the mirror did NOT re-run — predicted); P4 Bump `1`;
   errs `[]`; 0 listeners after teardown. Every row matched the sheet.

## The final gate chain — READ on the final tree

`final-gates.sh` (s91 scratchpad `52663107-…`), each step behind a load gate: **whole pkg jest 79 files (79 on disk) 2912/2912 exit 0** (`whole.*`, 20:29) · **editor tsc exit 0** (`editor-tsc.*`, 20:32, an empty log — s88–s90's shape) · **`export-ledger:check` OK — 176 types, 124 translated** · **`export-ledger:picker` 117/127 exit 0** · **editor `test:ci` 2943 specs, 5 failures = the known floor** (AIX-006 ×4 + SB-017 acceptance; seed 45405, HEAD 71c4bada — a peer's commit on top of mine; `test-results.json` fresh 20:34, 66 s; `.webpack-cache` cleared first; the enforced gate exits 1 on the floor, as in s88–s90).

## Uncommitted at hand-off

- Nothing of session 91's (see the commit). `EXP-001-NODEGX-CORE.md` carries a PEER's edit, untouched and not committed.

## 🔴 Do this next

1. **§60.5's second EXP-011-owned row — `Set Object Properties` (§47) skips an authored `prop-<key>` literal** where the runtime
   writes it (`base.ts` receives parameters into `inputValues` at creation). One clause in `compileSetObjectProperties`, mirroring §60's
   Set (which writes `note: 'renamed'`). Fixture: extend or mutate `tests/fixtures/…` with a named Object's Set carrying a literal.
   RE-MEASURE first — read `compileSetObjectProperties` and emit a shape with a literal before believing the register.
2. **§66.5 #1** — measure in the RUNTIME whether a Variable nothing has written delivers `undefined` into `Enabled` at boot (⇒ OFF)
   or never runs the setter (⇒ ON). Only then a fixture may wire Enabled from a Variable.
3. **§67.5 finding 1** — a variable with NO sources is typed `string` (`all([])`); store keys read `unknown` since §47. Owner NONE;
   moving it changes every fixture whose variables are written only by refused logic — count them first.
4. The residual registers (§57.5–§67.5), each owner NONE unless named; and EXP-004's two Richard items.

🔴 **`typecheck-emitted.test.ts` / the spec's own typecheck row before the first arm** — the type demotion arm (M4) is invisible to
every text pin; only the typecheck killed it. 🔴 **Arm at the VALUE level** — `if (false) …` reads NO SUMMARY, not a kill.
🔴 **`grep -a` for a pin sweep.** 🔴 **Every exporter change owes the editor `tsc` AND `test:ci`, run by YOU, alone;
`rm -rf .webpack-cache` first.** 🔴 **`ts-node` on this package needs
`-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.** 🔴 **`emit.ts`
REMOVES its output directory — copy `node_modules` in AFTER the emit.** 🔴 **Notes carry `Pages/Home: ` at the app level and no
prefix on the plan.** 🔴 **Writers list in COMPONENT order** (`Components/…` before `Pages/…`).

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §67.5: an authored Value under a wire (refused by name); a no-source variable typed `string`; a `Set Variable`'s authored Value
  (refused by the export, written by the runtime on the pulse — C6 pins it is not a seed); StrictMode's double write (idempotent).
- §66.5 / §65.5 / §64.5 / §63.5 / §61.5 / §62.5 / §57.5–§59.5 unchanged; §60.5: the `Set Object Properties` literal (owner EXP-011).

## Instruments

s91 scratchpad `52663107-7404-44d8-a98c-524741eb3620`: `emit.ts` (from s90), `probe67.ts` / `probe67b.ts` (the D1/C1/C3/C4
shapes), `mut67.py` + `mut67-summary.txt` (13 arms), `EXPECTED67.md`, `drivelib.sh`, `drive67.sh`, `drive67.log`,
`panel-desk-out` (the built app; `node_modules` copied from s90's `live-desk-out`), `panel-desk-build.log`, `final-gates.sh` + its
`*.log/.exit/.start`.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (79 spec files now);
`grep -a`; absolute paths — **the shell cwd resets between calls**; **`pgrep -f jest-worker` before any suite, never more than one
of mine, wait for a peer's suite, tear servers down the moment the drive is read.**
