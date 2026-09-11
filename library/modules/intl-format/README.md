# Intl Format

Locale-aware formatting nodes built on the browser's built-in `Intl.*` APIs.
No dependencies, no network, no API keys — everything runs client-side.

After installing you get four nodes (category **Intl Format**) plus a demo
component (`/Intl Format Demo`) that wires each node to a Text node.

Every node has a **Locale** input (a BCP 47 tag such as `en-US`, `de`, `sv-SE`).
Leave it empty to use the browser language (`navigator.language`). Every input
is guarded: an unconnected or invalid input yields an empty `Formatted` string
instead of throwing.

## Relative Time

Turns a date into a phrase like *"3 hours ago"* or *"in 2 days"*
(`Intl.RelativeTimeFormat`).

| Port | Notes |
|---|---|
| Date (input) | A Date, epoch-milliseconds number, numeric string, or date string. |
| Style (input) | `long` / `short` / `narrow`. |
| Numeric (input) | `auto` allows "yesterday"; `always` forces "1 day ago". |
| Refresh Interval (s) (input) | `> 0` re-formats on that interval so "just now" keeps aging; `0` (default) formats once per input change. |
| Formatted (output) | The phrase. |
| Updated (output) | Signal fired on every (re)format, including refresh ticks. |

## Format Number

`Intl.NumberFormat` with `decimal`, `currency` and `percent` styles.

| Port | Notes |
|---|---|
| Value (input) | The number to format. |
| Style (input) | `decimal` / `currency` / `percent`. Percent multiplies by 100, so `0.25` renders as `25%`. |
| Currency Code (input) | ISO 4217 code (`USD`, `EUR`, `SEK`…), used only when Style is currency. An invalid code falls back to plain decimal formatting. |
| Minimum / Maximum Decimals (inputs) | Optional fraction-digit bounds. |
| Use Grouping (input) | Set false to drop thousands separators. |
| Formatted (output) | The formatted string. |

## Format List

`Intl.ListFormat` — joins items with a localized *and*/*or*.

| Port | Notes |
|---|---|
| Items (input) | An array, or a comma-separated string (`"A, B, C"`). |
| Type (input) | `conjunction` ("A, B and C") or `disjunction` ("A, B or C"). |
| Style (input) | `long` / `short` / `narrow`. |
| Formatted (output) | The joined string. |

## Pluralize

`Intl.PluralRules` — picks the right word form for a count.

| Port | Notes |
|---|---|
| Count (input) | The number. |
| Singular (one) (input) | Form used for the CLDR `one` category (e.g. `item`). |
| Plural (other) (input) | Form used for every other category (e.g. `items`). |
| Include Count (input) | On (default) prefixes the locale-formatted count: "3 items". Off outputs just the form. |
| Formatted (output) | The result. |
| Plural Category (output) | The raw CLDR category (`one`, `other`, `few`, …) if you need finer control. |

Languages with more than two plural categories (e.g. Polish, Arabic) map every
non-`one` category to the *Plural (other)* form; use the **Plural Category**
output with a String Mapper if you need per-category forms.
