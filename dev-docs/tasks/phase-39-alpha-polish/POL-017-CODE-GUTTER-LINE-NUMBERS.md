# POL-017 — every code editor's line numbers are below the text contrast floor

**Found** 2026-08-04 (seventh session), while verifying
[POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md)'s criterion 1 in the running editor. It is
**not** POL-004's defect and was not caused by its fix — the doc-review sheet is correct in both
themes. This is what the same measurement found sitting on top of it.

**Status:** ☐ filed, not fixed. Not alpha-blocking — the numbers are legible, just under the bar.

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

## Traps

- **The three `fg-muted` uses in that file are not interchangeable.** Line 60 is the gutter, line 100
  and line 225 are other elements on other backgrounds; a blanket replace changes contrast it was
  never asked to change.
- The gutter background is `bg-3`, not the sheet. Measuring against the sheet flatters it by ~0.8.
- **HMR will not restyle a mounted CodeMirror instance.** Restart the stack before believing a
  measurement.
