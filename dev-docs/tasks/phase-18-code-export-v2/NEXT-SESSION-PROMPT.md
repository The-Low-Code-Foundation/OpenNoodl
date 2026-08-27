# Next session — EXP-003 after session 14 (the re-host slice landed): the controlled-state slice, and the bare-wire defect

**Where the phase stands (2026-08-27, after fourteen sessions).** Session 14 built EXP-003's
pure re-host slice exactly as the paper design ordered (§4/§9), and the corpus reads **87%**
(2,260/2,597, 26 distinct signatures). 261 tests (44 new in `tests/jsfun.test.ts`). Read
[EXP-003-JS-TARGET-OUTPUT.md](./EXP-003-JS-TARGET-OUTPUT.md) **including the new §10
implementation addendum** before touching any JS translation code — §10 records where the
paper met the compiler and the runtime:

- **What landed:** `jsfun-out` ValueExpr + `jsfun-run` HandlerAction + `JsFunctionPlan`
  (plan.ts); the §3 purity gate in `src/analyze/jsfun.ts` (compile + strict recompile with the
  runtime's own constructors and preamble, marker gates each with a named defer, the
  `parsePorts`/`parseAndAddPortsFromScript` clones — kept in sync with the runtime by design);
  pass 4e (A1 render binds, 4d's discipline); A2h as done-chain-only (`compileJsRun` — output
  reads inline the call, pure so recomputation is unobservable); the strict-mixed verdict
  sweep; parse now classifies catalog codeeditor inputs as script (sourceText for
  `functionScript`/`expression`). Emit hoists wrappers above the component: body verbatim
  never reindented, in an arrow IIFE (body-level `return` exits the body) inside try/catch
  mirroring the runtime's catch (Expression answers 0); mined signal outputs seed as no-op
  callables; untyped ports are `any` (strict tsc rejects the corpus's bodies under `unknown`).
- **The session's discovery, load-bearing for everything later: a Function node's ports are
  only real as `in-<name>`/`out-<name>`.** nodescope catches the failed connect on any other
  spelling (`console.error`, wire dead), and the catalog's dynamicPorts text documents it. The
  corpus's MCP-authored graphs (puppy + leg001 formatters) wire bare names — those wires never
  delivered in the interpreted app, and the export now drops each with a registration note.
  **§8's ~15–25 estimate died on this fact**: raw JS nodes translated in the existing corpus =
  the Cheer fixture's two; everything else defers *named* (Filters → Component/Noodl Tier B,
  phase58 → done-into-SetDbModelProperties / Group.visible, Text Search → Text.mounted).
- Ledger: `JavaScriptFunction` + `Expression` → **translated** (same commit as the slice);
  `Javascript2` exemption rewritten to name §1's ruling (hand-written node DSL, P69's twin).
- Fixture: Cheer Home grew `formatShout` (Function, `in-name` ← visitorVar, `out-text` → new
  Text) + `hasLongName` (Expression, `isTrue` → About button's enabled) via MCP on live
  exp002-step5-cheer (properly-prefixed wires!), snapshot re-copied. GOLDEN_HOME regenerated.
  jsdom drive `drive-shout.mjs` (session-14 scratchpad `78102536-…/cheer-app`) proves boot
  `FRIEND!` → typed `BEA!` and the disabled toggle; emitted app `tsc -b` + `vite build` clean.
  ⚠️ Six pre-existing tests had their premises patched (the new gate owns a `disabled` and a
  `useValue` on Home) — see boolean-logic/logic test diffs.

**Next, in order:**

1. **The bare-wire defect is FIX-007's** (phase 66, docs fixed 2026-08-14; the corpus
   graphs predate it — grepping tasks found it already owned). The open sliver:
   `rules/nonexistentPort` skips runtime-discovered types by design, so a bare Function wire
   still passes validation and dies at connect. If it itches, it is a FIX-007 follow-up in
   the validator, not export work — the export's registration notes are the evidence.
2. **The controlled-state slice** — the s12 ranking holds and is now triply motivated: it
   unlocks EXP-003 Tier B (~80 Filters nodes), the run-wired-to-render shape (§3.7 defers
   name it), and the CO §7 upgrade (a translated JS writer materializes the property as
   useState). Named defers to satisfy: wired checked/value, RBG value, For Each items-from-
   state, Switch latch, runOnChange effect(), lifted value outputs, POPUPS §7 dispatch arrow,
   `Text.mounted`/`Group.visible` sinks (the phase58/Text Search JS reads land the moment
   mounted is a sink). Paper design first, as always.
3. Then Model2 (27) → Logic Builder (14, deterministic slice per the s8 ruling).

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 261 tests (~5s, from the
package dir `../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a
flake until re-run. Fixtures are snapshots — re-copy from live Cheer after MCP edits (the
`nodegx` MCP server binds to exp002-step5-cheer already). ts-morph/Prettier remain
uninstalled; goldens protect the later AST refactor; package still not in root
`test:packages`. Emit recipe: `emit-cheer.ts` + `coverage-audit.ts` + `projects.txt` now in
s14 scratchpad `78102536-…` (update OUT); scratch app pins `file:../nodegx-core-0.1.0.tgz`
(current while `git log -1 -- packages/nodegx-core/src` predates the pack date, 08-07).
⚠️ jsdom drive: React only AFTER the jsdom globals; Home needs the `rr-shim.mjs` alias AND a
MemoryRouter wrapper (drive-shout.mjs shows both). ⚠️ `src/analyze/appState.ts` has literal
NULs — `grep -a`; never type a NUL escape into Edit/Write args. ⚠️ "disabled" appears in
tokens.css comments — sweeps restrict to `.tsx`. ⚠️ The ledger is `ensure_ascii=True` JSON.
⚠️ Mood wires `readVisitor-2.value` into three sinks — legitimate, don't dedupe. ⚠️ A peer's
FIX-026 edit lives in `packages/noodl-runtime/src/node.ts` (uncommitted mid-session 14) —
never sweep it into an export commit.
