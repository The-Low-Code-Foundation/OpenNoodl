# FH-017 — Six located fixes in the code editor

Covers the mechanical half of reported items **18** and **19**. Strategy context:
[TALK-002](TALK-002-THE-CODE-EDITOR-IS-NOT-DIY.md). All paths under
`packages/noodl-core-ui/src/components/code-editor/` unless noted.

## Slice 1 — `Noodl.` completes

`noodl-completions.ts:59-64` — delete/bypass the `word.from === word.to && !context.explicit`
guard for the dot case so the `textBefore.endsWith('Noodl.')` branch (`:83-93`) is reachable.
Preferred stronger form: register `scopeCompletionSource(globalThis)` from our installed
`@codemirror/lang-javascript` so `Noodl.` enumerates the live object's properties instead of the
25-string list. `library-completions.ts:65` has the identical guard and is documented "NOT WIRED
IN" — wire it or delete it, don't leave the twin.

> **Resolved 2026-08-05:** neither, *here*. Wiring it needs the open project threaded into
> `noodl-core-ui`, which is exactly the seam [FH-019](FH-019-TYPED-INTELLISENSE.md) slice 1 builds,
> and it is that task's first consumer. Fix the guard in both files so the twin cannot drift, and
> leave the wiring to FH-019. `scopeCompletionSource` likewise belongs to FH-019 — see its slice-2
> trap about *which* `Noodl` object the editor's `globalThis` actually holds.

## Slice 2 — one error system, debounced

Delete System B: `jsValidator.ts`'s per-keystroke synchronous `new Function()` validation
(`JavaScriptEditor.tsx:63-112`) and its single-error panel (`:306-325`). Drive the toolbar badge
from the lint state instead (`diagnosticCount`), which is already debounced at 750ms. Keep
`validationTypeForEditType` (`CodeEditorType.ts:42-57`) — that's the port→language mapping, not
part of System B.

## Slice 3 — errors at real positions, plural, revisitable

> ⚠️ **Corrected 2026-08-05 (TALK-002 HAD).** `@codemirror/lang-javascript` exports the `esLint()`
> *wrapper* only. The linter itself, `eslint-linter-browserify`, is **not installed and was in no
> package.json** — this slice was mis-costed below as free. Richard's decision: **take the
> dependency** rather than hand-roll ~40 lines of Lezer error anchoring, because "less code on the
> same library" is the whole principle of the no-switch decision. Add it to
> `packages/noodl-core-ui/package.json`.
>
> Lockfile trap: `package-lock.json` carries another session's uncommitted pruning. Commit
> `packages/noodl-core-ui/package.json` by pathspec and **leave the lockfile alone** — CI runs
> `npm install`, not `npm ci` (`test-platform-node.yml:35`), so an un-updated lock is not a gate.

Replace the Lezer error-node walk in `syntaxDiagnostics.ts` with `esLint()` (exported by our
installed `lang-javascript`; dep `eslint-linter-browserify`) so an unclosed bracket is reported at
the mistake, not as a zero-length node at end-of-document that migrates as you type
(`syntaxDiagnostics.ts:42-59` `widen()` is what pins it to whatever you just typed). Surface CM's
diagnostics panel: a button/badge click calls `openLintPanel` (keymap `Mod-Shift-M` is already
bound at `codemirror-extensions.ts:143`; zero product call sites today).

## Slice 4 — the gutter dot is clickable

Stock CM lint gutter is hover-only (`@codemirror/lint` `LintGutterMarker.toDOM` sets `onmouseover`
only). Add a gutter click handler (`gutter({ domEventHandlers: { click } })`) or route the dot to
`openLintPanel`.

## Slice 5 — light-mode selection

`codemirror-theme.ts:240` — the hardcoded `{ dark: true }` selects CM's base dark selection
(`#233`) at 5-class specificity, beating our 3-class token rule (`:48-50`), whose `::selection`
fallback is dead under `drawSelection()`. Make the flag reactive to the ThemeManager (the file's
own header says the design is "the colours are var()s so it flips automatically") or `Prec.high`
the selection rule. One fix covers `JavaScriptEditor`, `MarkdownEditor`, `CodeDiffView`.

While in the file: POL-017 (filed, not fixed) has already measured the gutter line-number contrast
answer — `fg-default-shy`, with the warning that the three `fg-muted` uses (lines 60, 100, 225)
sit on different backgrounds and must not be blanket-replaced. Fold it in.

## Criteria

