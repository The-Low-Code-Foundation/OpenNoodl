# Next session — EXP-002 after step 6 (statically-knowable logic): grow the expression family, then Model2

**Where the phase stands (2026-08-27, after six sessions).** EXP-002 steps 1–6 plus the
named-stores and collections slices are done. This session landed step 6 — String Format and
Condition — and settled the load-bearing design decision on paper first
(`EXP-002-LOGIC-TARGET-OUTPUT.md`, read it before touching anything here): **the `derived()`
row of EXP-001's table is compiled away.** Logic nodes resolve into *expression trees* over the
step-5 source vocabulary and land inline — in render as expressions over the hooks the
component already earns (the hooks ARE the reactivity a Derived would provide), in handlers
over `.get()` snapshots. No `src/derived/` module, no `useDerived`, ever, for single-component
logic (a logic node's wires cannot leave its component, so there is nothing to share).

- **Fixture**: Cheer grew via its MCP server (`mcp__nodegx` binds by `open_project` on
  `~/vscode_projects/NodeGX test projects/exp002-step5-cheer`; snapshot re-copied to
  `packages/nodegx-export/tests/fixtures/cheer`): Home gained `previewFormat` (String Format
  `"Cheering for {name}!"` fed by `visitorVar.value`) → new Text `cheerPreview`; Mood's
  `themeText` was rewired through `themeFormat` (`"Feeling {theme} today"` fed by
  `subTheme.value`), and its themeButton is now guarded — `onClick → hasVisitor.eval`
  (Condition, **`runOnChange-condition: false` authored**), `readVisitor-2.value → condition`,
  `ontrue → setTheme.set`. Validated clean; the render_report's one `dead-placeholder-text` on
  Home is the PRE-EXISTING CheerBanner boot state (event-driven text), not this session's.
- **Architecture added** (`packages/nodegx-export`): `ValueExpr` gained `store-key-get` (a
  single-key Subscribe read in either context) and `format` (alternating text/sub-expression
  parts, recursive); `BindingSource` gained `computed`; `HandlerAction` gained `branch`
  (`if (cond) whenTrue; else whenFalse;`). `resolveExpr` is now recursive with a `ResolveCtx`
  (consumes/logicNodeIds/subscriberIds/visited/defer) applied only when the expression is
  used. Pass 4c plans computed render bindings; `compiledOf` is memoized and `Condition` is a
  trigger relay in `TRIGGER_PORTS` (`eval`); arm wires are skipped by pass 2 and consumed by
  the branch. Emit: `exprCode(expr, 'handler' | 'render')`, block-form multi-line handler
  attrs when a branch is present (element() wraps on embedded newlines).
- **Rules settled** (all in the target doc): literal placeholder params fold into text;
  all-static formats fold to plain text; bare single-placeholder string-typed formats collapse
  to the bare expression; repeated placeholders all fill (the code, not the port description,
  is the authority); **a possibly-undefined source interpolates `?? ''`** — the drive caught
  `Cheering for undefined!`; required store keys (initial-state) interpolate bare. The
  Condition branch translates ONLY with the untick authored (Evaluate is ADDITIVE — the
  `Run`-trap family); truthiness is transcribed as a bare `if`; Condition value outputs
  (`result`/`isfalse`) defer wholesale — no boolean render sink exists yet.
- **Proof**: 112 tests (~1s, from the package dir `../../node_modules/.bin/jest`), including
  the new `tests/logic.test.ts` (20: goldens by reference, fold/collapse/escape/repeat rules,
  handler-context format, all deferral gates) and updated Home/Mood goldens. Re-emitted into
  this session's scratchpad `cheer-app/` (node_modules kept from the 08-27 collections-session
  copy; core tgz still current — core src unchanged since 08-07), `tsc -b` + `vite build`
  clean, four jsdom drives green: `drive-logic.mjs` (preview boots `Cheering for !`,
  re-renders on typing), `drive-mood.mjs` (theme sentence; **guard blocks the click while
  visitorName is empty**, then writes after set), `drive-check.mjs`, `drive-notes.mjs`.
  Emit-to-disk recipe: `emit-cheer.ts` in the scratchpad, run with
  `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node","esModuleInterop":true}'
  ../../node_modules/.bin/ts-node --transpile-only --skipProject` (the package tsconfig trips
  ts-node otherwise); it restores the scratch `file:` core pin after writing.

**Next, in order of value:**

- **Grow the expression family**: And / Or / Inverter (`&&`, `||`, `!`) and Switch (ternary)
  join `resolveExpr` with nothing new to decide about *where* code lives — read their runtime
  sources first (`and.ts`, `or.ts`, `inverter.ts`, `switch.ts` in
  `noodl-runtime/src/nodes/std-library/`; the run-on-value-change checkbox pattern applies to
  some). Condition's value outputs join when a boolean render sink lands (an
  `enabled → disabled` content mapping is the natural first — `CONTENT_PARAMS` in
  emit/style.ts). Hand-write the target extension first, extend Cheer via MCP.
- **Model2 (id provenance)** — unchanged from the collections slice: the lone
  `NewModel.id → modifyId` wire is its first, degenerate case (COLLECTIONS-TARGET §5); a
  literal-id Model2 read and a same-handler NewModel id are the next two.
- Smaller recorded holes: `else` arms and multi-action arms are implemented but
  fixture-unexercised (the `};` cosmetic in brace arms is known); nested Conditions defer;
  on-change firing (`runOnChange` ticked with wired arms) is the `effect()` row, its own
  slice.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`); never commit `packages/nodegx-core/dist`; untracked
files add+commit in one chain. Fixtures are snapshots — re-copy from the live Cheer project
after MCP edits (`diff -rq`, copy only `components/**` + `_registry.json`; the live project's
`.mcp.json`/`CLAUDE.md`/`docs` stay out). ts-morph/Prettier remain uninstalled; the goldens
protect the later AST refactor. The package is still not in root `test:packages` — wiring it
in edits the shared root package.json; do it deliberately, announced. ⚠️ jsdom drive trap:
import React only AFTER installing the jsdom globals (recipes in the scratchpad
`cheer-app/drive-*.mjs`). ⚠️ `src/analyze/appState.ts` contains literal NUL bytes — `grep -a`;
never type `\u0000` into Edit args. ⚠️ The step-5 fixture wire
`readVisitor-2.value → setTheme.value` still exists alongside the new condition wire — both
read the same variable; don't "deduplicate" them, the branch consumes both legitimately.
