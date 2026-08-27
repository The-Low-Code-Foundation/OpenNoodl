# Next session — EXP-002 after session 10 (Component Outputs): popups are the top non-JS gap

**Where the phase stands (2026-08-27, after ten sessions).** Sessions 1–7 built EXP-002 through
steps 1–6 plus named stores, collections, and the expression family; session 8 measured (66%,
EXP-008 ledger + CI gate); session 9 built the eight visual generators (82%). **Session 10
built Component Outputs — signal outputs become optional callback props — and the re-run audit
reads 83% (2,248/2,695 across 28 distinct graphs).** The design was settled on paper first in
[EXP-002-COMPONENT-OUTPUTS-TARGET-OUTPUT.md](./EXP-002-COMPONENT-OUTPUTS-TARGET-OUTPUT.md) —
read it before touching component interfaces. What landed, all committed:

- **Child side**: a declared signal output port becomes `onWaved?: () => void` in the props
  interface (after input props); the wire feeding it compiles to the action `output-signal`
  (`onWaved?.()`) attached by the same machinery every action uses — a rendered element's
  event, a receiver's `useSignal`, or a Condition arm. `componentOutputInterface()` in plan.ts
  is the one deterministic name source: `on` + PascalCase(port), an existing `onX` identifier
  kept verbatim, collisions **fail the port** (never silently rename).
- **Parent side**: a wire from a rendered instance's declared signal output into a translatable
  trigger port lands in `plan.handlers[instanceId][port]` — parse reports instance-output wires
  as kind `value` (it cannot see across components), so plan consults the target ComponentIR's
  interface. Emit passes `<FarewellCard onWaved={() => navigate('/mood')} />`; prop names come
  off the target's `plan.outputProps`.
- **Rulings**: value outputs defer named (lifted state — the component-state slice; the corpus
  has ZERO statically-translatable value feeds); a For Each relaying its rows' outputs defers
  named (which row fired is not expressible); a wire into an undeclared port drops alone (the
  runtime's `hasOutput` guard drops it too — the node stays translated); a **mixed** outputs
  node counts `deferred` (first failure's reason) while its good ports keep firing — the audit
  under-claims rather than lies. Signal *input* props stay declared-and-unused (zero internal
  consumers in the corpus).
- Fixture: Cheer grew `Components/FarewellCard` (button → `waved` output) + a Home instance
  wired to RouterNavigate — MCP-authored on the live `exp002-step5-cheer`, snapshot re-copied.
  176 tests (17 new, incl. byte-for-byte FarewellCard golden + naming/shape/mixed-rule tests in
  `tests/component-outputs.test.ts`); ledger flipped `Component Outputs` → translated same
  commit (gate green, 42). Emitted app `tsc -b` + `vite build` clean; jsdom drive proves click
  Wave → child callback → parent arrow → Mood renders (`drive-wave.mjs`, session 10 scratchpad
  `c982534a-…`). ⚠️ New drive trap: react-router-dom is CJS and vite's SSR runner sees NONE of
  its named exports — `ssrLoadModule` of any file importing it needs the `rr-shim.mjs` alias
  recipe (an ESM shim re-exporting from a `createRequire` of the same module instance;
  `ssr.noExternal` does NOT work, the CJS body then breaks under the ESM evaluator).

**Next, in corpus-impact order** (audit re-run `coverage-s10.txt`, session 10 scratchpad):

1. **Popups** — now the #1 non-JS gap: `NavigationShowPopup` (~135 deferred nodes incl.
   collateral) + `NavigationClosePopup`. Paper design FIRST in a target doc: modal state is
   parent `useState` (the show wire's handler sets it), the popup component renders
   conditionally; `ClosePopup.done → Component Outputs` chains exist in the corpus (the
   NoticeDialog shape). Session 10's instance-callback rail is exactly what the close side
   rides. Design beside the Switch/`useState` slice — one state vocabulary, two consumers.
2. **Model2 (id provenance)** — 27; unchanged from COLLECTIONS-TARGET §5: the lone
   `NewModel.id → modifyId` wire is the first, degenerate case.
3. **RouterNavigate from logic-signal triggers** (23) and `net.noodl.ComponentObject` (28).
4. **The controlled-state slice**: wire-fed `checked`/`value` on controls + Switch-as-state
   (`useState` + three setters) + on-change firing (`runOnChange` → `effect()` row) + **value
   outputs as lifted state** (COMPONENT-OUTPUTS §6 recorded the shape: `onXChanged(value)` +
   parent `useState`) — these are one state-vocabulary design, then slices.
5. **Logic Builder** (14) — deterministic slice (program is structured JSON, generable
   headlessly, P73), not EXP-003. `Static Data` (14), `Counter` (7), `String`/`Color`
   variables, nested Conditions, boolean-exprs-into-value-sinks via `!!(…)` remain recorded.
6. **EXP-003** then takes `JavaScriptFunction` (~169 deferred incl. collateral), `Javascript2`,
   `Expression`.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. **Flip ledger entries in
the SAME commit as a slice** (gate green at 42). 176 tests (~3s, from the package dir
`../../node_modules/.bin/jest`). Fixtures are snapshots — re-copy from the live Cheer project
after MCP edits (`diff -rq`; registry at `components/_registry.json`). ts-morph/Prettier remain
uninstalled; the goldens protect the later AST refactor. The package is still not in root
`test:packages`. Emit recipe: `emit-cheer.ts` in session 10's scratchpad (`c982534a-…`), run
with `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node",
"esModuleInterop":true}' ../../node_modules/.bin/ts-node --transpile-only --skipProject` —
update its OUT path to the new session's scratchpad; the scratch app pins
`file:../nodegx-core-0.1.0.tgz` (tgz current while `git log -1 -- packages/nodegx-core/src`
predates the pack date, 08-07; the emit script restores the pin). Audit recipe:
`coverage-audit.ts` + `projects.txt` same place — ⚠️ pass the project list with zsh's
`"${(@f)$(cat projects.txt)}"`, plain `$(cat …)` splits the space-bearing paths. ⚠️ jsdom
drive: import React only AFTER installing the jsdom globals; router-importing modules need the
`rr-shim.mjs` alias (above). ⚠️ `src/analyze/appState.ts` contains literal NUL bytes —
`grep -a`; never type the NUL escape into Edit/Write args (7 hits and counting — write such
lines via python bytes). ⚠️ "disabled" appears in tokens.css token comments — a "no disabled
anywhere" sweep must restrict to `.tsx`. ⚠️ The Mood fixture wires `readVisitor-2.value` into
three sinks — all legitimate, don't "deduplicate". ⚠️ The ledger is `ensure_ascii=True` JSON —
a python rewrite with `ensure_ascii=False` churns every em-dash in the file.
