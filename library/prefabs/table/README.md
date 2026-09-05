# Table

Rows in, table out. Columns come from your data unless you say otherwise, and
each cell picks its own renderer from the type of the value in it.

```
┌───────────────────┬─────────────┬──────────┬────────┐
│ Name              │ Team        │ Projects │ Active │
├───────────────────┼─────────────┼──────────┼────────┤
│ Ada Lovelace      │ Engineering │       12 │   ✓    │
│ Grace Hopper      │ Engineering │        8 │   ✓    │
│ Alan Turing       │ Research    │        5 │        │
└───────────────────┴─────────────┴──────────┴────────┘
```

Out of the box it renders those five sample rows, so you see what it is the
moment you drop it on a page.

## Feeding it your rows

1. **Connect the `Items` input** to any array — records from a query, a REST
   response, a Function output. A non-empty connected array wins over the
   built-in samples.
2. **Edit the samples**: inside the **Table** component, the **Sample rows**
   Static Data node holds the demo JSON.

With nothing on `Headers`, every key found across your rows becomes a column,
in the order the keys first appear, labelled with the key itself.

## Declaring your columns

Connect `Headers` to an array and you choose which columns exist, in what
order, and what they are called:

| Property | What it does |
|---|---|
| `Field` | The key on each row this column reads |
| `Label` | The column heading |
| `Type` | Force a cell renderer — `String`, `Number`, `Boolean`, `Date`, `Image`. Unset, the cell picks from the value's own type |
| `Editable` | Cells in this column become an input, and edits report back through `Cell Changed` |
| `Sortable` | The heading becomes a sort control |
| `Width` | A CSS width for the column |

## Outputs

| Output | When |
|---|---|
| `Item Clicked` / `Item Id` | A row was clicked, and which record it was. |
| `Cell Changed` / `Item Id` / `Field` | An editable cell was edited. The value is already on the record; these tell you what to save. |
| `Sorting` / `Sorting Changed` | The field to sort by, `-` prefixed for descending, and a signal when the user changes it. Feed it back into your query. |

## Things worth knowing before you change it

**The fallback is a Function, not a default.** `Choose items` takes the
connected array and the samples and picks: a connected array with anything in
it wins, an empty or absent one falls through. That is what makes the samples
vanish the instant your data arrives rather than fighting it.

**`Extract Headers` is guarded now.** It used to reach straight into
`Inputs.Items.forEach`, and on a freshly placed Table — where nothing is
connected — that threw before a single row could arrive. An absent `Items` is
now an empty table, not an exception.

**It is a real CSS table.** The `Table classes` CSS Definition puts
`display: table` / `table-row` / `table-cell` on the Groups, which is what
makes columns line up across rows without you declaring widths. That is also
why cell padding lives in one place — the **Base Cell** component — and why
changing it there changes every cell.

**Row striping is a Color Blend**, not a style. `Row` computes odd/even from
its child index and blends between `Color 0` and `Color 1`; change those two
to restripe the table.

## Known: column `Width` does not reach the cell

`Extract Headers` hands each column a `Width` as the string `'1%'` (or whatever
you put on a header). The cell root's `Width` is a *dimension* port, which
expects `{ value, unit }` — a bare string has no `.value`, so the setter
**deletes** the prop and the column falls back to auto width. Every column in
every table therefore lays out by content, and a `Width` you declare on a
`Headers` row does nothing at all.

Rendered at 1280px the cost is visible: the widest text column takes most of
the table and the rest crowd against the right edge. Until this is fixed, size
columns from the **Base Cell** component's `CSS Style` instead.

The fix is to emit a dimension object rather than a string — but turning that
path on changes the layout of every column of every table, inside a
`display: table` composition, so it wants a render beside it rather than a
reading of this file.
