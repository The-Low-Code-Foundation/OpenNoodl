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
