---
title: "Substring"
---
Extracts part of a string between a start index (inclusive) and end index (exclusive).

Substring takes a `string` (String) input and outputs the characters from index `start` (Start, 0-based, inclusive) up to but not including index `end` (End) on the `result` (Result) string value output. While `end` has never been set, the substring runs from `start` to the end of the string — so a node with only `start` configured behaves like 'drop the first N characters'. Setting `end` to -1 also means 'to the end of the string'. Non-string inputs are converted with toString() first, and any input change updates the result immediately.

## When to use it

Use it for simple positional trims: a short prefix of an id, truncating a preview, slicing fixed-width data. For pattern-based extraction, case changes or search-and-replace, use Expression or a Function; for assembling text from parts, use String Format.

## At a glance

| | |
|---|---|
| Category | String Manipulation |
| Type name | `Substring` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `end` | Number | `-1` | Position to stop before; -1, the default, runs to the end of the string, and 0 yields an empty result |
| `start` | Number | `0` | Position of the first character to keep, counting from zero; a negative value counts back from the end |
| `string` | String | `` | Text to take the substring from; it must not be cleared to null, which raises an error rather than yielding an empty result |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `result` | String | — | The section of String between Start and End |

## Patterns

- Unique Id `guid` → `string` with `start` 0 / `end` 4: a short human-readable tag from a longer id.

## Watch out for

- Setting `end` to 0 expecting 'until the end' — 0 is a real exclusive index and yields an empty string; leave `end` unset or use -1 instead.

## Examples

**Debounced autosave with timestamped status**

The debounce idiom: every keystroke fires Value Changed, whose signal restarts a 1.5-second Timer — the save only runs when the user pauses. The save Function stamps the moment; Date To String formats it, Unique Id issues a save id shortened by Substring, and String Format assembles the status line. Signals sequence the flow; values shape the display.

## Related nodes

[String Format](./string-format.md), [String Mapper](../utilities/string-mapper.md), [Expression](../custom-code/expression.md), [Function](../custom-code/java-script-function.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
