# TALK-002 — "Have we made a big mistake making a code editor DIY?" — No, and here's the evidence

Covers reported items **18** and **19** (strategy half — the mechanical fixes are
[FH-017](FH-017-CODE-EDITOR-FIXES.md)).

## The question you asked

> It feels like we've made a big mistake making a code editor DIY, can we not switch to something
> that just works out of the box and we adapt it to Noodl???

## The premise doesn't survive the evidence

**We did not build a DIY editor.** The editor is **CodeMirror 6** — ten first-party
`@codemirror/*` packages (`noodl-core-ui/package.json:38-47`), one `new EditorView({...})` mount
(`JavaScriptEditor.tsx:150-163`), and a 70-line array of **stock** extensions
(`codemirror-extensions.ts:209-279`). Zero hand-rolled view plugins. The "DIY" plan that exists in
the history (TASK-009, a textarea-based editor after Monaco broke in Electron) **was never shipped**
— commit `6f081635` shipped CM6 instead. CED-001 then did a whole "stop fighting the library" pass
whose non-goal was explicit: *"Replacing CodeMirror. Not with Monaco (retired for good reasons),
not with anything else. The answer here is less code on the same library."*

The genuinely bespoke surface is ~900-1,100 lines, and about half of it is a **duplicate error
system** (`jsValidator.ts` + the toolbar badge) that stock CM6 already covers — i.e. the fix is
deletion.

## Every reported symptom is an under-configuration, individually located

| Your symptom | Actual mechanism | Fix size |
|---|---|---|
| `Noodl.` shows nothing until `Noodl.V` | `noodl-completions.ts:62` — a guard returns null on the zero-length word after `.`, so the `Noodl.` branch at `:89` is unreachable. CED-001's own QA only ever tested `Noodl.V`. | 1 line — or better, `scopeCompletionSource` (already exported by our installed `lang-javascript`) completes from the **live** `Noodl` object |
| Error fires mid-typing | Two disagreeing error systems. The toolbar badge runs `new Function()` **synchronously on every keystroke** (`JavaScriptEditor.tsx:106-112`, no debounce, plus up-to-100ms of forced parsing). The inline squiggle is properly debounced at 750ms. | ~20 lines net **deletion** (kill system B) |
| Error vanishes on new line, can't revisit | Lezer emits the unclosed-bracket error as a zero-length node **at end of document**, so the squiggle follows you down the file and each lint pass replaces the set. Architectural to Lezer error-recovery; fixed by a real-position linter (`esLint()` — also already exported). | ~40 lines |
| Only one error shown | `new Function` throws on the first error by construction; the panel renders exactly one. CM's multi-error diagnostics panel exists and its keymap is **already bound** (`Mod-Shift-M`) — nothing surfaces it. | deletion + one button |
| Red dot not clickable | Stock CM lint gutter is hover-only (300ms delay), no click handler exists upstream. | ~10 lines |
| Light-mode selection invisible | `codemirror-theme.ts:240` — a hardcoded `{ dark: true }` forces CM's base **dark** selection (`#233`) at higher specificity than our token rule, under dark-navy light-mode syntax colors. Not a missing override — one wrong flag, shared by all three editor components. | 1-3 lines |

Full fix specs in FH-017. **Total: roughly a day, mostly deleting.** That is the baseline any
"switch to something else" must beat.

## What switching to Monaco would actually cost

- The reason it was removed is unfixed: web-worker `loadForeignModule` failure in this
  Electron+CommonJS build. You'd be debugging worker loading, not shipping features.
- Rewrites, not ports: CodeDiffView (MergeView), MarkdownEditor, read-only compartments, the
  CodeHistory diff modal, the popout plumbing.
- Monaco themes take literal hex — it has no equivalent of our `var()`-driven live theme flip, and
  collides with the hex-colour ratchet.
- The AI copilot seam (CED-001 Slice C) is designed on `@codemirror/merge`'s
  `unifiedMergeView`/accept/reject — a switch discards that design.

And "stock CodeMirror with standard extensions" would give us nothing — **we already are that**,
minus six rows of configuration.

## Where your instinct IS pointing at something real: types

`Noodl.` should complete because a language service knows what `Noodl` *is* — not because a
25-string hardcoded array (`noodl-completions.ts:21-54`) happens to contain it. That's the one
genuinely missing capability, it's what Monaco was originally wanted for, and both CED-001 Slice D
and `dev-docs/future-projects/TYPED-INTELLISENSE-REVIVAL.md` already establish it's reachable on
CM6 (generated `.d.ts` for Inputs/Outputs/Noodl API + `scopeCompletionSource`/`esLint`, no Monaco
tax).

## The decision I'd like from you

1. **Confirm: no editor switch.** Do FH-017 (the ~day of config fixes) now.
2. **Priority call on typed intellisense** (Slice D revival): it's the difference between
   "autocomplete works" and "autocomplete knows your project". Not alpha-blocking, but it's the
   feature your item 18 is really asking for. Schedule it as its own task or leave it in
   future-projects?
