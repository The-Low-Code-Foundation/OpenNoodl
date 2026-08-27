# Next session — Model2, then Logic Builder, then EXP-003 Tier B

**Where the phase stands (2026-08-27, after sixteen sessions).** Session 16 BUILT the
controlled-state slice designed in session 15 —
[EXP-002-CONTROLLED-STATE-TARGET-OUTPUT.md](./EXP-002-CONTROLLED-STATE-TARGET-OUTPUT.md), now
with a **§10 implementation addendum recording what building settled — read §10 before touching
any state-row code.** The five state rows are live in `packages/nodegx-export`:

- **useState rows** (`StateVarPlan`, registered lazily, printed only when referenced),
  `state-get` reads, `state-set` writes with `op` functional updates, sync effects (the §1
  coercion table per control), push effects (lifted value outputs). The **chain-local snapshot
  rule** applies at attachment per handler owner; a stateful control's own Changed chain seeds
  the user-path event value.
- **Shapes landed:** Switch + Counter latches (4a); `visible`/`mounted` truthiness sinks with
  the shared `hiddenKeepSpace` class and the conditional-render wrapper (4b); controlled
  checkbox/range/select/textinput (4c — **RBG deliberately stayed deferred**, §10); lifted
  value outputs child+parent (4d — parent side is a second planning phase over child plans);
  For Each `itemsExpr` over array-typed props (4e); invoked-JS render sinks materialize as
  state (4f — replaced the old "needs materialized state" defer).
- **Fixture:** Cheer grew `Components/CheerMeter` + Home instance/echo via MCP on the live
  exp002-step5-cheer (snapshot re-copied, `diff -rq` clean). **287 tests** (26 new in
  `controlled-state.test.ts`, incl. the byte golden); emitted app `tsc -b` + `vite build`
  clean; jsdom drive `drive-meter.mjs` (s14 scratchpad `78102536-…`) proves all 12 probes.
- **Audit (same-instrument):** 86.1% → 86.7% (2,361/2,724, 28 signatures, 40 projects), +26
  nodes, no project regressed. **`Switch` AND `Counter` flipped in the ledger** (gate green);
  every Switch instance translates, Counter lands where Start Value is literal.

**Next, in order (the s12 ranked list, updated):**

1. **Model2 (27 nodes)** — per-record state; the named CO defers point at `Model2.prop-*`
   feeds. Paper design first (the standing discipline): read the runtime `model2.ts` sources
   before guessing anything (the Switch-is-a-latch lesson, 3×).
2. **Logic Builder (14)** — a DETERMINISTIC slice (the program is structured JSON,
   [[a-visual-function-program-can-be-generated-headlessly]]), not EXP-003.
3. **EXP-003 Tier B** — the Filters family (~80 nodes): per-component rewrites against the
   five state rows (CO §7 materialization first — a translated JS writer turns a Component
   Object property into a state var).

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 287 tests (~5s, from the
package dir `../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a
flake until re-run. The emit/audit recipes (`emit-preview.ts`, `coverage-s16.txt`) are in s16
scratchpad `e93ff81d-…`; `emit-cheer.ts` + `coverage-audit.ts` + `projects.txt` in s15
scratchpad `21dc830c-…`; the packed `nodegx-core-0.1.0.tgz`, `cheer-app` scratch copy and
`drive-*.mjs` (incl. the new `drive-meter.mjs`) in s14 scratchpad `78102536-…` (scratch app
pins `file:../nodegx-core-0.1.0.tgz`; current while `git log -1 -- packages/nodegx-core/src`
predates the 08-07 pack date). ts-morph/Prettier stay uninstalled; goldens protect the later
AST refactor; package not in root `test:packages`.
⚠️ jsdom drive: React only AFTER the jsdom globals; Home needs the `rr-shim.mjs` alias AND a
MemoryRouter wrapper. ⚠️ `src/analyze/appState.ts` has literal NULs — `grep -a`; never type a
NUL escape into Edit/Write args. ⚠️ "disabled" appears in tokens.css comments — sweeps
restrict to `.tsx`. ⚠️ The ledger is `ensure_ascii=True` JSON (indent 2). ⚠️ Mood wires
`readVisitor-2.value` into three sinks — legitimate, don't dedupe. ⚠️ A peer's FB-026 edits
live uncommitted in `packages/noodl-runtime/src/node.ts` +
`packages/noodl-viewer-react/src/{nodes,components}/controls/TextInput*`/`text-input.ts`/
`textInputValue.ts` — never sweep them into an export commit. ⚠️ ts-node recipe for scripts:
`TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","esModuleInterop":
true}' ../../node_modules/.bin/ts-node --transpile-only --skipProject <script>`; zsh splits
`$(cat projects.txt)` wrong — use `"${(@f)$(cat …)}"`. ⚠️ The audit's aggregate depends on the
signature dedupe — compare runs with the SAME script over the SAME list (s16's is the
current instrument), never against a remembered number.
