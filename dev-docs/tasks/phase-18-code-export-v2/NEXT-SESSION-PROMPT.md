# Next session — session 95 (2026-09-06) built §73, the one-liners four registers left: the `Set Variable` Set as table measured enum by enum (Empty string writes `''`, Boolean `!!value` — nothing typed is `false`, Number/Date/Any UNTOUCHED where the gate had refused them, Object/Array refused), a listed payload key nothing wires is `unknown`, the naming-node pin by type; the ledger's `§` was ALREADY normalised (closed by measurement). Picker 117/127 (92.1%) unchanged. Next = the literal-under-a-wire family row (named by FOUR registers), then §69.4 #1's cascade sentence in EXP-004's report, then §71.5's ruling for Richard

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 95 ran single-spec jest (3 files, 10 s) for the rows and the ten arms, ONE
whole-package run, then the editor tsc and `test:ci` strictly one after another behind a load gate (`gates.sh`, s95 scratchpad
`a7351a26-…`, the same shape as s94's `final-gates.sh`). Load 19.9 at 10:29 was Docker + a VM (Richard's), not a peer's suite —
`ps -Ao pid,ppid,%cpu,command | sort -k3 -nr` before waiting on it. Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (4 `0.1.1` rows carried) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's); §69.4 #1 (the cascade sentence on the node in front) — the next-but-one job |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 124 translated; the `Set Variable` and `Event Receiver` notes name §73 |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 Route B built + driven s34 |
| EXP-011 picker coverage | 🟡 **117/127 (92.1%)** — every scheduled tier built and driven; **§73 built this session**; §69.5 #3, §70.4 #1, §70.4 #2, §72.5 #1 CLOSED; the 10 left are §50 out-of-scope RULINGS |
| EXP-012 | 🟢 built + driven s67 |
| EXP-013 "Not exportable yet" | 🟢 — no scheduled row remains |

## What session 95 did (§73 — RE-MEASURED first; two of the four registers were not what they said)

1. **§69.5 #3 `setWith` — UNDERSTATED.** The register said *every non-string coercion is refused by name*. The runtime's table
   (`setvariablenode.ts` `scheduleStore`): `emptyString` ⇒ `''` and Value never read; `boolean` ⇒ `!!value`; `object`/`array` ⇒ a
   string is an id looked up in `Model`/`Collection`; **`string`, `number`, `date`, `*` (the default) convert NOTHING** — the enum only
   names the port's type. The gate refused four no-ops, and a refused Set drops the button in front (§69.0's cascade). Now: the table
   is the gate in `plan.ts`; the typing mirror in `appState.ts` (`''` registered with or without a wire, the wire under Empty string
   NOT a source, `Boolean(typed)` when unwired); Boolean with nothing typed in writes `false` on every Do (F9). Corpus: the only
   `setWith` in 39 fixtures is cheer's `string` ⇒ the rows are profile-desk mutations (F5 rewritten, F9–F13) + three in stores-events.
