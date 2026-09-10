---
title: "Date To String"
---
Formats a date into a string with {year}/{monthName}/{dayName}/{h12}-style tokens, in any language.

Date To String takes a date on `input` (Date) — a Date object, or a date string which it converts with `new Date()` — and writes a formatted string to `currentValue` (Date String) according to `formatString` (Format). Supported tokens, for Thursday 10 September 2026 at 15:05:07: {date} 09 and {d} 9 (day of month), {ordinal} 9th, {month} 09 and {m} 9, {monthShort} Sep, {monthName} September, {year} 2026, {yearShort} 26, {dayName} Thursday, {dayShort} Thu, {hours} 15 and {h} 15 (24-hour), {hours12} 03 and {h12} 3 (12-hour), {ampm} pm and {AMPM} PM, {minutes} 05 and {min} 5, {seconds} 07 and {s} 7; anything else in the format passes through literally. The default format is "{year}-{month}-{date}". Each time formatting runs, `inputChanged` (Date Changed) fires; if the input is not a usable date, `currentValue` becomes an empty string and `onError` (Invalid Date) fires instead of throwing. CWF-011 added a Timezone input: leave it empty (the default) and it formats in the host machine's zone exactly as it always has; set an IANA name like Europe/London or America/New_York and the same instant is rendered in that zone instead — including the date, which rolls when the zone crosses midnight. An unknown zone name is treated as an unreadable date: `currentValue` empties and `onError` fires, rather than silently falling back to local. CMP-005 added the weekday, full month name, 12-hour, unpadded and ordinal tokens, and a Locale input: leave Locale empty (the default) and every name renders in English exactly as it always did, or set a BCP 47 tag like fr-FR and {monthName}, {monthShort}, {dayName} and {dayShort} render in that language. {ordinal} stays English — Intl gives the ordinal category, not the suffix string. Locale and Timezone are independent: a French app can render a Tokyo instant.

## When to use it

Use it to display timestamps — record creation dates, 'last saved' times, "Thursday, 10 September 2026 at 3:05 pm" — without writing code. It covers weekdays, full and short month names, 12-hour clocks, unpadded numbers, ordinals and any language, so reach for the tokens before reaching for a Function node. The one thing it deliberately does not do is RELATIVE time ('2 h ago'), which depends on the current moment rather than on the date it is given and so needs a clock, not a token. On a server the host zone is whatever the container says, so set Timezone explicitly for anything a user reads.

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
| `formatString` | String | `{year}-{month}-{date}` | Template in which these tokens are replaced and everything else is copied through. Date: {date} 09, {d} 9, {ordinal} 9th. Month: {month} 09, {m} 9, {monthShort} Sep, {monthName} September. Year: {year} 2026, {yearShort} 26. Weekday: {dayName} Thursday, {dayShort} Thu. Time: {hours} 15, {h} 15, {hours12} 03, {h12} 3, {minutes} 05, {min} 5, {seconds} 07, {s} 7, {ampm} pm, {AMPM} PM. Names follow Locale; {ordinal} is English |
| `input` | Date | — | The instant to render; a string arriving here is parsed as a date first |
| `locale` | String | `` | BCP 47 language tag for the month and day names — fr-FR, de-DE, ja-JP. Leave empty for English (en-US), which is what every project rendered before this port existed. It does not change the digits, the padding or {ordinal}, only the words |
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
- {dayName}, {d} {monthName} {year} → "Thursday, 10 September 2026", and {h12}:{minutes} {ampm} → "3:05 pm". These are the two formats an app asks for most and neither was reachable before CMP-005.

## Watch out for

- Wiring a number (epoch milliseconds) to `input` — number does not cast to date; convert to a Date in a Function or Expression first.
- Relying on the host zone in a cloud function. It is the container's zone, not your user's, and it is the usual reason a date is right locally and an hour or a day out in production.
- Writing a Function node with Intl to get a weekday or a localised month name. That was the documented workaround until CMP-005 and it is now a component's worth of code replacing one token.

## Examples

**Dates a person would read, without a Function node**

One instant from Now, rendered three ways by three Date To String nodes — no JavaScript anywhere. The headline uses the weekday and the full month name ({dayName}, {d} {monthName} {year} → "Thursday, 10 September 2026"); the time uses the 12-hour clock and a meridiem ({h12}:{minutes} {ampm} → "3:05 pm"); the third is the same headline with Locale set to fr-FR, which translates the month and day NAMES and nothing else. Tokens are the whole vocabulary: {d} {m} {h} {min} {s} are the unpadded numbers, {date} {month} {hours} {minutes} {seconds} the padded ones, and anything the node does not recognise is copied through unchanged — which is why a moment/date-fns pattern like HH:mm:ss renders as the literal text HH:mm:ss rather than a time.

**Debounced autosave with timestamped status**

The debounce idiom: every keystroke fires Value Changed, whose signal restarts a 1.5-second Timer — the save only runs when the user pauses. The save Function stamps the moment; Date To String formats it, Unique Id issues a save id shortened by Substring, and String Format assembles the status line. Signals sequence the flow; values shape the display.

## Related nodes

[String Format](../string-manipulation/string-format.md), [Function](../custom-code/java-script-function.md), [Expression](../custom-code/expression.md), [Date Parts](./net-noodl-date-parts.md), [Now](./net-noodl-now.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
