# POL-017 — every code editor's line numbers are below the text contrast floor

**Found** 2026-08-04 (seventh session), while verifying
[POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md)'s criterion 1 in the running editor. It is
**not** POL-004's defect and was not caused by its fix — the doc-review sheet is correct in both
themes. This is what the same measurement found sitting on top of it.

**Status:** ☑ **FIXED 2026-08-06**, with one thing owed. Both failing elements are fixed, not just
the gutter — see [What was actually changed](#what-was-actually-changed) at the bottom, and note the
correction to criterion 4, which as originally written asked for more than the proposed fix
delivered. ⚠️ The `pol004-doc-diff.js` re-run that criterion 4 names has **not** been done; §5 says
why and what is left.

It gets a row because that is now the phase's rule: a finding recorded only as prose inside a
completed task is a finding that has been lost. That is the whole reason
[POL-016](POL-016-THE-TWO-FINDINGS-POL-005-FILED.md) exists.

## What was measured

`pol004-doc-diff.js` opens the doc-review diff modal on a real diff and measures every text node in
it against the surface it is painted on. The sheet passes. Ten nodes do not:

| | dark | light |
|---|---|---|
| gutter line numbers (`fg-muted` on `bg-3`) | `#6b7682` on `#222933` = **3.17:1** | `#7c8894` on `#ecf0f4` = **3.16:1** |
| the change summary line (`fg-muted` on the sheet) | `#6b7682` on `#12161b` = **3.93:1** | `#7c8894` on `#ffffff` = **3.62:1** |

WCAG 1.4.3 asks **4.5:1** for body text. Line numbers are text, and at this size there is no
large-text exemption to fall back on.

## The mechanism — one line, and it is not local to this dialog

[`codemirror-theme.ts:60`](../../../packages/noodl-core-ui/src/components/code-editor/codemirror-theme.ts#L60)
sets `.cm-gutters { color: var(--theme-color-fg-muted) }`. That is the theme for **every** CodeMirror
surface in the editor — `JavaScriptEditor`, `MarkdownEditor` and `CodeDiffView` all share it — so the
doc-review modal is where this was *seen*, not where it lives. `fg-muted` is used the same way at
line 100 and line 225.

The token is not being misused the way POL-004's `secondary` was. `colors.css` documents `fg-muted`
as *"large/secondary text only"*, and this is small text. It is the right token for the wrong size.

There is a neat coincidence worth not misreading: `fg-muted` is the exact value POL-016 chose for
`--theme-color-border-control`. That is correct there and wrong here, because the bars are different
— **3:1 for a non-text control boundary (1.4.11), 4.5:1 for text (1.4.3)**. The same tone passes one
and fails the other.

## The answer, already measured

`fg-default-shy` is the smallest step up that clears 4.5:1 on the gutter in both themes:

| candidate | dark on gutter | light on gutter | |
|---|---|---|---|
| `fg-muted` (today) | 3.17:1 | 3.16:1 | fails |
| **`fg-default-shy`** | **4.82:1** | **4.67:1** | **passes, and is the smallest change that does** |
| `fg-default` | 6.66:1 | 6.54:1 | passes, but stops the gutter reading as secondary at all |

## Criteria

1. Gutter line numbers measure ≥4.5:1 against the gutter in both themes, in a real code editor and
   in the doc-review diff.
2. The change is swept, not assumed: `fg-muted` appears three times in `codemirror-theme.ts` and each
   is a different element with a different background — measure each rather than replacing all three.
3. The gutter still reads as *secondary* to the code beside it. Clearing the bar by making line
   numbers as prominent as the source is not the fix.
4. `pol004-doc-diff.js` reports zero text nodes below 4.5:1 in both themes.

   ⚠️ **This criterion was wider than this task's own proposed answer, and that is now resolved by
   widening the fix rather than narrowing the criterion.** The measurement table above lists *two*
   failing elements; §"The answer, already measured" proposes a token for only one of them. Fixing
   the gutter alone would have left the change-summary line at 3.93/3.62 and the criterion would
   have read as met while the measurement still failed — the exact shape of lie this phase's
   register rule exists to stop. The second element is fixed too; see below.

## Traps

- **The three `fg-muted` uses in that file are not interchangeable.** Line 60 is the gutter, line 100
  and line 225 are other elements on other backgrounds; a blanket replace changes contrast it was
  never asked to change.
- The gutter background is `bg-3`, not the sheet. Measuring against the sheet flatters it by ~0.8.
- **HMR will not restyle a mounted CodeMirror instance.** Restart the stack before believing a
  measurement.

## What was actually changed

### 1. The gutter — already fixed, and nobody said so

`codemirror-theme.ts` `.cm-gutters` was moved from `fg-muted` to `fg-default-shy` in **`00adecd5`**
(2026-08-05, "fix(code editor): one linter, Noodl. completes, and a selection you can see"), a commit
about the linter. It carried the POL-017 fix and its reasoning as a comment and left this file saying
"filed, not fixed" for a day. Worth recording as its own small lesson: **a fix that lands inside an
unrelated commit is a fix the register cannot see.** Verified today at
`codemirror-theme.ts:94-100`. `fg-default-shy` on `bg-3` = **4.82:1 dark / 4.67:1 light** (was
3.17/3.16).

### 2. The sweep trap, resolved — there are now only *two* `fg-muted` uses left in that file

The task warned that three uses sit on three backgrounds. One of the three *was* the gutter, so after
the fix above the count is two, and **both are correctly left alone**:

| line | element | background | why it stays `fg-muted` |
|---|---|---|---|
| `:136` | `.cm-foldPlaceholder` | `bg-hover` over `bg-2` | A collapsed-region marker (`…`), not prose. It is a placeholder glyph, and the surrounding source is the text being read. |
| `:261` | `.cm-placeholder` | `bg-2`, and it carries `opacity: 0.6` besides | Empty-editor placeholder text. Placeholder text is the one case where "muted" is the intent, and raising it would make an empty editor look like it had content. |

Neither is text a reader is expected to *use*, which is the line the gutter crossed. This is also why
`--theme-color-border-control` (POL-016) keeps the same tone and is **not** a bug: 1.4.11 asks 3:1 of
a control boundary, 1.4.3 asks 4.5:1 of text, and `fg-muted` passes the first and fails the second.

### 3. The second failing element — `TextType.Shy`

The change-summary line in the doc-review dialog is `<Text textType={TextType.Shy}>`
(`PlanDocReviewDialog.tsx:56`). It is not a dialog-local colour: `Text.module.scss` `is-type-shy`
mapped straight to `fg-muted`, which is the 3.93:1 / 3.62:1 in the table above and is the same token
misuse the gutter had — `colors.css` documents `fg-muted` as *"large/secondary text only"* and `Text`
renders at 12px (10px at `Small`), so there is no large-text exemption.

Fixed at the token mapping rather than the call site, for the same reason the gutter was: 257 call
sites across 59 files all inherit the defect, and patching one dialog leaves 256.
`Label.module.scss` `is-variant-shy` had the identical mapping and is changed with it — the two read
the same `TextType` enum, so leaving one behind would have manufactured a twin.

| | before (`fg-muted`) | after (`fg-default-shy`) |
|---|---|---|
| on `bg-1` (the review sheet) | 3.93 dark / 3.62 light | **5.98 / 5.34** |
| on `bg-2` | 3.66 / 3.43 | **5.57 / 5.06** |
| on `bg-3` | 3.17 / 3.16 | **4.82 / 4.67** |

**Why this is safe at 257 sites:** `fg-default-shy` is one step *toward* the foreground extreme in
both themes (dark `#6b7682` → `#8b95a1`, light `#7c8894` → `#616c79`), so contrast rises against
every background in the palette — there is no surface where this makes anything worse. And criterion
3's spirit holds: `shy` remains dimmer than `fg-default`, so the hierarchy the type exists to express
survives.

⚠️ **Deliberately not changed:** `Icon` `is-variant-shy` still resolves `fg-muted`. An icon is a
non-text graphic under 1.4.11 at 3:1, which `fg-muted` clears on `bg-1` (3.93) and `bg-2` (3.66).
Raising it would be the mirror of the POL-016 mistake this task warns about.

### 4. How the CSS was verified to win

A ratio computed from a stylesheet proves what the stylesheet says, not what the browser painted.
Checked in the running editor over CDP, read-only, in both themes: the CSSOM contains **exactly one**
rule matching `Text-module__is-type-shy` and **exactly one** matching
`Label-module__is-variant-shy`, both resolving `var(--theme-color-fg-default-shy)`, so no selector
can out-rank them. Token values read live off `:root` in each theme match `colors.css`
(`fg-default-shy` = `#8b95a1` dark, `#616c79` light). Same check for the three
`.popup-layer-*` rules AAQ-011 F1 changed in the same pass.

### 5. What is still owed

**`pol004-doc-diff.js` has not been re-run.** Both elements its last run reported below 4.5:1 are
fixed, and the ratios above are computed from the same token values the harness measured — but that
is a derivation, not a re-measurement, and this file should not claim otherwise. The re-run needs the
scripted-provider drive of the AI panel and a restarted stack (see the HMR trap above); the editor
was in another session's hands when this landed. **Criterion 4 is therefore satisfied by
construction, not yet by the harness** — re-run it in the next session that owns the editor.
