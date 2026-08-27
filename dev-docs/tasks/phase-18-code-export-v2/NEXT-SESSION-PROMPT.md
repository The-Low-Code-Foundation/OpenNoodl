# Next session — EXP-002 after session 9 (the second visual wave): Component Outputs is the #1 gap

**Where the phase stands (2026-08-27, after nine sessions).** Sessions 1–7 built EXP-002 through
steps 1–6 plus named stores, collections, and the expression family. Session 8 measured (66%,
EXP-008 ledger + CI gate). **Session 9 built the audit's #1 item — the eight missing visual
generators — and the re-run audit reads 82% of nodes translated (2,194/2,689 across 28 distinct
graphs), up from 66%.** Method and per-node decisions are in
[EXP-002-VISUALS-TARGET-OUTPUT.md](./EXP-002-VISUALS-TARGET-OUTPUT.md) — read it before touching
any of the new roles. What landed, all committed:

- **Columns → CSS Grid**: fr tracks from the layout string, `gap` gutters,
  `repeat(auto-fit, minmax())` for Auto Fit, breakpoints as `@container` rules on a
  `container-type: inline-size` wrapper div (the runtime keys off *container* width — NDA-006 §3
  — so container queries, never media queries). Masonry / vertical direction / wired layout
  ports defer with named reasons.
- **Icon**: font glyph span (class or text per `codeAsClass`), sprite `<svg><use>`, image
  `<img>`; inline defers. One note per component per font set: the export does not bundle
  icon-set stylesheets (`noodl_modules`).
- **Checkbox / Radio Button / Radio Button Group**: `appearance: none` native inputs styled to
  the runtime's own default box (effective = authored-else-catalog-default); the mark takes the
  border colour (FB-020's rule), drawn as a `mask` + `background-color` so `var()` colours work;
  radio `name` scoped per component instance via `useId()` (document-global-name trap);
  `useLabel` wraps input inside a `<label>` — no ids anywhere. A radio outside a group defers
  (runtime raises `radio-button/no-group`). Wired `checked`/`value` defer the node.
- **Range** (`accent-color` from thumbColor; thumb/track pseudo-element port family reported
  unhandled), **Dropdown** (literal items → options; placeholder = hidden disabled option;
  wired items defer whole — an empty shell would lie), **Video** (attrs pass through,
  `object-fit` always stated), **Circle** (arc paths computed at generation — runtime math +
  epsilon, ≤4 decimals).
- Plumbing that later slices will reuse: `computeRoleCss` (pseudo-blocks / companion wrapper
  classes / `@container` rules, all part of a class's merge identity), `ROLE_EVENT_ATTRS`
  (`Changed` → DOM `onChange` for control roles), `STRUCTURE_PORTS` + `visualDeferReason`
  (wire-fed structure defers with a named reason), `injectDefault` (controls always draw their
  box), `effectiveLiteral` at emit.
- **Ledger flipped in the same commit** (13 entries → `translated`, gate green at 41).
  Standing duty unchanged: flip ledger entries in the SAME commit as a slice.
- Verified beyond the 159 tests: emitted Showcase app (synthetic component over the Cheer
  fixture) `tsc -b` + `vite build` clean; jsdom drive proves checkbox toggle, radio selection
  within one `useId` group, placeholder select, seeded range, 3 grid items, glyph text. Drive
  recipe: `emit-showcase.ts` + `cheer-app/drive-showcase.mjs` in session 9's scratchpad
  (`3e8948d0-…`); audit re-run: `coverage-audit.ts` + `coverage-s9.txt` same place — ⚠️ pass
  the project list with zsh's `"${(@f)$(cat projects.txt)}"`, plain `$(cat …)` splits the
  space-bearing paths and every arg parses as a broken project.

**Next, in corpus-impact order** (EXP-008 §audit, re-ranked by the session-9 numbers):

1. **Component Outputs** — now the #1 gap: 69 direct + ~60 deferred component instances
   downstream. The other half of the component interface. Design question to settle on paper
   in a target doc FIRST, like every slice: outputs as callback props vs a returned handle.
2. **Popups** (`NavigationShowPopup` 60 + `ClosePopup` 4 + collateral) — paper design first
   (modal state beside the Switch/`useState` slice).
3. **Model2 (id provenance)** — 27; unchanged from COLLECTIONS-TARGET §5: the lone
   `NewModel.id → modifyId` wire is the first, degenerate case.
4. **RouterNavigate from logic-signal triggers** (23) and `net.noodl.ComponentObject` (28).
5. **The controlled-state slice**: wire-fed `checked`/`value` on the new controls (15 nodes)
   belongs with Switch-as-component-state (`useState` + three setters) and on-change firing
   (`runOnChange` → `effect()` row) — two paper-first designs.
6. **Logic Builder** (14) — deterministic slice (program is structured JSON, generable
   headlessly, P73), not EXP-003. `Static Data` (14), `Counter` (7), `String`/`Color`
   variables, nested Conditions, boolean-exprs-into-value-sinks via `!!(…)` remain recorded.
7. **EXP-003** then takes `JavaScriptFunction` (68), `Javascript2` (11), `Expression` (10).

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 159 tests (~3s, from the
package dir `../../node_modules/.bin/jest`). Fixtures are snapshots — re-copy from the live
Cheer project after MCP edits (`diff -rq`; registry at `components/_registry.json`). ts-morph/
Prettier remain uninstalled; the goldens protect the later AST refactor. The package is still
not in root `test:packages`. Emit recipe: `emit-showcase.ts` in session 9's scratchpad, run with
`TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","esModuleInterop":true}'
../../node_modules/.bin/ts-node --transpile-only --skipProject` (it restores the scratch
`file:` core pin after writing — update its OUT path to the new session's scratchpad; core tgz
current while `git log -1 -- packages/nodegx-core/src` predates the pack date, 08-07). ⚠️ jsdom
drive trap: import React only AFTER installing the jsdom globals (recipes in
`cheer-app/drive-*.mjs`). ⚠️ `src/analyze/appState.ts` contains literal NUL bytes — `grep -a`;
never type the NUL escape into Edit/Write args (6 hits and counting — write such lines via
python bytes). ⚠️ "disabled" appears in tokens.css token comments — a "no disabled anywhere"
sweep must restrict to `.tsx`. ⚠️ The Mood fixture wires `readVisitor-2.value` into three
sinks — all legitimate, don't "deduplicate". ⚠️ The ledger is `ensure_ascii=True` JSON — a
python rewrite with `ensure_ascii=False` churns every em-dash in the file (cost one redo).
