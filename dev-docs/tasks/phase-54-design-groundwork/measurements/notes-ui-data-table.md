# `ui-data-table` — what was built, and the numbers that prove it

DSG-003 §3, row 2. The named trap: *a table **is** a Repeater over a row component — the recipe's
job is to make that obvious.* Authored against a render, not from taste, per §2 rule 1.

## The arrangement

Two components, 18 + 10 nodes.

```
/Pages/Members
  Page
  └ Group  Band            width 100%, column, alignItems center, pad-y --space-16
    └ Group  Shell         width 100%, maxWidth 1200, pad-x --space-6
      ├ Text   caption     "Members"
      └ Group  Scroller    flexDirection row, scrollEnabled, nativeScroll   ← the 390px answer
        └ Group  Table     width 100%, minWidth 720px, column, surface + hairline + radius + clip
          ├ Group  Header  row, alignItems center, pad-y --space-3   → 4 cells  34 / 30 / 18 / 18 %
          └ Group  Body    column
            └ For Each     template /Components/MemberRow
  Static Data  members     4 records, inline JSON      → items → For Each.items

/Components/MemberRow
  Group  Row               width 100%, row, alignItems center, pad-y --space-3, hairline bottom
   ├ Group 34% → Text name
   ├ Group 30% → Text email
   ├ Group 18% → Text role
   └ Group 18% → Group pill (sizeMode contentSize) → Text status
  Component Inputs  name / email / role / status — every port `plug: "output"`
```

There is exactly **one** row component. Nothing about the table grows when the data does — which is
the whole point, and the sentence the `demonstrates`/`description` carry so a search for
"duplicated rows" finds this file.

**Static Array, not Query Records, on purpose.** `repeater-query-records` already owns the
query→repeater wiring and DSG-003's acceptance forbids duplicating it. It is also what makes this
recipe *renderable in the disk harness at all* — a `DbCollection2` with no backend yields zero
items, and a table measured with zero rows cannot prove a column contract. The description says
swap it for `DbCollection2` and nothing else changes.

## The column-sizing convention

There is no `<table>`, and a flex row will not line itself up. One rule, stated once and obeyed in
two places:

> **Every cell is a Group with an explicit percentage width; the percentages sum to exactly 100;
> the header Group and the row component's root Group declare the SAME list.** Here `34 / 30 / 18 / 18`.

Three supporting rules, each of which was measured (below):

1. **No horizontal padding on the header, the row root, or the table.** All of it lives *inside*
   the cells (`--space-4` each side). Header content box === row content box, so the columns cannot
   drift.
2. **No `columnGap` on either row.** A gap is subtracted from the 100%, so a gap on one and not the
   other shifts them by different amounts.
3. **Groups default to `boxSizing: border-box`** (`node-shared-port-definitions.ts:322`), so a
   cell's own padding is *inside* its 34%, not added to it. Measured: a 391px cell with
   `padding: 0 16px` and computed `box-sizing: border-box`.

Vertical padding goes on the header and the row root, never on a cell, so every cell in a row
shares one baseline.

## The measurement

`example-to-project.js` → `render:report`, then a scratch CDP probe reading
`getBoundingClientRect()` on the header cells and on all four rendered rows.

```
ui-data-table — 0 errors, 1 warning (elements-overflowing).
  desktop 1280px → layout 1280px, page 900px, 21 texts / 3 sizes / weights 400+500+600, 0 placeholders
  phone    390px → layout 390px, page 844px, 21 texts / 3 sizes / weights 400+500+600, 0 placeholders
```

21 texts = 1 caption + 4 header labels + 4 rows × 4 cells. The rows really drew; this is not the
"rendered clean means nothing was drawn" case.

### Column alignment — desktop, 1280px

| | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|
| header cell `x` | 65 | 456 | 801 | 1008 |
| header cell width | 391 | 345 | 207 | 207 |
| every row's cell `x` | 65 | 456 | 801 | 1008 |
| every row's cell width | 391 | 345 | 207 | 207 |

**max \|header − body\| over x and width, across all four rows: `0px`.** 391+345+207+207 = 1150 =
the table's content width (1152 box − 2×1px border). 34/30/18/18 % of 1150 = 391/345/207/207 exactly.

### Column alignment — phone, 390px

| | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|
| header cell `x` | 25 | 269.13 | 484.53 | 613.77 |
| header cell width | 244.13 | 215.41 | 129.23 | 129.23 |
| every row's cell `x` | 25 | 269.13 | 484.53 | 613.77 |
| every row's cell width | 244.13 | 215.41 | 129.23 | 129.23 |

**max \|header − body\|: `0px`** here too.

### What happens at 390px

The table does **not** squeeze — 18% of 342px would be a 61px Role column. It keeps `minWidth: 720px`
and the scroller takes the strain:

```
scroller  overflow-x: auto   clientWidth 342   scrollWidth 720     ← 378px of sideways scroll
table     overflow-x: hidden clientWidth 718   minWidth 720px
document.documentElement.scrollWidth = 390 = the viewport — the PAGE never scrolls sideways
```

The whole table moves as one object, which is exactly what keeps the header nailed to its columns.
A header that scrolls independently of its rows is the classic version of this bug, and it is
unreachable by construction here because the header and the body are inside the same scrolled box.

### Negative controls — the convention is load-bearing, not decoration

