# CWF-012 — Parsing a CSV someone sent you

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 13, approved 2026-08-05.
**Status:** **built** 2026-08-06 — all three slices. `src/csv.ts` is the one parser; `Parse CSV`
and `To CSV` are registered in the shared runtime and driven in a real cloud function
(`nodegx-backend/tests/cloud-csv-nodes.test.ts`). **Read slice 0 before estimating** — most of the
parser already existed.

## Slice 0 — the parser we already ship

`Static Array` (`Static Data`) contains a real CSV parser: `CSVToArray`, a regex tokeniser handling
quoted cells and escaped quotes
([staticdata.ts](../../../packages/noodl-runtime/src/nodes/std-library/data/staticdata.ts)).
It is **authoring-time only** — the CSV is typed into the editor, not received at runtime.

⚠️ **Two premises in this paragraph were wrong when checked.** The file is in
`packages/noodl-runtime/src/nodes/std-library/data/staticdata.ts`, not `noodl-viewer-react` — it
moved with the shared registration. And it is not "browser-registered, though CWF-008 moves it":
CWF-008 **already moved it**, and the committed catalog records `Static Data` as
`availableIn: ["browser","cloud"]`. Nothing about the registration needed doing.

**So this task is not "write a CSV parser".** It is: lift that parser into a shared module, put a
runtime node in front of it, and add the serialise direction. If the implementation ends up
duplicating `CSVToArray`, it is wrong — two parsers means two behaviours on the same file, and
whichever one is fixed will be the one you are not using.

One documented behaviour to carry over deliberately: **every cell is a string**, including columns
that look numeric (the file says so in its own comment). Changing that is a separate decision with a
compatibility cost; do not quietly "improve" it.

## What shipped

| | |
|---|---|
| The parser | [`packages/noodl-runtime/src/csv.ts`](../../../packages/noodl-runtime/src/csv.ts) — `parseCSVRows` (tolerant, Static Array's), `parseCSV` (rows + verdict), `rowsToRecords`, `toCSV`, `rowsToCSV`, `stripBOM` |
| The nodes | `net.noodl.ParseCSV` / `net.noodl.ToCSV`, shared runtime, picker row *Read & Write Data → Array* |
| Unit tests | [`test/nodes/cwf-012-csv.test.ts`](../../../packages/noodl-runtime/test/nodes/cwf-012-csv.test.ts) — 36 cases, including Static Array on the same fixtures |
| Cloud drive | [`tests/cloud-csv-nodes.test.ts`](../../../packages/nodegx-backend/tests/cloud-csv-nodes.test.ts) — CSV in the request body → Parse CSV → Array Filter → To CSV → Response |

⚠️ **The malformed-CSV mechanism in slice 2 below is not what the tokeniser actually does, and
assuming it cost an hour.** An unterminated quote does **not** truncate the file. `exec` with the
`g` flag does not stop at text it cannot match — it *scans forward* to the next position that
does. So `3,"unterminated\n5,6` reaches the end of the input with every row present and the word
`unterminated` silently gone. "Did the scanner reach the end" therefore passes on the exact input
it is supposed to catch. The property that fails is **contiguity**: each match must begin exactly
where the previous one ended. That is what `csv.ts` checks, and what gives the line number.

One behaviour was deliberately **changed**, and it is a bug fix rather than the quiet improvement
this task forbids: `if (arrMatches[2])` was a truthiness test on the captured cell, so an empty
quoted cell (`""`) fell through to the unquoted branch — whose group had not participated in that
match — and parsed to `undefined`. In a parser whose documented contract is *every cell is a
string*, that was the contract failing in the one case nobody looks at. It is `!== undefined` now.

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
- ⚠️ A large CSV in a request body meets the backend's body limit long before it meets this node.
  **The number is 10 MB** — `readJSONBody` → `MAX_JSON_BODY` in
  [`server/http-util.ts`](../../../packages/nodegx-backend/src/server/http-util.ts), which is what
  `POST /functions/:name` reads its body with. ⚠️ It is *not* in `tests/body-limit.test.ts` as this
  line said: that suite's `LIMIT = 64 * 1024` is a constant it invents for its own server, and
  reading it as the product's limit would have put a number 160× too small on the node page. File
  uploads get 50 MB (`MAX_FILE_BODY`), so a bigger CSV goes through `POST /files` and is read from
  storage. Said in those words on the `Parse CSV` page.
