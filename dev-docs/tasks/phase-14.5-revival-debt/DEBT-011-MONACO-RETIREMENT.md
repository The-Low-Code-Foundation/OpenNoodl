# DEBT-011: Retire Monaco and the Dead Intellisense Subsystem

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-011 |
| **Phase** | Phase 14.5 — Revival Debt (added 2026-07-24 from the pre-revival salvage audit) |
| **Priority** | 🟢 Low-Medium (dead weight, not a defect — but cheap and bundle-relevant) |
| **Difficulty** | 🟢 Easy |
| **Estimated Time** | 1–2 days |
| **Prerequisites** | None |
| **Branch** | `task/debt-011-monaco-retirement` |
| **Recommended executor** | 🟢 **Sonnet 5** — the routing is already verified; this is a delete-and-swap with a live check. |

## Objective

Move the last Monaco-served port (plaintext JSON) onto the CodeMirror editor, then delete the Monaco wrapper, the unreachable TypeScript-intellisense subsystem, and the `monaco-editor` dependency.

## Background

The phase-3 code-editor overhaul shipped: CodeMirror 6 (`JavaScriptEditor` + history/diff/format, ~2,400 lines in core-ui) is the default editor for all Function/Script/Expression code. What it left behind ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §5): the swap silently orphaned the old Monaco path's per-node TypeScript language service, and Monaco itself (`monaco-editor@0.34.1` + webpack plugin) remains bundled to serve exactly one case — `codeeditor: 'json'` ports, which Monaco opens as **plaintext** (`model.ts:32-34` early-return), so it isn't even doing JSON highlighting.

Verified routing: `CodeEditorType.ts:213` branches on `codeeditor === 'javascript' || 'typescript'`; the codebase sets only `'javascript'` (6 sites) and `'json'` (1 site); no `'typescript'` anywhere. Therefore `utils/CodeEditor/typescript/*` (~1,000+ lines: ambient lib injection, per-node `.d.ts` for DbCollection2/Javascript2/Expression/JavaScriptFunction, viewer/viewer-cloud/viewer-react type feeds) and the TS-module registration block (`model.ts:42-111`) are **unreachable in the live app**.

Deleting is safe — git history preserves the reference — and honest: dead code that looks like a feature misleads every future reader (and every agent) about what the editor can do.

## Current State

- Dispatcher: `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts` (391 lines; module-top `monaco` import; `monaco.editor.*` typed fields at :47/:66)
- Monaco wrapper: `.../CodeEditor/CodeEditor.tsx` (185 lines; carries Monaco marker/warning code that only runs on the JSON branch)
- Dead subsystem: `packages/noodl-editor/src/editor/src/utils/CodeEditor/` (1,286 lines total incl. `model.ts` and `typescript/`)
- Live editor: `packages/noodl-core-ui/src/components/code-editor/` (CodeMirror; `@codemirror/*` deps in core-ui)
- Deps to drop from `packages/noodl-editor/package.json`: `monaco-editor`, `monaco-editor-webpack-plugin` (+ its webpack config wiring)

## Desired State

- JSON ports open in CodeMirror with JSON mode (an upgrade — they get actual JSON highlighting/validation for the first time).
- `CodeEditor.tsx`, `utils/CodeEditor/` deleted; `CodeEditorType.ts` no longer imports monaco; dependency + webpack plugin gone; bundle measurably smaller.
- A pointer left for the future: intellisense revival via PLAT-003's generated `.d.ts` feeding a CodeMirror language service is recorded in `dev-docs/future-projects/` (a note, not a task) — so the deletion doesn't erase the idea, only the dead code.

## Scope

### In Scope
- [ ] Route `codeeditor: 'json'` to the CodeMirror editor with JSON language support
- [ ] Delete the Monaco wrapper + `utils/CodeEditor/` subsystem; clean `CodeEditorType.ts`
- [ ] Remove deps + webpack plugin config; verify build and bundle-size delta
- [ ] Live check: open the JSON port's editor (App Config path) and a Function node's editor; both work, popouts included
- [ ] Future-projects note for typed intellisense revival

### Out of Scope
- Building CodeMirror intellisense from PLAT-003 types (the future-projects note is the deliverable; scoping that work is a later decision)
- Any change to the JS editing experience

## Success Criteria

- [ ] No `monaco` reference anywhere in the repo; deps removed; build green
- [ ] JSON ports edit correctly in CodeMirror (live-verified)
- [ ] JS editor behavior unchanged (live-verified)
- [ ] Bundle-size delta recorded in CHANGELOG
- [ ] Future-projects note exists

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| An unnoticed Monaco consumer exists outside the verified routing | Grep for `monaco` across all packages before deleting; the audit checked the dispatcher, not the universe |
| The JSON port has Monaco-specific behavior someone relies on | It opens as *plaintext* today — CodeMirror JSON mode is strictly better; still, live-check the App Config flow specifically |
| Webpack config removal breaks the build in non-obvious ways | This repo's packaging-trap history applies: verify the packaged app, not just dev |

## References

- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §5
- `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-009-monaco-replacement/`
- Related: PLAT-003 (the `.d.ts` emission that would power a future intellisense), PLAT-002 wave 2d commit `6351c6a` (the el swap that already de-jQueried this surface)

## CHANGELOG (2026-07-25)

**Status: partially complete.** The `codeeditor: 'json'` migration and the
verified-dead half of the TypeScript intellisense subsystem are done. Full
Monaco retirement (deps + webpack plugin) is **not** done — the audit's
premise turned out to be incomplete: a `grep -r monaco` across all packages
(the Risks table's own mitigation for "an unnoticed Monaco consumer") turned
up two live consumers the audit missed, both outside this task's authorized
file surface. See `dev-docs/future-projects/TYPED-INTELLISENSE-REVIVAL.md`
for the full technical account and the proposed follow-up shape.

### What shipped

- **`codeeditor: 'json'` now opens in CodeMirror with real JSON mode** — an
  actual upgrade from Monaco's plaintext early-return. Added
  `@codemirror/lang-json` to `packages/noodl-core-ui` and wired a `'json'`
  `ValidationType` through `codemirror-extensions.ts` (language + mode
  label), `utils/jsValidator.ts` (`JSON.parse`-based validation), and
  `utils/types.ts`.
- **Array-typed ports** (`isOfArrayType()` in `DataTypes/Ports.ts`, e.g. the
  Options node's "Items" input) were *also* quietly going through Monaco
  (a bare `'typescript'`-language model, no intellisense) — this wasn't
  called out in the task's "Current State" but was found via the file's own
  routing logic. Now routed through CodeMirror as an `'expression'` too.
- **`CodeEditorType.ts` rewritten**: zero `monaco` references, no more
  `createModel`/`EditorModel`/Monaco-marker (`updateWarnings`) machinery, no
  more `CodeEditor.tsx` import. Every port that reaches this dispatcher now
  renders the CodeMirror `JavaScriptEditor`. (Net: 277 lines changed, mostly
  deletions — view state caching for a Monaco editor instance that the JS
  path never populated, and the runtime-warning-marker overlay that already
  didn't work for the dominant JS-port case, are gone too. No functionality
  lost beyond that pre-existing gap.)
- **Verified-dead code deleted**: `typescript/nodes/{DbCollection2,Expression,Javascript2}/`
  (388 lines) and `model/extensions/prefixSuffixExtension.ts` (93 lines,
  already fully commented out at its only call site) — 481 lines removed.
  Confirmed dead by tracing every caller of `createModel()` (only two exist
  repo-wide) and every caller of `PrefixSuffixExtension` (none, live).
- `utils/CodeEditor/model.ts` trimmed: the `codeeditor === 'json'` and
  `type === 'array'` early-returns are gone (nothing calls `createModel`
  that way anymore), and the `DbCollection2`/`Expression`/`Javascript2`
  switch cases are gone with their imports.

### What did NOT ship, and why

Two live Monaco consumers exist **outside this task's file surface** that
the salvage audit's "verified routing" check didn't catch (it only checked
the property-panel dispatcher, `CodeEditorType.ts`):

1. **`packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/AiChat/AiChat.tsx`**
   (`AiMessageFunctionNodeAffix`, the "Open code editor" button under an AI
   chat message, `data-test="ai-code-editor"`) calls `createModel()` and
   renders the raw Monaco `CodeEditor` wrapper **directly**, bypassing
   `CodeEditorType.ts` entirely. It's hardcoded to
   `codeeditor: 'javascript'` for `JavaScriptFunction` nodes, which means
   the `registerOrUpdate_JavaScriptFunction` branch of the "dead" TS
   intellisense subsystem is genuinely reachable — this is why that one
   node module, plus `typescript/helper.ts` and the three `viewer*` modules,
   plus `.../CodeEditor/CodeEditor.tsx`, `actions/`, and `Themes/`, were
   **kept**, not deleted. This is part of the AI copilot feature
   (AIX-001/002), actively developed and load-bearing — not something to
   silently break.
2. **`packages/noodl-editor/src/editor/src/views/documents/ComponentDiffDocument/CodeDiffDialog.tsx`**
   uses `monaco.editor.createDiffEditor` directly for the Version Control
   panel's diff view and the graph-diff/merge review UI (`DiffList.tsx`,
   `ComponentDiffDocument.tsx` — both live, routed in `router.setup.ts`).
   Unrelated to the property-panel editor; it only reuses `getTheme()` from
   `.../CodeEditor/actions/`.

Because of these, `monaco-editor` and `monaco-editor-webpack-plugin` are
**still real, load-bearing dependencies** — `packages/noodl-editor/package.json`'s
`build.files` allowlist even explicitly ships `node_modules/monaco-editor/esm`
in the packaged app. Removing either the npm dependency or the webpack
plugin wiring would break both of the above. Per this task's own hard
coordination rule ("Do NOT edit any file outside this surface") and the
three-agent shared-tree constraint, I did not touch `AiChat.tsx` or
`CodeDiffDialog.tsx` to migrate them off Monaco myself.

**Recommended follow-up** (new task or DEBT-011 re-scope): migrate
`CodeDiffDialog.tsx` onto CodeMirror (note
`packages/noodl-core-ui/src/components/code-editor/CodeHistory/CodeHistoryDiffModal.tsx`
already does a CodeMirror-based diff render and is a plausible base) and
`AiChat.tsx`'s inline Function-node editor onto the CodeMirror
`JavaScriptEditor`. Once both are off Monaco, the remaining
`utils/CodeEditor/` files, `.../CodeEditor/CodeEditor.tsx`, `actions/`,
`Themes/`, the `monaco-editor` + `monaco-editor-webpack-plugin` deps, and
the webpack plugin wiring in `webpackconfigs/shared/webpack.renderer.shared.js`
can all be deleted in one pass.

### Bundle-size delta

Not independently measured with a full production build (explicitly out of
scope for this agent — dist builds race with other agents on the shared
tree). What's known:

- `monaco-editor` (78MB in `node_modules`, the actual bundled/minified
  contribution is much smaller but still the dominant cost the original
  audit was chasing) **was not removed** — no win there yet.
- Added `@codemirror/lang-json` (36KB in `node_modules`; bundled/minified/
  gzipped contribution is on the order of a few KB, in line with the
  already-present `@codemirror/lang-javascript`).
- Removed 481 lines of dead TypeScript source (`typescript/nodes/{DbCollection2,Expression,Javascript2}`
  + `prefixSuffixExtension.ts`) plus ~150 net lines from `CodeEditorType.ts`
  and `model.ts` — real but small (dead code wasn't tree-shaken before
  either, since it was reachable from `model.ts`'s exports, but the
  contribution of ~600 lines of TS to a minified bundle is on the order of
  single-digit KB).
- **Net expectation: roughly bundle-neutral to a small win**, not the
  "monaco-editor gone" win the original spec targeted. A real number needs
  a production build diff (see smoke steps below).

### Checks run

- `tsc --noEmit` in `packages/noodl-editor` (uses the package's own
  `tsconfig.json`, which has the correct `@noodl-store`/`@noodl-versioning`
  path aliases): **0 errors**, including `AiChat.tsx` and
  `CodeDiffDialog.tsx` (confirms they still compile against the trimmed
  `utils/CodeEditor/` surface).
- `tsc --noEmit` in `packages/noodl-core-ui`: pre-existing, unrelated
  `@noodl-store`/`@noodl-versioning` path-alias errors only (that
  tsconfig's path map is missing those aliases regardless of this task —
  not introduced by this change); zero errors touching `code-editor/`.
- `grep -rn monaco` across `packages/**/*.{ts,tsx,js}` (excluding
  `/external/`, `*.bundle.js`, `/dist/`, `*.worker.js`, `node_modules`):
  residual matches are exactly the two live consumers above plus their
  transitive dependencies (`CodeEditor.tsx`, `actions/`, `Themes/`,
  `utils/CodeEditor/{index.ts,model.ts,model/editorModel.ts,typescript/{helper.ts,viewer*,nodes/JavaScriptFunction}}`),
  the webpack config that wires the plugin, and one benign dead CSS-selector
  string in `propertyeditor.ts` (`.monaco-editor .inputarea` — now
  permanently non-matching post-migration, harmless, left untouched as it's
  outside this task's file surface).
- No jest specs exist for `CodeEditor`/`CodeEditorType`; this repo's test
  harness (`test:ci`) drives Electron via CDP, which this agent was
  explicitly told not to launch.

### Live-editor + build smoke steps for the coordinator

1. `npm run build` (or the packaged-app build) from repo root — confirm
   webpack succeeds with the `monaco-editor-webpack-plugin` still wired
   (unchanged) and the new `@codemirror/lang-json` chunk bundles cleanly.
2. Compare bundle output size before/after this change's commit (webpack
   stats or `du -sh` on the renderer output) for the real delta — expect
   small, not the full monaco-editor removal.
3. Launch the editor, open a project, find a node with a `codeeditor: 'json'`
   port (e.g. the "Static Data" / App Config JSON path referenced in the
   spec) — open its editor via the property panel, confirm CodeMirror JSON
   syntax highlighting renders, edit a value, save, reopen to confirm
   persistence, and try invalid JSON to confirm the error panel shows a
   `JSON.parse` error.
4. Open a Function node's script editor from the property panel (the normal
   JS path) — confirm popout open/close, edit, save, and history dropdown
   all behave exactly as before (no regression expected, but this dispatcher
   was rewritten).
5. Open a node with an array-typed editable input (e.g. Options node →
   "Items") — confirm the code editor popout opens and accepts a JS array
   literal (this path silently moved off Monaco as part of this change).
6. Open the AI chat on a `JavaScriptFunction` node and click "Open code
   editor" under a message — confirm it still opens (this is the
   still-Monaco path; should be unchanged, but worth confirming nothing in
   the `utils/CodeEditor/model.ts` trim broke it).
7. Open the Version Control panel's diff view (or a component diff) —
   confirm `CodeDiffDialog`'s Monaco diff editor still renders themed
   correctly (also unchanged, same reasoning).
