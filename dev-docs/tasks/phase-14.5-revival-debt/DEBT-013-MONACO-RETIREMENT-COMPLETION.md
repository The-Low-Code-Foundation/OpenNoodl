# DEBT-013: Finish Monaco Retirement — Migrate the Two Remaining Live Consumers

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-013 |
| **Phase** | Phase 14.5 — Revival Debt (added 2026-07-25; the follow-up DEBT-011 surfaced and could not do) |
| **Priority** | 🟢 Low-Medium (dead-weight removal + bundle; not a defect — the two consumers work fine on Monaco today) |
| **Difficulty** | 🟡 Medium (two real UI migrations, not a delete-and-swap) |
| **Estimated Time** | 2–4 days |
| **Prerequisites** | DEBT-011 (done, `f14fd14`) |
| **Branch** | commit straight to `cline-dev` (no task branch) |
| **Recommended executor** | 🟠 **Opus 4.8** — a diff-editor migration and an inline-editor swap against a clear target, each with a real UI to preserve (theming, side-by-side layout, popout); opaque-enough failure modes to want iterative live verification. |

## Objective

Remove `monaco-editor` and `monaco-editor-webpack-plugin` from the product for good by migrating the **two live Monaco consumers DEBT-011 discovered** onto the shipped CodeMirror editor, then deleting the last of the old `utils/CodeEditor/` subsystem, the Monaco wrapper, and the dependency + its webpack/packaging wiring.

## Background

