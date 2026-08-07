---
title: "Pattern Extractor"
---
Pattern Extractor: pulls matches and capture groups out of text with a regular expression, without needing a Function node.

Runs `pattern` over `text` on each `extract` and publishes the first match, its capture groups (numbered and named), and — with Extract All on — every match. An optional group that did not participate becomes an empty string rather than a hole in the array, so downstream indexes stay stable. `firstGroup` is a convenience for the overwhelmingly common single-group case. A pattern that will not compile is a result, not an exception: `ok` becomes false, `error` explains, and the `failure` signal fires — distinct from `notFound`, which is a normal outcome. Note that a catastrophically backtracking pattern is still the author's problem; this runs the platform regex engine and cannot bound it.

## When to use it

Extracting a value from text that is not structured data: a percentage out of a progress line, a tool name out of an agent status message, a field out of a log record. Prefer JSON Stream Parser when the payload really is JSON, and String Format or Substring for fixed-position work that needs no pattern.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.PatternExtractor` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `extractAll` | Boolean | `false` | Collects every match into Matches instead of stopping at the first one |
| `flags` | String | — | Regex flags i, m, s, u and y; g is controlled by Extract All and a g written here is ignored |
| `pattern` | String | — | A JavaScript regular expression without the surrounding slashes; capture groups appear on Groups |
| `text` | String | — | The text to search |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `extract` | Signal | — | Runs Pattern over Text and reports what it found |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `firstGroup` | String | — | The first capture group of the first match, which is the whole answer for a pattern like (\d+)% |
| `groups` | Array | — | Capture groups of the first match; an optional group that did not participate is a blank string, not a hole |
| `match` | String | — | The first match, or blank when nothing matched |
| `matchCount` | Number | — | How many matches were found, which is at most one unless Extract All is on |
| `matches` | Array | — | Every match when Extract All is on, otherwise just the first |
| `namedGroups` | Object | — | Named capture groups of the first match, keyed by name |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the extract has run, whether it matched or not — Found and Not Found say which |
| `found` | Signal | — | Fires when the pattern ran and matched at least once |
| `notFound` | Signal | — | Fires when the pattern ran and matched nothing, which is an ordinary outcome rather than a mistake |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the pattern could not be used: it is blank, or it is not a valid regular expression |
| `failure` | Signal | — | Fires when the pattern itself is unusable, which is a bug to fix rather than a result |

## Patterns

- Stream text → `text`, pattern `(\d+)%`, `firstGroup` → Number → a progress bar.
- Named groups turn one pattern into several outputs without chaining extractors: `(?<tool>\w+)\s+(?<state>\w+)`.
- `failure` → a visible warning during authoring catches a mistyped pattern that would otherwise read as 'never matches'.

## Watch out for

- Parsing JSON with a regex instead of using JSON Stream Parser.
- Treating `notFound` as an error state — most streams contain lines the pattern is not meant to match.
- Building a pattern from user input without bounding it; nested quantifiers can hang the frame.

## Examples

**Long-running task monitor: progress, batched log lines, and a visible connection**

A backend job streams two kinds of frame on one connection. Pattern Extractor pulls the percentage out of human-readable status text, so a progress bar tracks it without a Function node. JSON Stream Parser turns NDJSON log payloads into values — several may complete in one frame, so `values` rather than `parsed` is what feeds downstream. Stream Buffer batches those into a flush every 250 ms, which keeps a busy log from repainting the list hundreds of times a second, and the stream's `onClose` flushes the tail that never reached a full batch.

## Related nodes

[Server-Sent Events](./net-noodl-sse.md), [JSON Stream Parser](./net-noodl-jsonstream-parser.md), [Substring](../string-manipulation/substring.md), [String Format](../string-manipulation/string-format.md), [String Mapper](../utilities/string-mapper.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
