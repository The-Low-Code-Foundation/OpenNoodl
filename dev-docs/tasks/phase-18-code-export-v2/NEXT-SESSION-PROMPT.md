# Next session — EXP-002 after session 12 (Component Object): EXP-003 or the controlled-state slice

**Where the phase stands (2026-08-27, after twelve sessions).** Sessions 1–7 built EXP-002
through steps 1–6 plus named stores, collections, and the expression family; session 8 measured
(66%, EXP-008 ledger + CI gate); session 9 the eight visual generators (82%); session 10
Component Outputs (83%); session 11 popups (86%). **Session 12 (`f6ef7175`) built the
Component Object slice — the record compiles away — and the re-run audit reads 86%
(2,332/2,709 across 28 distinct graphs).** The design was settled on paper first in
[EXP-002-COMPONENT-OBJECT-TARGET-OUTPUT.md](./EXP-002-COMPONENT-OBJECT-TARGET-OUTPUT.md) —
read it before touching Component Object, `undefined`-expression, or record-aliasing code.
What landed, all committed:

- **The runtime shape decided everything** (componentobject.ts, read first — the prompt's
  "lifted-state-shaped" guess was wrong): `value-X` inputs have no trigger, so every
  statically-visible write is a *continuous mirror* into the per-instance record
  (`componentState<instanceId>`), and no corpus graph consumes any of its signals. So the
  deterministic slice materializes **no state**: reads through `resolveExpr` alias a
  single-writer property to its writer's source; an unwritten property is the new
  `{ kind: 'undefined' }` ValueExpr — maybe-undefined by definition, folded at each sink the
  way the runtime folds an undefined delivery (format part → `''`, truthiness → false,
  logical operand → falsy fold, children/`attr:` → empty/omitted, `enabled` → bare
  `disabled`). Boot-value reads are noted at plan time, never silent.
- **Gates** (any hit defers the node, reason named): two CO nodes in one component; a
  same-component `SetComponentObjectProperties`; a descendant (instances + For Each templates,
  transitively) hosting `ParentComponentObject`/`SetParentComponentObjectProperties` — the
  componentwalk is unbounded upward; `runOnChange-object` authored false (absent = ticked —
  check `!== false`); wired `fetch`; any consumed `changed`/`changed-*`/`fetched`/`done`/
  `completed`; per-read: dotted keys (model.ts `resolve:true` path-resolves), two writers,
  boolean-kind writers, cycles.
- **Verdict is strict-mixed** (the Component Outputs precedent): collapsed only when *every*
  `value-*` read lands (pass 4d render binds restricted to the emit vocabulary —
  `children`/`attr:`/`attr-not:disabled` — or a handler chain whose sink collapsed);
  otherwise deferred with the first unlanded read's reason, translated reads keeping their
  behaviour. Dead mirror writes elide with a note. Per Filters clone: Text Search + Date
  Filter collapse (2 of 9); the rest defer with **named reasons** ("its value-FilterItems
  feeds For Each.items, which has no static binding", "feeds Component Outputs, which is
  itself deferred") that point directly at the next slices.
- Fixture: Cheer grew `Components/GreetingCard` (Name → `value-DisplayName` → Text; Draft
  unwritten → `startValue`, emitted `defaultValue` honestly omitted) + a Home instance
  (`Name="Ada"`). **217 tests** (20 new in `tests/component-object.test.ts`, incl. the
  byte-for-byte GreetingCard golden); the eight "only note is the router shell" assertions
  now expect the GreetingCard boot-value note too. Ledger `net.noodl.ComponentObject` →
  translated same commit (gate green, 45). Emitted app `tsc -b` + `vite build` clean; jsdom
  drive `drive-card.mjs` (session 12 scratchpad `e605feba-…`) proves Ada renders through the
  compiled-away record and the draft input is empty with no defaultValue.

**Next, in corpus-impact order** (audit `coverage-s12.txt`, session 12 scratchpad; 377
deferred nodes remain across the 28 distinct graphs):

1. **EXP-003 territory remains the #1 gap by far** — `JavaScriptFunction` 68 + `Javascript2`
   11 + `Expression` 10, plus most of the 34 deferred Component Outputs as collateral, plus
   the JS-written Component Object properties (§7 of the CO target doc records the upgrade:
   when a JS writer translates, the property materializes as `useState` and the aliases become
   state reads). Wants its own paper design (trace harness, verification gate) per the phase
   README.
2. **The controlled-state slice** — now the top *deterministic* gap and freshly mapped by the
   named CO deferrals: wired `checked`/`value` on controls (range 9 + checkbox 6 + button 15
   partly), Radio Button Group `value`, `For Each.items` from state/records, Switch-as-latch
   (5), `runOnChange` → `effect()`, value outputs as lifted state (COMPONENT-OUTPUTS §6), the
   popup close dispatch arrow (POPUPS §7). One state vocabulary, then slices; the CO alias is
   its degenerate case, designed to compose (§7).
3. **Model2 (27; id provenance)** — unchanged from COLLECTIONS-TARGET §5: the lone
   `NewModel.id → modifyId` wire is the first, degenerate case.
4. **Logic Builder (14)** — deterministic slice (structured JSON program, generable headlessly,
   P73), not EXP-003. `Static Data` (14), `Counter` (7), `String` variables (6), remaining
   `Condition`/`RouterNavigate` (6 each) follow.
5. Small emit-vocabulary gap the CO sweep exposed: **style params (margins) have no binding
   role** — a wire into `Group.marginLeft` is invisible to the emitter (pre-existing; pass 4c
   already silently under-delivers there). Worth folding into the controlled-state design as
   inline-style bindings rather than fixing alone.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. **Flip ledger entries in
the SAME commit as a slice** (gate green at 45). 217 tests (~6s, from the package dir
`../../node_modules/.bin/jest`). Fixtures are snapshots — re-copy from the live Cheer project
after MCP edits (`diff -rq`; registry at `components/_registry.json`). ts-morph/Prettier remain
uninstalled; the goldens protect the later AST refactor. The package is still not in root
`test:packages`. Emit recipe: `emit-cheer.ts` in session 12's scratchpad (`e605feba-…`), run
with `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node",
"esModuleInterop":true}' ../../node_modules/.bin/ts-node --transpile-only --skipProject` —
update its OUT path to the new session's scratchpad; the scratch app pins
`file:../nodegx-core-0.1.0.tgz` (tgz current while `git log -1 -- packages/nodegx-core/src`
predates the pack date, 08-07). Audit recipe: `coverage-audit.ts` + `projects.txt` same place —
⚠️ pass the project list with zsh's `"${(@f)$(cat projects.txt)}"`, plain `$(cat …)` splits
the space-bearing paths; dedupe clones by (translated,total) signature before aggregating.
⚠️ jsdom drive: import React only AFTER installing the jsdom globals; router-importing modules
need the `rr-shim.mjs` alias. ⚠️ `src/analyze/appState.ts` contains literal NUL bytes —
`grep -a`; never type the NUL escape into Edit/Write args (7 hits and counting — write such
lines via python bytes). ⚠️ "disabled" appears in tokens.css token comments — a "no disabled
anywhere" sweep must restrict to `.tsx`. ⚠️ The Mood fixture wires `readVisitor-2.value` into
three sinks — all legitimate, don't "deduplicate". ⚠️ The ledger is `ensure_ascii=True` JSON —
a python rewrite with `ensure_ascii=False` churns every em-dash in the file. ⚠️ A full jest
run can flake suite-level (workers) with 0 failing tests — a lone red run is a flake until
re-run.
