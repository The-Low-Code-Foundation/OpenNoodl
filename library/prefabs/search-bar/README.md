# Search Bar

The light one. `filters` is a whole filter panel coupled to Query Records; this
is a field that tells you what was typed, once the typing stops.

## What comes out

| Output | When |
|---|---|
| `Query` | The trimmed text, published on the debounce. |
| `Changed` | Once, after the typing stops — **not** once per keystroke. Wire it straight at a Query Records' `Do`. |
| `Cleared` | The clear button was pressed. |

| Input | What it does |
|---|---|
| `Placeholder` | Field placeholder. |
| `Debounce` | Milliseconds of quiet before `Query` publishes. Default 300. |
| `Result Count` | A number to show beside the field — renders as `1 result` / `1,204 results`, and only while there is text. |

Pressing **Enter** skips the wait, because nobody who pressed Return wants
another 300ms.

## Three things that look right and are not

Every one of these was measured on this prefab, not imagined.

**`Timer`'s `Duration` is a plain number of milliseconds.** Hand it the
`{value, unit}` shape that every *dimension* port takes and it stores the
object, measures it as zero, and fires `Finished` on every `Restart`. The bar
then emits once per keystroke while looking, in the graph and on screen,
exactly like a working debounce. This is what the drive caught.

**The unticked box is the debounce.** `Emit query` has *Run on value change*
turned **off** for `Text` (`runOnChange-in-Text`). With it on — the default —
the node re-runs whenever the text changes and the Timer is decoration.

**The first run says nothing.** Every Function runs once at boot. Without the
baseline check at the top of `Emit query`, `Changed` fires before anybody has
typed and every listener runs a query for the empty string.

## Wiring it to data

`Changed` → your Query Records' `Do`, and `Query` → whatever builds the filter.
Feed the query's result count back into `Result Count` and the field reports
its own answer.
