---
title: "String Format"
---
Builds a string from a template: each {tag} in the Format text becomes an input port whose value is spliced in.

String Format takes a template on its `format` (Format) parameter and outputs the filled-in text on `formatted` (Formatted), a string value. Every {tag} in the template (tag characters: letters, digits, underscore) becomes a string input port named exactly like the tag, and each occurrence is replaced by that input's current value — or by nothing while the input is still undefined. The same tag may appear multiple times; every occurrence is filled. The output recomputes after any input or the template changes, once per update cycle. The node displays its format text as its label in the editor.

## When to use it

The idiomatic way to put values inside text: 'Saved at {time}', '{count} items', building URLs or messages from parts. For two fixed alternatives use Boolean To String; for value-keyed lookup use String Mapper; for transformations of the values themselves (padding, casing, math) do that upstream in an Expression or Function.

## At a glance

| | |
|---|---|
| Category | String Manipulation |
| Type name | `String Format` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `format` | String | — | Template text; each {placeholder} becomes an input port, and a placeholder used twice fills only the first time |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `formatted` | String | — | Format with every placeholder substituted, and an unset placeholder replaced by nothing |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Input ports are created for each "{tag}" appearing in the "format" parameter string.

## Ports at runtime

Input ports are created from the `format` parameter: each unique {tag} yields one string input named exactly <tag> (no braces). The editor updates the port list live as the format is edited. An authoring tool must first set `format`, then may connect to or set parameters for each tag name it wrote; no other inputs exist.

## Patterns

- Counter `currentCount` → the {n} input of format "{n} pcs" → a Text's `text`: numbers cast to string on connection, so no converter node is needed.

## Watch out for

- Tags with spaces or dashes ({item-count}) — tag names are limited to [A-Za-z0-9_]; anything else stays literal text.

## Examples

**Quantity stepper: Counter with remapped and formatted readouts**

Two buttons drive a Counter up and down within limits. The count feeds three displays: a String Format caption ('{count} items'), a String Mapper that maps special values to words (0 → 'empty'), and a Number Remapper converting the 0–10 range into 0.2–1 opacity for a fill indicator. Counter holds the state; the display nodes are pure value-shaping between it and the UI.

**Debounced autosave with timestamped status**

The debounce idiom: every keystroke fires Value Changed, whose signal restarts a 1.5-second Timer — the save only runs when the user pauses. The save Function stamps the moment; Date To String formats it, Unique Id issues a save id shortened by Substring, and String Format assembles the status line. Signals sequence the flow; values shape the display.

## Related nodes

[Boolean To String](../utilities/boolean-to-string.md), [String Mapper](../utilities/string-mapper.md), [Substring](./substring.md), [Date To String](../utilities/date-to-string.md), [Expression](../custom-code/expression.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
