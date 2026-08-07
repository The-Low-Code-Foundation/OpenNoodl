---
title: "Date To String"
---
Formats a date into a string using {year}/{month}/{date}/{hours}-style tokens.

Date To String takes a date on `input` (Date) — a Date object, or a date string which it converts with `new Date()` — and writes a formatted string to `currentValue` (Date String) according to `formatString` (Format). Supported tokens: {date} (day of month, 2-digit), {month} (2-digit), {monthShort} (e.g. "Jan", en-US), {year} (4-digit), {yearShort} (2-digit), {hours}, {minutes}, {seconds} (all 2-digit, 24-hour); anything else in the format passes through literally. The default format is "{year}-{month}-{date}". Each time formatting runs, `inputChanged` (Date Changed) fires; if the input is not a usable date, `currentValue` becomes an empty string and `onError` (Invalid Date) fires instead of throwing. CWF-011 added a Timezone input: leave it empty (the default) and it formats in the host machine's zone exactly as it always has; set an IANA name like Europe/London or America/New_York and the same instant is rendered in that zone instead — including the date, which rolls when the zone crosses midnight. An unknown zone name is treated as an unreadable date: `currentValue` empties and `onError` fires, rather than silently falling back to local.

## When to use it

Use it to display timestamps — record creation dates, 'last saved' times — without writing code. For formats beyond these tokens (locale-aware dates, relative times like '2 h ago'), use a Function node with Intl or a date library. Note there is no {day}-of-week token. On a server the host zone is whatever the container says, so set Timezone explicitly for anything a user reads.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `Date To String` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `formatString` | String | `{year}-{month}-{date}` | Template in which {year} {yearShort} {month} {monthShort} {date} {hours} {minutes} {seconds} are replaced and everything else is copied through |
| `input` | Date | — | The instant to render; a string arriving here is parsed as a date first |
| `timeZone` | String | `` | IANA zone name to render in, such as Europe/London or America/New_York. Leave empty for the host machine's zone — which on a server is whatever the container says, and is the usual reason a date is an hour out in production but right on your laptop |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `currentValue` | String | — | Date rendered through Format, or blank when the date could not be read |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `inputChanged` | Signal | — | Fires whenever a new Date arrives or Format changes, after Date String has been updated |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `onError` | Signal | — | Fires when the Date could not be read, leaving Date String blank |

## Patterns

- A Function output producing `new Date()` on demand → `input`: timestamp an event, then show `currentValue` in a String Format sentence.

## Watch out for

- Wiring a number (epoch milliseconds) to `input` — number does not cast to date; convert to a Date in a Function or Expression first.
- Relying on the host zone in a cloud function. It is the container's zone, not your user's, and it is the usual reason a date is right locally and an hour or a day out in production.

## Examples

**Debounced autosave with timestamped status**

The debounce idiom: every keystroke fires Value Changed, whose signal restarts a 1.5-second Timer — the save only runs when the user pauses. The save Function stamps the moment; Date To String formats it, Unique Id issues a save id shortened by Substring, and String Format assembles the status line. Signals sequence the flow; values shape the display.

## Related nodes

[String Format](../string-manipulation/string-format.md), [Function](../custom-code/java-script-function.md), [Expression](../custom-code/expression.md), [Date Parts](./net-noodl-date-parts.md), [Now](./net-noodl-now.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
