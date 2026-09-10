# Format Date

Formats a date you already have, by name: "long" gives Thursday 10th September 2026, "time" gives 3:05 pm, "datetime", "short", "iso" — or pass Format to write your own token string. Wraps the Date To String node so an app asks for a shape instead of remembering twenty-one tokens, and passes Locale through, so weekday and month names follow it. NOT the same thing as the intl-format module: that one formats against the clock ("3 hours ago", auto-refreshing) and formats numbers, lists and plurals. This part formats a date you hold. Logic only — wire Text into a Text node.

## What installs

- `/Parts/Format Date`

Place it by using `/Parts/Format Date` as a node type.

## Notes from the author

Inputs: **Date** (a date), **Style** (`short` | `date` | `long` | `time` | `datetime` | `iso`, default `date`), **Format** (a Date To String token string, which wins over Style when set), **Locale** (a BCP-47 tag such as `fr-FR`; empty means `en-US`). Output: **Text**.

The presets are written in the Date To String vocabulary, so anything you can put in Format, you could have put in a preset. `{dayName} {dayShort} {monthName} {monthShort}` follow Locale; `{ordinal}` is English and deliberately so.

### When to install intl-format instead

This part answers "what does this date say?". The `intl-format` module answers "how long ago was it?" and "how do I write 1,024, or a list, or 3 items?" — a `Relative Time` node with an auto-refresh interval, plus `Format Number`, `Format List` and `Pluralize`. They do not overlap, and an app that shows both a post date and a "posted 3 hours ago" wants both.
