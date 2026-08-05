# CWF-012 — Parsing a CSV someone sent you

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 13, approved 2026-08-05.
**Status:** open, unowned. **Read slice 0 before estimating** — most of the parser already exists.

## Slice 0 — the parser we already ship

`Static Array` (`Static Data`) contains a real CSV parser: `CSVToArray`, a regex tokeniser handling
quoted cells and escaped quotes
([staticdata.ts:14-92](../../../packages/noodl-viewer-react/src/nodes/std-library/data/staticdata.ts#L14-L92)).
It is **authoring-time only** — the CSV is typed into the editor, not received at runtime — and it
is browser-registered, though [CWF-008](CWF-008-THE-CLOUD-VOCABULARY.md) moves it.

**So this task is not "write a CSV parser".** It is: lift that parser into a shared module, put a
runtime node in front of it, and add the serialise direction. If the implementation ends up
duplicating `CSVToArray`, it is wrong — two parsers means two behaviours on the same file, and
whichever one is fixed will be the one you are not using.

One documented behaviour to carry over deliberately: **every cell is a string**, including columns
that look numeric (the file says so in its own comment). Changing that is a separate decision with a
compatibility cost; do not quietly "improve" it.

## Slices

### Slice 1 — extract

Move `CSVToArray` into `@noodl/runtime` as a plain module with its own unit tests: quoted cells,
embedded delimiters, embedded newlines, escaped quotes, CRLF, a trailing newline, an empty file, a
header-only file. Static Array keeps working, unchanged, on top of it.

### Slice 2 — Parse CSV node

- Inputs: text, has-header (bool), delimiter (default `,`).
- Outputs: array of objects (header mode) or array of arrays, row count, plus Success/Failure and a
  runtime error carrying the offending line number.
- ⚠️ **A malformed CSV must fail loudly.** The [Failure Contract](../../reference/FAILURE-CONTRACT.md)
  applies; `Static Array` already models it with its `Error` output and a parse-error code
  (`static-array/json-parse-failed`). Follow that shape and give CSV its own code.

### Slice 3 — To CSV node

Array of objects → text. Inputs: columns (optional — default is the union of keys, in first-seen
order), delimiter, include-header. The correctness question is **quoting**: any cell containing the
delimiter, a quote or a newline must be quoted and its quotes doubled. Round-trip test: parse →
serialise → parse produces the same array, on a file containing all three hazards.

## Done when

- Both nodes driven in a real cloud function: a CSV arrives in the request body, is parsed, filtered
  with [CWF-008](CWF-008-THE-CLOUD-VOCABULARY.md)'s array nodes and serialised back out.
- Static Array still parses everything it parsed before — its existing tests pass untouched.
- Round-trip test with delimiters, quotes and newlines inside cells.
- No new dependency.

## Traps

- ⚠️ **Shared runtime, both surfaces.** A browser app importing a spreadsheet wants this as much as
  a function does. No cloud guard.
- ⚠️ Excel writes UTF-8 **with a BOM**, and a BOM on the first header cell silently corrupts that
  column's name — the failure looks like "my first column is missing". Strip it, and test it.
- ⚠️ A large CSV in a request body meets the backend's body limit long before it meets this node
  (`tests/body-limit.test.ts`). Know that number and say it on the node page rather than letting it
  surface as a mystery 413.