1. Typing `Noodl.` pops `.Variables/.Objects/.Arrays/...`; `Noodl.V` still narrows.
2. No error badge/squiggle while typing until the 750ms idle; the badge and squiggle agree.
3. ~~`function f() {` then two more lines: the error stays on line 1~~ — **rewritten, see DONE:**
   no parser anchors an unterminated block anywhere but end-of-input. What must hold: the error is
   hoverable, the diagnostics panel lists it, and two independent *rule* violations both appear.
4. Clicking the gutter dot opens the diagnostics panel.
5. Light mode: selected text is visibly highlighted with legible text (measure it, don't eyeball —
   phase-39 rule).
6. Existing `tests/code-editor/` suite green; add cases for the dot-trigger and multi-error.
7. Verified in the running editor, both themes.

## Traps

- The popout editor mounts through legacy `CodeEditorType.ts` plumbing — restart the editor rather
  than trusting HMR through a mounted panel.
- Don't validate CSS ports as JS — `validationTypeForEditType` must keep working after System B is
  deleted.
- The hex `%23ef4444` squiggle in `codemirror-theme.ts:181-195` is a hardcoded colour in an SVG
  data-URI — if touched, remember the phase-39 rule: every var() must name a defined token.

## DONE — 2026-08-05

All five slices shipped and driven in the running editor. Gates: root `typecheck` clean,
`lint:ci` 846 vs 3916 baseline, `colors` holding, editor suite **2202 specs, 0 failures**, core-ui
jest 148 (was 148 — 24 deleted with System B, 46 added). `tsfixme` rose by 7, all of it in another
session's `snapshotProject*` files, none in this change.

### What was verified live, not asserted

Driven through the real popout (`ExpressionEditorModal`, `EXPRESSION` mode) in `lib21-qa`:

| Criterion | Result |
|---|---|
| 1. `Noodl.` completes while typing | Popup listed `Arrays / Objects / Variables` with info text, no Ctrl-Space |
| 2. Badge and squiggle agree | Both come from `forEachDiagnostic` on one lint state; the second system is deleted |
| 3. Errors are plural and revisitable | `[{x:1, x:2}, {y:1, y:2}]` → badge **"✗ 2 errors"**, 2 squiggles, panel listing both with `eslint:no-dupe-keys` |
| 4. Gutter dot opens the panel | Opens (see the correction below — the first implementation did not) |
| 5. Light-mode selection | **5.48:1** measured (text `#4A5663` on the composited selection). Dark: **4.95:1**, and now the brand token rather than CM's `#233` |
| POL-017 gutter numbers | **4.67:1** light, **4.82:1** dark on `fg-default-shy` |
| No false positives | `Inputs.a > 5 ? 'big' : 'small'`, `{ a: 1, b: 2 }`, `Math.round(price * 1.2)` all "✓ Valid" |

### Two things this spec got wrong

**Criterion 3's first half is not achievable and has been rewritten.** "`function f() {` … the error
stays on line 1" assumed a linter swap would move the anchor. Measured against ESLint 10 before
building on it: an unterminated block is reported at **end of input** by acorn, exactly as Lezer
does — and as TypeScript and VS Code do. No parser points at the opening brace. Syntax errors are
also fatal-and-first: only *rule* violations come in plural. That is where the value of the
dependency actually is (`no-undef` catching `totl` at its column, `no-dupe-keys` twice in one pass),
and it is pinned in `esLintDiagnostics.test.ts` under "the limits, recorded on purpose".

**Slice 4's obvious implementation is a no-op.** `EditorView.domEventHandlers` registers on the
**content element** (`@codemirror/view` `index.d.ts:1193`), and gutters are siblings of the content —
so the handler never sees a gutter click. It typechecked, it read correctly, and it did nothing;
only driving it caught that. It is now a `ViewPlugin` with a listener on `view.dom`.

### Also done here

- `jsValidator.ts` and its 24 tests are **deleted**; `isValidatedType` moved to `modes.ts` (the
  mode table it always belonged to) and `ValidationResult` left the public API with no consumers.
- The theme's `dark` flag is now read from the document root and **reconfigured through a
  compartment** on a live editor, so flipping the app theme with a popout open is correct. All
  three editors (`JavaScriptEditor`, `MarkdownEditor`, `CodeDiffView`) take `openNoodlTheme()`.
- The selection rule needed the full 4-class selector, not just the corrected flag: CM's
  `&dark.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground` out-specifies a
  two-class rule, and measurement showed our token had **never** reached the selection in dark mode.
- New deps on `noodl-core-ui`: `eslint-linter-browserify` (one package, no transitive additions) and
  `globals`. `package-lock.json` is deliberately **not** in the commit — it carries another
  session's pruning; CI runs `npm install`, not `npm ci`.