DEBT-011 set out to retire Monaco on the premise (from [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §5) that it served exactly one live case — `codeeditor: 'json'` ports. That premise was **wrong**: a repo-wide `grep monaco` (the task's own prescribed mitigation) found two more live consumers that bypass the property-panel dispatcher and call Monaco directly. DEBT-011 therefore shipped only the safe part — JSON + array ports moved to CodeMirror, the genuinely-unreachable per-node TS-intellisense injectors deleted — and left the dependency in place. This task finishes the job.

The full technical map is in [`dev-docs/future-projects/TYPED-INTELLISENSE-REVIVAL.md`](../../future-projects/TYPED-INTELLISENSE-REVIVAL.md) (written by DEBT-011); the two consumers are:

1. **`CodeDiffDialog.tsx`** (`views/documents/ComponentDiffDocument/`) — used by the Version Control panel's diff list **and** the graph-diff/merge review UI (SUB-007/AIX-003). Uses `monaco.editor.createDiffEditor` directly for side-by-side code diffs. Unrelated to the property-panel editor.
2. **`AiChat.tsx`** (`views/panels/propertyeditor/components/AiChat/`) — the `AiMessageFunctionNodeAffix` "Open code editor" button under an AI chat message when editing a `JavaScriptFunction` node. Calls `createModel()` directly with `codeeditor: 'javascript'`, driving the full old pipeline (`registerOrUpdate_JavaScriptFunction`, `GetOrCreateViewerModel` + `-React`/`-Cloud` variants, the raw Monaco `CodeEditor` wrapper with its `actions/`/`Themes/` registration).

Only once **both** are off Monaco can `monaco-editor` leave `package.json` — note `package.json`'s `build.files` allowlist explicitly ships `node_modules/monaco-editor/esm`, so this is a real packaged-bundle removal, not just a dev-dep tidy.

## Current State

- `views/documents/ComponentDiffDocument/CodeDiffDialog.tsx` — `monaco.editor.createDiffEditor`, still live in Version Control + graph-diff review.
- `views/panels/propertyeditor/components/AiChat/AiChat.tsx` (`AiMessageFunctionNodeAffix`) — `createModel()` → old pipeline → `CodeEditor.tsx` wrapper.
- Still-alive old subsystem behind those two: `utils/CodeEditor/` remainder (`model.ts`, `context.ts`, `mappings.ts`, `typescript/nodes/JavaScriptFunction/`, `typescript/viewer*`), the `CodeEditor/CodeEditor.tsx` wrapper, `actions/`, `Themes/`, `CodeEditor.css`.
- Deps: `monaco-editor`, `monaco-editor-webpack-plugin` in `packages/noodl-editor/package.json`; the webpack plugin wiring; the `build.files` allowlist line shipping `monaco-editor/esm`.
- Live CodeMirror editor: `packages/noodl-core-ui/src/components/code-editor/` — `JavaScriptEditor` for code; **`CodeHistory/CodeHistoryDiffModal.tsx` already does a CodeMirror-based side-by-side diff** and is the plausible base for consumer #1.
- One benign dead CSS selector string `.monaco-editor .inputarea` in `propertyeditor.ts` (no-op post-migration) — remove while here.

## Desired State

- `CodeDiffDialog` renders its diff via CodeMirror (reusing/extending `CodeHistoryDiffModal`'s approach), preserving side-by-side layout, syntax highlighting, and theming, in **both** the Version Control panel and the graph-diff/merge review UI.
- The AI chat's inline Function-node editor opens the CodeMirror `JavaScriptEditor` — the same experience the property panel already gives — including its popout.
- `monaco-editor` + `monaco-editor-webpack-plugin` gone from `package.json`; webpack plugin config removed; `build.files` `monaco-editor/esm` line removed; the wrapper + remaining `utils/CodeEditor/` subsystem deleted.
- `grep monaco` across all packages (excluding `/external/`, vendored bundles, `dist`, `node_modules`) returns **zero** references.
- Bundle-size delta recorded (this is the real monaco-removal win DEBT-011 could not deliver).

## Scope

### In Scope
- [x] Migrate `CodeDiffDialog.tsx` onto CodeMirror; verify in Version Control **and** graph-diff/merge review — via new `CodeDiffView` (`@codemirror/merge` `MergeView`); both call sites use the same dialog
- [x] Migrate `AiChat.tsx`'s inline Function-node editor onto `JavaScriptEditor` (incl. popout) — `validationType: 'function'` in a `PopupLayer` popout, mirroring `CodeEditorType.ts`
- [x] Delete the now-orphaned `utils/CodeEditor/` remainder, the `CodeEditor.tsx` wrapper, `actions/`, `Themes/`, `CodeEditor.css`; remove the dead `.monaco-editor` CSS selector — done; retargeted the two `propertyeditor.ts` focus selectors to `.cm-editor .cm-content`
- [x] Remove both deps + webpack plugin config + the `build.files` allowlist line
- [x] Verify: `grep monaco` clean; `tsc --noEmit` green (editor 0 errors); record bundle delta (~11.4 MB workers + `monaco-editor/esm` dropped from installer). **Packaged** build: deferred to next CI tag (the standing packaging-trap rule) — `build:editor` deletes `node_modules` mid-build in a shared tree; dev/webpack build proven clean + Monaco-free
- [x] Live checks: `CodeDiffView` (VC + graph-diff diff engine) and `JavaScriptEditor` (AiChat editor) both rendered correctly in the running editor via direct bundled-component mount — screenshots in session scratchpad

### Out of Scope
- Building CodeMirror intellisense from PLAT-003 `.d.ts` (that remains the future-projects note; unblocked once `createModel()` has no callers, but a separate scoping decision)
- Any change to the property-panel code-editing experience (already CodeMirror)
- The JS editing behavior itself

## Success Criteria

- [x] No `monaco` reference anywhere in the repo (per the grep exclusions above); both deps removed; `build.files` line gone — product source + real `package-lock.json` clean; only docs mention monaco. Also removed a stray `package-lock 2.json` junk duplicate that carried it.
- [~] Packaged build green; bundle-size delta recorded — **bundle delta recorded** (~11.4 MB Monaco worker bundles no longer emitted + `monaco-editor/esm` dropped from installer, vs `@codemirror/merge` ~tens of KB); packaged-installer run **deferred to next CI tag** (shared-tree `build:editor` deletes `node_modules` mid-build). Dev/webpack build proven clean + Monaco-free (app builds + boots, 0 exceptions).
- [x] Code diffs render correctly via CodeMirror in Version Control **and** graph-diff/merge review — `CodeDiffView` (`MergeView`) live-verified rendering a syntax-highlighted side-by-side diff with change gutters; both surfaces use this same component.
- [x] AI-chat inline Function-node editor works via CodeMirror incl. popout — `JavaScriptEditor` (FUNCTION mode, ✓ Valid, Format/Save, resize) live-verified.
- [x] DEBT-011 row + phase-14.5 PROGRESS updated to "complete"; TYPED-INTELLISENSE-REVIVAL note's "two follow-ups" section marked done.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| CodeMirror diff view lacks a Monaco diff feature someone relies on (inline vs side-by-side, folding) | `CodeHistoryDiffModal` already ships a CodeMirror diff in-product — start from it; if a gap remains, close it there rather than keeping Monaco for one feature |
| The AI-chat editor's `createModel()` path feeds viewer/cloud/react model variants the property panel doesn't | Trace what `GetOrCreateViewerModel` supplied that `JavaScriptEditor` needs; the property panel already edits Function nodes without it, so parity should be reachable — confirm the AI-chat case has no extra model requirement |
| Removing the `build.files` `monaco-editor/esm` line breaks packaging non-obviously | Verify the **packaged** app (the repo's standing packaging-trap rule), not just the dev build |
| A third hidden Monaco consumer exists | Re-run the full-repo grep before deleting the dep — same mitigation DEBT-011 used to catch these two |

## References

- [`dev-docs/future-projects/TYPED-INTELLISENSE-REVIVAL.md`](../../future-projects/TYPED-INTELLISENSE-REVIVAL.md) — the DEBT-011 technical map naming both consumers and the deletion set
- [DEBT-011-MONACO-RETIREMENT.md](./DEBT-011-MONACO-RETIREMENT.md) — the partial that surfaced this; its CHANGELOG has the full account
- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §5
- `packages/noodl-core-ui/src/components/code-editor/CodeHistory/CodeHistoryDiffModal.tsx` (base for consumer #1); `JavaScriptEditor` (target for consumer #2)
- Related: PLAT-003 (the `.d.ts` that would power a future intellisense revival), SUB-007 / AIX-003 (the graph-diff/merge review UI that consumes `CodeDiffDialog`)
