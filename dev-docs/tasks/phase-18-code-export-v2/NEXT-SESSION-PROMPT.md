# Next session — session 96 (2026-09-06) built §74, the literal-under-a-wire family row five registers named: measured in the runtime first, ONE register sentence turned out to be TWO rows — a Do-Set (Set Variable / Global Store Set / Set Object Properties) holds the wire's last defined delivery else the typed-in value ⇒ `expr ?? typed` where the wire's source may read `undefined`, a NOTE where it always carries one (mood-desk's four sit under constants and are never written in the runtime either); a `Variable`'s seed under the one translated wire is dead in the runtime too (the text input fires `onTextChanged` AT MOUNT) ⇒ §67's refusal stands. Picker 117/127 (92.1%) unchanged. Next = the pre-existing TS2322 §74 found (an `unknown` Variable into a required-string Global Store key), then §69.4 #1's cascade sentence in EXP-004's report, then §71.5's ruling for Richard

## 🔴 Read this first — Richard, 2026-09-02: *"Stop fucking up the CPU."*

One heavy job at a time on this 16 GB box. Session 96 ran single-spec jest (one runtime corpus file, 4 export files) for the rows and
the thirteen arms, then ONE whole-package run, the editor tsc, the ledger + picker checks and `test:ci` strictly one after another behind
a load gate (`gates96.sh`, s96 scratchpad `47ba0b96-…`, s95's shape). Load 26 at 11:16 was MY OWN whole-package jest (7 workers, the
same as s95's) + Docker + Firefox — `ps -Ao pid,ppid,%cpu,command | sort -k3 -nr` before waiting on it. Memory: `do-not-pile-cpu-work-on-a-shared-box`.

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Published `0.1.0` (4 `0.1.1` rows carried) |
| EXP-002 / 003 / 005 / 006 / 007 | unchanged |
| EXP-004 | 🟡 built + driven; drill-down panel + the comprehension test remain (Richard's); §69.4 #1 (the cascade sentence on the node in front) — job 2 |
| EXP-008 | ✅ `export-ledger:check` OK — 176 types, 124 translated |
| EXP-009 backend connection | 🟢 |
| EXP-010 | 🟢 Route B built + driven s34 |
| EXP-011 picker coverage | 🟡 **117/127 (92.1%)** — every scheduled tier built and driven; **§74 built this session**; §67.5 #1, §68.5 #1, §69.5 #1, §70.5 #1 CLOSED, §71.5 #1 reworded; the 10 left are §50 out-of-scope RULINGS |
| EXP-012 | 🟢 built + driven s67 |
| EXP-013 "Not exportable yet" | 🟢 — no scheduled row remains |

## What session 96 did (§74 — RE-MEASURED first; the register's one sentence was two rows)

1. **The runtime, measured** (`packages/noodl-runtime/test/corpus/exp-011-s96-a-literal-under-a-wire.test.ts`, 11 rows, readout in the s96
   scratchpad's `runtime.log`): `nodescope.ts` queues the typed-in parameter at creation; `connectInput` queues the wire's CURRENT value over
   it only when defined; every delivery lands over it. Set Variable / Global Store Set / Set Object Properties under a wire from a `Variable`
   nothing wrote: Do ⇒ `"typed"`, source written ⇒ `"wired"`, source back to `undefined` ⇒ still `"wired"` (sticky — registered); under a
   `String` constant: `"const"` from the first Do, the typed-in value never written. `Variable`/`Object` creation-time writes: `["seed","wired"]`
   under an unwritten source, `["const"]` under a constant.
2. **The build** — `plan.ts` `typedInUnderWire` (one helper, the three Set sites) on `maybeUndefinedExpr` ⇒ `fallback?` on `store-set` /
   `globalstore-set` / an `object-set` entry; `component.ts` `withFallback` prints `(code) ?? typed` (parens unless `SIMPLE_REF`);
   `appState.ts` `sourceMayBeUndefined` + `liveSources` (the literal under a wire types the variable/key only while the wire may deliver
   nothing; default = WIDEN). Never-undefined source ⇒ a note: *its typed-in Value 7 is never written — the wire from nameInput:onTextChanged
   always carries a value, so every Do writes the wire's value, in the runtime and here*.
3. **The `Variable` half is NOT this row**: the one wire into a Variable's Value the export translates (a text input's `onTextChanged`) fires
   at mount (`TextInput.tsx` `componentDidMount` → `setText(startValue)`; code-read, the corpus harness cannot host a React control) ⇒ the
   seed is dead in the runtime too; §67's refusal stands (D1). An Object's own `prop-*` under a wire stays with §47's whole-node refusal.
4. Spec `tests/literal-under-a-wire.test.ts` 15 rows (3 typecheck the built app), **13/13 arms** (`mut.py`, md5-restored); pins moved:
   object-store E3/F3/F8, global-store H4, small-utilities §C (mood-desk "no notes" → exactly four `is never written`).
5. 🔴 **Found by the probe, controlled on the same tree by dropping the literal**: an `unknown` Variable (nothing writes it) wired into a
   Global Store Set whose key the initial state types `string` emits `mood.set({ theme: ghost.get() })` ⇒ **TS2322 in the built app**,
   with or without the fallback. Pre-existing (§72 coerced the record-Id sink, never this one). §74.5 #1 — job 1.
6. Docs: EXP-011 §74 (six findings), five register rows, PROGRESS row, this file; memory `phase-18-code-export-v2`.

## The gate chain — READ on this tree

**whole pkg jest 80 files (80 on disk) 3012/3012 exit 0** (11:15–11:17) · **editor tsc exit 0, empty log** (11:19) · **`export-ledger:check` OK — 176 types, 124 translated** · **picker 117/127 exit 0** · **editor `test:ci` 2943 specs, 4 failures = the floor BY NAME** (AIX-006 ×4; seed 53136; `test-results.json` fresh 11:21, 3112 bytes; `.webpack-cache` cleared first; exit 1 as always on the floor; HEAD `d43dcbe0`). No drive: the emitted text is §69's handler with a `??`, and A1/A3/B1/B3 typecheck the emitted app.

## Uncommitted at hand-off

Nothing of session 96's after its commits. `EXP-001-NODEGX-CORE.md` still carries a PEER's edit, untouched. `packages/noodl-runtime/test/backends/realtime-transports.test.ts` (M) and `packages/noodl-runtime/test/nodelibraryexport.wire-declared-ports.test.ts` (??) are a PEER's, untouched. `library/**`, `packages/noodl-core-ui/**`, `packages/noodl-editor/**`, `packages/noodl-mcp/**`, `packages/noodl-runtime/src/**` modifications are peers' (P78/P81/P82/P77), untouched.

## 🔴 Do this next (BUILD)

1. **§74.5 #1 — the `unknown`-into-a-typed-store-key sink.** `mood.set({ theme: ghost.get() })` where `theme: string` is TS2322 in the built app
   (the probe `probe74c.ts` in the s96 scratchpad reproduces it: cheer + a `Variable` `ghost` wired into `setStormy`, the literal dropped).
   §72's treatment one sink over: where the key's `tsType` is `string` and the expr is an `unknown` read, print `String(x ?? '')` (or refuse by
   name — pick the one §72 picked for the record Id: `coerceId` printed `String(x.get() ?? '')`). Check the `object-set` twin (an Object key
   is never `required`, so it types `unknown` and probably survives — MEASURE) and the `store-set` twin (a variable is `value<unknown>` ⇒ fine).
   Both files if the type moves; likely `plan.ts` only (the coercion is a print). One session.
2. **§69.4 #1 — the cascade sentence lands on the node IN FRONT of the refused sink** (seen §69.0, §70.0, §73's F4). EXP-004's report is where
   a person reads *Save profile — nothing is wired into value*. The fix is in the registration pass (§64.4 #3 named the mechanism): *fires
   <sink>, which is refused: <sentence>*. Every `dropped:` note pin moves — the whole-package run is the sweep.
3. **§71.5 — the editor cannot author a `Model2` `prop-*` value** (the panel hides `allowConnectionsOnly` ports; the MCP accepts them with an
   info notice; the editor's `connection-only-parameter` "discarded" sentence is FALSE for this node). A product-surface ruling for Richard.
4. §73.5's three small rows, §74.5's residuals (the sticky last value; an unclassified always-defined source widens), EXP-004's two Richard
   items, the residual registers (§57.5–§74.5).

🔴 **A register's ONE sentence can be TWO rows — measure the runtime AND read the translated source's mount path before believing a
hand-off's named fix** (s96: "seed PLUS wire" was right for a Do-Set, wrong for a Variable). 🔴 **The typing rule and the write rule live in
two files** — `appState.ts` (discovery) and `plan.ts` (compile); arm BOTH (six sessions). 🔴 **A control that VARIES EXACTLY YOUR CHANGE on the
same tree beats a reverted worktree when the old behaviour is proven by pins** (the literal was ignored ⇒ drop the literal = the reverted output).
🔴 **`not.toContain('??')` on a whole page pins the PAGE (its reads print `?? ''`) — pin the handler.** 🔴 **A Subscribe read prints
`mood.get().note` in a handler and `note` in render.** 🔴 **`??` beside `&&`/`||` unparenthesised is a SyntaxError — `withFallback` parenthesises;
`mood.get().theme` is not `SIMPLE_REF`.** 🔴 **A whole-package run is the pin sweep a grep cannot do.** 🔴 **`ts-node` here needs
`-O '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"resolveJsonModule":true}'`.** 🔴 **`grep -a`. Absolute paths.
`rm` one file per command in zsh.** 🔴 **`echo ======` is `=cmd` expansion in zsh — quote it.**

## Open residuals (registered, none blocks an AC; owner NONE unless said)

- §74.5: the `unknown`→required-string Global Store key TS2322 (→ job 1); the sticky last value (runtime keeps the wire's last value after
  its source goes back to `undefined`; `expr ?? typed` falls back); an unclassified always-defined source widens the type; a `Variable`'s Value
  under an UNTRANSLATED wire (opens with pass 3).
- §73.5: Boolean under a wire; `date`; object/array with a non-string value.
- §70.5: `merge: true` with a typed-in object; a refused Set's literal still types the key (H9); the cascade sentence (→ job 2).
- §71.5: an Object's own `prop-*` under a wire (opens with a write through the Object node); the hidden port + the FALSE "discarded"
  sentence (→ job 3); a refused Object's other literal still types + prints "Seeded with".
- §72.5: a `number`-typed record column bound bare into a record Id (same TS2345); a Logic-Builder-minted variable is `unknown` until
  EXP-003 translates the write.
- §66.5#1.5: the `enabled` store is `unknown` under §72; sse/ws applied-vs-raw comparison equivalent today; `hasOwnProperty` redundant
  in `has()`; the runtime instrument lives in `test/corpus/`.
- §69.4 #1 (→ job 2).

## Instruments

s96 scratchpad `47ba0b96-56bb-4111-9747-1efc7a421b7f`: `snap/` (pre-edit copies with md5), `mut.py` + `mut-summary.txt` (13 arms),
`probe74.ts` / `probe74b.ts` / `probe74c.ts` (the emitted-text probes; `probe74c.ts` = the TS2322 control), `runtime.log` (the corpus
readout), `whole.log`/`whole.exit`, `gates96.sh` + `editor-tsc.*` / `ledger.*` / `picker.*` / `testci.*`. s94's four drives and
`final-gates.sh` are unchanged and still the drive templates.

## Standing practice

`cline-dev`; commit by exact pathspecs; `git add` untracked first; reconcile the suite count against disk (80 spec files now); `grep -a`;
absolute paths; **`pgrep -f jest-worker` before any suite, never more than one of mine, wait for a peer's suite, tear servers down the
moment the drive is read.**
