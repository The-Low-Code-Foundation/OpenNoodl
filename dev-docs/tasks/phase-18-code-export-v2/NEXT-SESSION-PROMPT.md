# Next session — EXP-002 after session 8 (the audit and the gate): work the ranked gap list

**Where the phase stands (2026-08-27, after eight sessions).** Sessions 1–7 built EXP-002 through
steps 1–6 plus named stores, collections, and the expression family (And/Or/Inverter, Condition
value outputs, `enabled` → `disabled`). **Session 8 measured instead of building**: the planner ran
over the real project corpus on this machine — 29 distinct graphs, 2,826 nodes — and **66% of
nodes translate today** (Puppy test 3 83%, ecommerce example 93%, Cheer 100%, icon/columns-heavy
UIs 43%). The full method, numbers and ranked gap list live in
[EXP-008-EXPORT-COVERAGE-LEDGER.md](./EXP-008-EXPORT-COVERAGE-LEDGER.md) — read it first; the
audit script is `coverage-audit.ts` in session 8's scratchpad
(`/private/tmp/claude-501/-Users-richardosborne-vscode-projects-OpenNoodl/2f7493be-477b-464e-8927-49f40b596c70/scratchpad/`).

Session 8 also landed, all committed:

- **The `__cloud__` walk fix**: `parseProject` now skips `components/__cloud__/` (cloud functions
  are the backend interpreter's), records them on `ProjectIR.cloudComponents`, and `emitApp`
  surfaces one note. `tests/cloud-components.test.ts`. Before this, cloud components parsed as
  browser components.
- **EXP-008, the coverage ledger + contributor gate**: every catalog type classified in
  `packages/nodegx-export/coverage-ledger.json` (28 translated · 1 stubbed · 15 backend-only ·
  131 deferred-with-exemption); `npm run export-ledger:check` in the PR `node-catalog` job fails
  on any unclassified type. **Standing duty: when a slice lands, flip its ledger entries to
  `translated` in the same commit** — the check trusts the ledger's word, so a stale ledger is a
  lie the gate cannot catch.
- **Scope rulings recorded** (EXP-008 doc): backend export is deployment (Node + `node:sqlite`
  service + bundled interpreter), never codegen this phase; Parse is retired — backends are
  `nodegx` (inbuilt) or `external` (Directus-style APIs); kit nodes defer visibly and are outside
  the gate. The announcement this phase supports: *"your frontend becomes a real React codebase;
  your backend is a self-hostable Node + SQLite service."*

**Next, in corpus-impact order** (deferred-node counts in EXP-008 §audit):

1. **The missing visual generators** — `net.noodl.visual.columns`, `net.noodl.visual.icon`,
   `net.noodl.controls.range`, `net.noodl.controls.checkbox` (+ `Options`, `Radio Button`,
   `Video`, `Circle` while there). Mechanical, same shape as the existing renderRole cases;
   kills the biggest collateral (a subtree under an unsupported visual defers wholesale as
   "logic node (Text)" etc.). ⚠️ Radio inputs: a radio `name` is document-global — scope per
   component instance.
2. **Component Outputs** — the other half of the component interface; 69 direct + ~60 deferred
   instances downstream. Design question: outputs as callback props vs a returned handle —
   decide on paper in the target doc first, like every slice so far.
3. **Model2 (id provenance)** — unchanged from the collections slice
   (COLLECTIONS-TARGET §5): the lone `NewModel.id → modifyId` wire is the first, degenerate
   case; a literal-id Model2 read and a same-handler NewModel id are the next two.
4. **Popups** (`NavigationShowPopup`/`ClosePopup`) — needs its paper design (modal state beside
   the Switch/`useState` slice).
5. **RouterNavigate from logic-signal triggers** (32 deferred) and the smaller recorded holes:
   boolean exprs into value sinks via `!!(…)`, `else`/multi-action arms fixture-unexercised,
   nested Conditions, `String`/`Color` variable nodes, `Static Data` (never translated —
   session 8 confirmed no handling exists despite step-4 folklore), Counter.
6. **Logic Builder (Visual Function)** — deterministic slice, not EXP-003: the program is
   structured JSON, generable headlessly (P73). 14 deferred in corpus and growing as VF becomes
   the recommended way to compute.
7. **The two state-shaped slices** on paper first: Switch as component state (`useState` + three
   setters + the Switched signals question) and on-change firing (`runOnChange` ticked with
   wired arms) as the `effect()` row.
8. **EXP-003** then takes what only it can: `JavaScriptFunction`, `Javascript2`, `Expression`.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 134 tests (~2s, from the
package dir `../../node_modules/.bin/jest`). Fixtures are snapshots — re-copy from the live
Cheer project after MCP edits (`diff -rq`; registry at `components/_registry.json`). ts-morph/
Prettier remain uninstalled; the goldens protect the later AST refactor. The package is still
not in root `test:packages`. Emit recipe: `emit-cheer.ts` in the scratchpad, run with
`TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","esModuleInterop":true}'
../../node_modules/.bin/ts-node --transpile-only --skipProject` (it restores the scratch
`file:` core pin after writing — update its OUT path to the new session's scratchpad; core tgz
current while `git log -1 -- packages/nodegx-core/src` predates the pack date, 08-07). ⚠️ jsdom
drive trap: import React only AFTER installing the jsdom globals (recipes in
`cheer-app/drive-*.mjs`). ⚠️ `src/analyze/appState.ts` contains literal NUL bytes — `grep -a`;
never type `\u0000` into Edit/Write args (5 hits and counting — write such lines via python
bytes). ⚠️ "disabled" appears in tokens.css token comments — a "no disabled anywhere" sweep must
restrict to `.tsx`. ⚠️ The Mood fixture wires `readVisitor-2.value` into three sinks — all
legitimate, don't "deduplicate".
