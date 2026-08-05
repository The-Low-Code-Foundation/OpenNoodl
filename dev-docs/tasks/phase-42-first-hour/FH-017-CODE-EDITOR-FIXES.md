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

## Slice 2 — one error system, debounced

Delete System B: `jsValidator.ts`'s per-keystroke synchronous `new Function()` validation
(`JavaScriptEditor.tsx:63-112`) and its single-error panel (`:306-325`). Drive the toolbar badge
from the lint state instead (`diagnosticCount`), which is already debounced at 750ms. Keep
`validationTypeForEditType` (`CodeEditorType.ts:42-57`) — that's the port→language mapping, not
part of System B.

## Slice 3 — errors at real positions, plural, revisitable

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
3. `function f() {` then two more lines: the error stays on line 1, is hoverable, and the
   diagnostics panel lists it; two independent errors both appear.
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
