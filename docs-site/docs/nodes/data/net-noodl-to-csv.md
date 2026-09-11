---
title: "To CSV"
---
Writes an array out as CSV text, quoting any cell that needs it.

To CSV turns an array into CSV text. Records become rows: leave Columns empty and every property found on the records is written, in the order they were first seen, or name the columns yourself to fix the order and drop the rest. An array of arrays — what Parse CSV produces with Has Header unticked — is written cell for cell with no header invented. The correctness of a CSV writer is entirely about quoting, and this one gets it right: any cell containing the delimiter, a quote or a newline is wrapped in quotes with its own quotes doubled, so the output reads back through Parse CSV unchanged. The record `id` the runtime mints is not written unless you name it in Columns, because it is not a column you put there.

## When to use it

Answering with a spreadsheet: a cloud function replying to an export request, a download button in a browser app, a file written to storage. Pair it with Parse CSV for 'read a supplier's file, filter it, send it back'.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.ToCSV` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `columns` | Stringlist | — | Which properties to write, in order, comma separated. Leave it empty and every property found on the records is written, in the order they were first seen |
| `delimiter` | String | `,` | The character between cells. Any cell containing it is quoted automatically |
| `includeHeader` | Boolean | `true` | Write the column names as the first row |
| `items` | Array | — | The array to write. Records become rows; an array of arrays is written cell for cell |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | How many data rows were written, not counting the header row |
| `text` | String | — | The array as CSV text. Cells containing the delimiter, a quote or a newline are quoted and their quotes doubled, so this round-trips back through Parse CSV unchanged |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires once CSV holds the freshly written text |

## Patterns

- Query Records `items` → To CSV `items`; To CSV `text` → Response `pm-csv`: an export endpoint in three nodes.
- Parse CSV → Array Filter → To CSV: read, narrow, write back. The round trip is exact, including cells containing commas, quotes and newlines.

## Watch out for

- Building CSV by joining strings in an Expression or Function node. That is the quoting rule reimplemented, and it is wrong the first time a cell contains a comma.
- Passing an array of arrays and expecting a header row. There are no column names to write; use records if you want one.

## Examples

**Write a list of records out as CSV**

Bubble's `:format as text` joins a list with a delimiter, and for a CSV export that is the version that breaks: a name containing a comma, or a note containing a newline, silently produces a file with the wrong number of columns and no error anywhere. To CSV is a real writer — any cell holding the delimiter, a quote or a newline is wrapped in quotes with its own quotes doubled, so the output reads back through Parse CSV unchanged. Columns is the input worth setting deliberately. Left empty, every property found on the records is written in the order it was first seen, which means the file's shape follows whatever the first record happened to contain — add a field to one record upstream and the export changes silently. Naming the columns fixes the order AND drops everything else, which is how you keep an internal field out of a file a customer opens. The record `id` the runtime mints is never written unless you name it, because it is not a column of your data. Count reports DATA rows, not counting the header, so it is the number to put in front of a person; a list of ten with Include Header ticked produces eleven lines and Count says 10. Both the text and the row count are published, because the thing that wants the CSV is whatever hands it to a download or a request — not this component.

## Related nodes

[Parse CSV](./net-noodl-parse-csv.md), [Static Array](./static-data.md), [Array Filter](./filter-collection.md), [Array Map](./map-collection.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
