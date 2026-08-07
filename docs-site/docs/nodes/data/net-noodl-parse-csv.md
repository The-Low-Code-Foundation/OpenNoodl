---
title: "Parse CSV"
---
Turns CSV text that arrived at runtime into an array — records when the first row is a header, rows of cells when it is not.

Parse CSV reads CSV text into an array. With Has Header ticked (the default) the first row names the properties and Items is an array of records; untick it and Items is an array of rows, each an array of cells. It handles the awkward parts of the format properly: quoted cells, cells containing the delimiter, cells containing newlines, and doubled quotes. Every cell comes out a string — there is no type inference, so a column that looks numeric yields "42" and not 42; use an Expression or Array Map if you need numbers. A leading byte-order mark, which is what Excel writes when it saves UTF-8, is stripped so the first column keeps its name. A quote the parser cannot pair is a Failure with the line number, not a half-read file: without that check the text around the stray quote simply disappears and the array looks plausible. This is the same parser Static Array has always used, so an authored CSV and a received one cannot disagree. In a cloud function, remember the request body limit is 10 MB — a bigger file has to arrive through file storage instead.

## When to use it

A CSV arriving from anywhere at runtime: a request body, an upload, an HTTP response, a file read from storage. For a CSV you type in yourself, Static Array is the node — it is this parser with an editor field in front of it.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.ParseCSV` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `delimiter` | String | `,` | The character between cells. Use ; for a European export, or a tab for TSV |
| `hasHeader` | Boolean | `true` | When ticked the first row names the columns and Items is an array of records. Untick it and Items is an array of rows, each an array of cells |
| `text` | String | — | The CSV text to parse. A leading byte-order mark — which is what Excel writes when it saves UTF-8 — is stripped, so the first column keeps its name |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | How many rows the last successful parse produced, not counting the header row |
| `items` | Array | — | The parsed rows — records when Has Header is ticked, arrays of cells when it is not. Every cell is a string, including columns that look numeric. Unchanged while the CSV cannot be parsed |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires once Items and Count hold the freshly parsed CSV |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the CSV could not be parsed, naming the line it gave up on; empty until a parse fails |
| `failure` | Signal | — | Fires when the CSV could not be parsed, leaving Items and Count as they were |

## Patterns

- Request `pm-csv` → Parse CSV `text`; Parse CSV `items` → Array Filter → To CSV → Response: the whole 'someone sent us a spreadsheet' shape, with no Function node.
- Wire `failure` somewhere that answers the caller. A function whose only wired path is the happy one hangs forever when the file is malformed (CWF-018).

## Watch out for

- Expecting numeric columns to arrive as numbers. Every cell is a string; convert explicitly.
- Splitting on commas with a String node instead. That breaks on the first quoted cell containing a comma, which is the first real file you will meet.
- Posting a CSV larger than 10 MB to a cloud function. The body limit rejects it with a 413 before the graph runs.

## Related nodes

[To CSV](./net-noodl-to-csv.md), [Static Array](./static-data.md), [Array Filter](./filter-collection.md), [Array Map](./map-collection.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