Two deliberate breakages, each rendered and measured the same way:

| control | change | measured drift (desktop / phone) |
|---|---|---|
| **A** | `paddingLeft/Right: --space-4` on the **row root only** (the obvious "give the row some breathing room" edit) | **16px** — body cells at x 81 / 461.13 / 796.53 / 997.77 against a header at 65 / 456 / 801 / 1008; the last column also loses 6px of width |
| **B** | `columnGap: --space-2` on the **header only** | **8.44px** desktop, **8.63px** phone — header cells at 65 / 455.56 / 801.22 / 1012.11 against a body at 65 / 456 / 801 / 1008 |

Both changes are individually reasonable-looking, both pass `catalog:examples`, and neither is
visible in the summary line of a render report. That is F14 in miniature.

## What did NOT work

- **`net.noodl.visual.columns` with a `layoutString` as the shared contract.** This was the first
  design and it is genuinely more elegant — `"3 2 2 1"` in the header and the same string in the
  row is a very legible contract. It was abandoned over `marginX`; see the defect below.
- **Cells as bare `Text` nodes with a percentage width.** `Text` has no `padding*` and no
  `boxSizing` inputs at all (catalog: `Text.inputs` has `margin*`, `min/maxWidth`, no padding), so
  there is nowhere to put the gutter. A cell has to be a Group; the Text inside it is left alone at
  its default `width: 100%` / `sizeMode: contentHeight`.
- **Hardcoding a fallback `text` on the four Texts a `Component Inputs` node feeds.** The first
  render threw **2 errors, `dead-placeholder-text`** — and they were false positives: the fallbacks
  I chose (`"Name"`, `"Viewer"`, `"Active"`) collided with the header label and with real values in
  the static data, so the detector matched strings that had in fact arrived. Removing the fallbacks
  entirely is the right fix anyway — the diagnostic's own sentence is *"that value is only ever
  visible when the input does not arrive"* — and the render went to **0 errors, 0 placeholders**.
  Worth knowing before the next recipe: `ui-card-grid-repeater` still ships `text: "Title"` and
  `text: "Tagline"` on Component-Inputs-fed ports.

## Defects found

### 1. 🔴 `Columns.marginX` is read by `parseFloat`, so a design token collapses the row

`Columns.tsx:461` builds the container as
`marginLeft: parseFloat(props.marginX) * -1` and `width: calc(100% + ${parseFloat(props.marginX)}px)`.
`parseFloat("var(--space-3)")` is `NaN`, so the `width` declaration is invalid and is dropped —
and the container falls back to shrink-to-fit. Measured, two identical probe projects, one column
row of three Texts at `layoutString: "1 1 1"`, desktop 1280:

| `marginX` | container width | container `marginLeft` | each item |
|---|---|---|---|
| `{value: 12, unit: "px"}` | **1292px** (`calc(100% + 12px)`) | −12px | 430.66px |
| `"var(--space-3)"` | **175.05px** (style width empty) | 0px | **58.34px** |

The row renders at **14%** of its intended width, and every percentage-width child with it. The
half that *does* work is the giveaway: `paddingLeft: props.marginX` is handed to React as a string
and CSS resolves it to 12px correctly, so the gutters look right while the layout is destroyed —
it reads as a subtle spacing bug, not a broken container. It is the same failure mode Columns'
own SSR comment documents ("width and box-sizing both vanished, the container fell back to
shrink-to-fit").

This matters beyond this recipe: the doctrine tells an agent to write every spacing value as
`var(--token)`, `catalog:tokens` will happily resolve `--space-3`, `catalog:examples` passes, and
the only shipped Columns recipe (`ui-card-grid-repeater`) uses a raw `12px` there with nothing
saying it has to. `marginY` has the same shape.

Not filed as a change — I own one file in this task. Suggested repair: resolve the token in the
node before the `parseFloat`, or emit the container's `marginLeft`/`width` as CSS strings
(`calc(100% + var(--space-3))`) and let CSS do the arithmetic.

### 2. ⚠️ `elements-overflowing` cannot see a scrolling ancestor

`packages/nodegx-render-measure/src/index.js:691-706` fires `ElementsOverflowing` whenever elements
are wider than the viewport *and the document does not scroll sideways*, and asserts each is
"clipped by an ancestor rather than reachable". It never asks whether an ancestor scrolls. A
deliberately horizontally-scrollable region — the standard responsive-table answer, and the one
this recipe ships — is reported as unreachable while `scroller.scrollWidth` is 720 against a
`clientWidth` of 342. The recipe's one remaining render warning is this false positive.

Cheap repair: before adding the finding, walk each overflowing element's ancestors for
`overflow-x: auto|scroll` with `scrollWidth > clientWidth`, and drop it if one is found (or
downgrade the sentence to "reachable only by scrolling <ancestor>").

## Gates

- `validate-examples.ts --dir <isolated>` → **1/1 clean** (strict, warnings-as-errors).
- `npm run catalog:examples` → **61/61 clean** corpus-wide (with the other four sessions' recipes in
  the tree).
- `npm run catalog:tokens` → **418 references across 66 files all resolve**. This recipe uses 25
  distinct tokens, all in `DEFAULT_TOKENS`.
- Every `Component Inputs` port declares `plug: "output"` explicitly — 4 of them, and
  `checkComponentPortDirection` is clean.