2. **§72.5 #1 `typeOfPayloadKey`** — measured in `noodl-viewer-react/…/eventsender.ts`: a listed key nothing wires never enters
   `inputValues`; the Receiver reads `undefined`. `sources.length > 0 &&` added (§47's rule a fourth time). Row: drop the
   `cheerSend:message` wire ⇒ `message?: unknown;`.
3. **§70.4 #1** — `global-store.test.ts` filters `Pages/Mood` by `isGlobalStoreFamily` and asserts the six ids.
4. **§70.4 #2 — ALREADY CLOSED**: 0 non-ASCII characters in `coverage-ledger.json`; `git log -- coverage-ledger.json` names
   `1f0e11a9` (lane vartype's `json.dump`). One commit stale. No change.
5. Arms 10/10 (`mut.py`, value-level mutants, restored by md5); docs: EXP-011 §73, four register rows ticked, PROGRESS row, two ledger notes
   (in the file's `§` convention).

## The gate chain — READ on this tree

`gates.sh` (s95 scratchpad `a7351a26-…`): **whole pkg jest 79 files (79 on disk) 2997/2997 exit 0** (10:26–10:28) · **editor tsc exit 0, empty log** (10:31, sub-minute) · **`export-ledger:check` OK — 176 types, 124 translated** · **picker 117/127 exit 0** · **editor `test:ci` 2943 specs, 5 failures = the floor BY NAME** (AIX-006 ×4 + SB-017 acceptance 6; seed 23215; `test-results.json` fresh 10:33, 3340 bytes; `.webpack-cache` cleared first; exit 1 as always on the floor; HEAD `0b603a23` = a peer's commit mid-session). No drive this session: the emitted text is §69's shape with a different literal, and F5 typechecks the emitted app; the family row's drive (mood-desk) is where these shapes get driven.

## Uncommitted at hand-off

Nothing of session 95's after its commits. `EXP-001-NODEGX-CORE.md` still carries a PEER's edit, untouched. `library/**`,
`packages/noodl-core-ui/**`, `packages/noodl-editor/**`, `packages/noodl-mcp/**`, `packages/noodl-runtime/**` modifications are peers'
(P78/P81/P82/P77), untouched.

## 🔴 Do this next (BUILD)

1. **The literal-under-a-wire family row** — named by §67.5 #1, §68.5 #1, §69.5 #1, §70.5 #1, §71.5 #1. **Measure the runtime FIRST**
   with the s94 instruments' shape (`packages/noodl-runtime/test/corpus/exp-011-s66-5-…test.ts` is the template): for a Set (Variable /
   Object Properties / Global Store) the typed-in value sits in `internal.value` from creation, and a Do BEFORE the wire's first delivery
   writes the literal; for `Variable2`'s Value and `Model2`'s `prop-*` it is a creation-time write the wire later overwrites. The honest
   translation is the seed PLUS the wire (§67's seed shape + the existing wire path). **mood-desk's four Sets are the fixture** (F8 pins
   them shadowed today — that pin MOVES). This is the biggest divergence left inside translated nodes. Both files (`appState.ts` typing:
   the literal AND the wire are sources; `plan.ts` write).
2. **§69.4 #1 — the cascade sentence lands on the node IN FRONT of the refused sink** (seen §69.0, §70.0, §73's F4). EXP-004's report
   is where a person reads *Save profile — nothing is wired into value*. The fix is in the registration pass (§64.4 #3 named the
   mechanism): *fires <sink>, which is refused: <sentence>*. Every `dropped:` note pin moves — the whole-package run is the sweep.
3. **§71.5 — the editor cannot author a `Model2` `prop-*` value** (the panel hides `allowConnectionsOnly` ports; the MCP accepts them
   with an info notice; the editor's `connection-only-parameter` "discarded" sentence is FALSE for this node). A product-surface ruling
   for Richard: show the port, or refuse it in the MCP?
4. §73.5's three small rows (Boolean under a wire; `date`; object/array with a non-string value), EXP-004's two Richard items, the
   residual registers (§57.5–§73.5).

🔴 **The typing rule and the write rule live in two files** — `appState.ts` (discovery) and `plan.ts` (compile); arm BOTH (five sessions).
🔴 **A register can UNDERSTATE by calling a no-op a coercion — read the runtime's TABLE enum by enum.** 🔴 **A register can be one
commit STALE — `git log -- <file>` before inheriting.** 🔴 **The payload/store-key separator is a NUL (`\u0000`) that prints as a
SPACE — `cat -e` before an exact-string edit on such a line.** 🔴 **A string wire cannot arm "the wire is not a source" — vary the
source's TYPE (the self-fed Variable reads `unknown`).** 🔴 **A whole-package run is the pin sweep a grep cannot do.** 🔴 **Byte-
identical output is the strongest pin proof and the weakest evidence of change — the arms are the evidence.** 🔴 **`ts-node` here
needs `-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.** 🔴 **`emit.ts` REMOVES
its output directory — copy `node_modules` in AFTER the emit.** 🔴 **A reverted arm = `git worktree add --detach <scratch> <sha>` +
`ln -s <repo>/node_modules`; remove it after. NEVER a stash.** 🔴 **`grep -a`. Absolute paths. `rm` one file per command in zsh.**

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §73.5: Boolean under a wire (needs a `Boolean(x)` spelling `isBooleanExpr` does not refuse); `date` (a runtime ruling first);
  object/array with a non-string value (untouched in the runtime, refused whole here).
- §70.5: literal under a wire (→ job 1); `merge: true` with a typed-in object; a refused Set's literal still types the key (H9); the
  cascade sentence (→ job 2).
- §71.5: literal under a wire on the same port (→ job 1); the hidden port + the FALSE "discarded" sentence (→ job 3); a refused
  Object's other literal still types + prints "Seeded with".
- §72.5: a `number`-typed record column bound bare into a record Id (same TS2345); a Logic-Builder-minted variable is `unknown` until
  EXP-003 translates the write.
- §66.5#1.5: the `enabled` store is `unknown` under §72; sse/ws applied-vs-raw comparison equivalent today; `hasOwnProperty` redundant
  in `has()`; the runtime instrument lives in `test/corpus/`.
- §69.4 #1 (→ job 2); §67.5 #1 / §68.5 #1 / §69.5 #1 (→ job 1).

## Instruments

s95 scratchpad `a7351a26-a928-4484-aaee-946915a5f7df`: `snap/` (pre-edit) + `post/` (post-edit) copies with md5, `mut.py` +
`mut-summary.txt` (10 arms), `whole.log`/`whole.exit`, `gates.sh` + `editor-tsc.*`/`testci.*`. s94's instruments (the four drives,
`final-gates.sh`, the lane scratch under `../OpenNoodl-worktrees/p18-scratch-s94-*`) are unchanged and still the drive templates.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (79 spec files); `grep -a`;
absolute paths; **`pgrep -f jest-worker` before any suite, never more than one of mine, wait for a peer's suite, tear servers down the
moment the drive is read.**
