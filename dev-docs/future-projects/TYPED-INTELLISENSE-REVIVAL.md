# Project: Typed Intellisense Revival for the CodeMirror Editor

## Overview

**Goal:** Give node script editing (Function/Script/Expression code, plus the AI
chat's inline Function-node editor) real autocomplete and compile-time errors
again, built on PLAT-003's generated `.d.ts` output instead of the old
per-node Monaco TypeScript language service.

**Why this matters:**
- PLAT-003 ("type the runtime") explicitly wants "a node author, human or AI,
  gets autocomplete and compile-time errors" and emits real `.d.ts` from the
  typed runtime — but nothing is wired to feed those types back into an
  editor.
- Hand-written/AI-touched-up node code remains part of the product even in an
  AI-authored world; humans still review and tweak generated scripts.
- The current CodeMirror `JavaScriptEditor` (`packages/noodl-core-ui/src/components/code-editor/`)
  ships a 109-line static completion list (`noodl-completions.ts`) — much
  weaker than what the old Monaco path offered for `.d.ts`-aware node types.

## Background: what's actually left of the old subsystem (DEBT-011, 2026-07-25)

The phase-3 code editor overhaul (TASK-009/010/011) moved Function/Script/
Expression editing to the CodeMirror-based `JavaScriptEditor` and made it the
default everywhere the *property panel* opens a code editor. DEBT-011
finished that migration for the one remaining property-panel case
(`codeeditor: 'json'` ports, previously served as Monaco plaintext — now
real CodeMirror JSON with `@codemirror/lang-json`) and deleted the parts of
`packages/noodl-editor/src/editor/src/utils/CodeEditor/typescript/` that had
genuinely gone unreachable: the `DbCollection2`, `Expression`, and
`Javascript2` per-node-type ambient-`.d.ts` injectors.

**What's still alive and still Monaco:** `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/AiChat/AiChat.tsx`'s
`AiMessageFunctionNodeAffix` — the "Open code editor" button shown under an
AI chat message when editing a `JavaScriptFunction` node — calls
`createModel()` directly (bypassing the property-panel dispatcher
entirely) with `codeeditor: 'javascript'`, which still drives the full old
pipeline: `registerOrUpdate_JavaScriptFunction`, `GetOrCreateViewerModel`
(+ `-React`/`-Cloud` variants), and the raw Monaco `CodeEditor` wrapper
component (`.../CodeEditor/CodeEditor.tsx`) with its theme/action
registration (`actions/`, `Themes/`). Separately,
`packages/noodl-editor/src/editor/src/views/documents/ComponentDiffDocument/CodeDiffDialog.tsx`
(used by the Version Control panel's diff list and the graph-diff/merge
review UI) uses `monaco.editor.createDiffEditor` directly for side-by-side
code diffs, unrelated to the property-panel editor entirely.

Both were missed by the original pre-revival salvage audit (`dev-docs/reviews/PRE-REVIVAL-SALVAGE-AUDIT.md`
§5), which only verified the property-panel dispatcher's routing. That means
`monaco-editor` + `monaco-editor-webpack-plugin` are **still real runtime
dependencies** (see `packages/noodl-editor/package.json`'s `build.files`
allowlist, which explicitly ships `node_modules/monaco-editor/esm`) — DEBT-011
could not remove them. Retiring Monaco for good needs two follow-ups first:

1. Migrate `CodeDiffDialog.tsx`'s diff view onto CodeMirror. Note
   `packages/noodl-core-ui/src/components/code-editor/CodeHistory/CodeHistoryDiffModal.tsx`
   already exists and does a CodeMirror-based diff render for the code
   history feature — it's a plausible base rather than starting from scratch.
2. Migrate `AiChat.tsx`'s inline Function-node editor onto the CodeMirror
   `JavaScriptEditor` (the same swap the property panel already got). This is
   also the natural point to retire the remaining `typescript/nodes/JavaScriptFunction`,
   `typescript/viewer*`, and `utils/CodeEditor/{model.ts,context.ts,mappings.ts}`
   files — once nothing calls `createModel()` anymore, that whole directory
   (and the `.../CodeEditor/CodeEditor.tsx` wrapper, `actions/`, `Themes/`)
   can go, and `monaco-editor` can finally leave `package.json`.

## Proposed shape of the revival

- PLAT-003 (or its successor) emits `.d.ts` describing: node-local
  identifiers (`Noodl.Identifiers`), the local project's database schema
  (`Noodl.DatabaseSchema`), cloud function signatures
  (`Noodl.CloudFunctionSchema`), and page/router names — this is exactly
  what `utils/CodeEditor/typescript/viewer/index.ts`'s `GetSource()` already
  assembles as a hand-rolled string template today, just sourced from
  PLAT-003's typed runtime instead of ad-hoc reflection over `ProjectModel`.
- Feed that `.d.ts` text into a CodeMirror language service. CodeMirror 6
  doesn't have a built-in TS/JS type-checker the way Monaco does (Monaco
  embeds a real `tsserver`-derived worker); the practical options are (a) run
  actual TypeScript's language service in a Web Worker and bridge
  diagnostics/completions into CodeMirror's `@codemirror/autocomplete` +
  `@codemirror/lint`, or (b) accept a lighter completion-only experience by
  parsing the `.d.ts` into a completion source (closer to what
  `noodl-completions.ts` already does, just generated instead of static).
  (a) is the "real" revival; (b) is a smaller, faster win.
- Whichever is chosen, it should replace `noodl-completions.ts`'s static list
  rather than live alongside it, and should be wired at the same point
  DEBT-011 identified as the dispatcher: `CodeEditorType.ts`'s
  `getValidationType()` / `JavaScriptEditor` render call, once that's also
  the AI chat's only code path.

## Out of scope here

- Building the CodeMirror intellisense itself — this note is the pointer,
  not the task. Scoping it (worker architecture, which `.d.ts` surface is
  minimally viable, whether TypeScript's LS is too heavy for a Web Worker in
  Electron) is a later decision, ideally made after PLAT-003 is further along
  and after the two Monaco-migration follow-ups above land.
- Any change to the JS editing experience for the property panel itself
  (already CodeMirror, already fine).

## References

- `dev-docs/tasks/phase-14.5-revival-debt/DEBT-011-MONACO-RETIREMENT.md` (this note's origin; see its CHANGELOG section for the full DEBT-011 account)
- `dev-docs/reviews/PRE-REVIVAL-SALVAGE-AUDIT.md` §5
- PLAT-003 ("type the runtime") task docs, phase 14
- `packages/noodl-core-ui/src/components/code-editor/` (the live CodeMirror editor)
- `packages/noodl-editor/src/editor/src/utils/CodeEditor/typescript/viewer/index.ts` (`GetSource`/`CreateSource` — the existing hand-rolled `.d.ts` template worth reusing the shape of)
