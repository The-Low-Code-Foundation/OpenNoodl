# The community corpus

Exported by Richard from the old Noodl community site, 2026-09-10, and vendored here because the
phase depends on it and its original home is a folder outside the repo.

**Source:** `/Users/richardosborne/vscode_projects/nodegx_exports` (33 files, 276 KB; 256 KB here
after dropping `.DS_Store`).

| | |
|---|---|
| [`components/`](components/) | 29 shared components + `Components.csv` (30 metadata rows: name, use case, creator credit, notes) |
| [`bubble-dictionary/`](bubble-dictionary/) | `Bubble Noodl dict.csv` — 94 Bubble operators mapped to a NodeGX node and code |

## 🔴 Three kinds of thing live in `components/`

Each entry is a folder holding one `.md` file, and the `.md` is **not** uniform:

- **12 are clipboard-JSON graphs** — a real Noodl copy/paste payload, in a fenced block. These
  convert to catalog examples; see [`../convert-exports.py`](../convert-exports.py).
- **14 are code snippets** — a Function/Script body, one CSS block, one cloud function. No graph.
- **3 are only a URL** to a payload hosted elsewhere. 🔴 Two are personal Google Drive links and
  will rot — COM-006.

⚠️ **The fences carry different language tags** — ```` ``` ````, ```` ```json ```` and
```` ```css ````. A parse that matches only the bare fence finds 10 graphs, not 12.

⚠️ **`Bubble Noodl dict.csv` is 404 lines and 94 records.** Quoted fields contain newlines; count
with a CSV reader, never `wc -l`.

## Provenance and courtesy

Rows in `Components.csv` credit named people — Richard Osborne on several, and *"Coded by the very
helpful Johan Olsson from Noodl"* on another. 🔴 **Attribution travels with anything taken from
here**, and anything sourced from a third-party repository needs its licence checked before it is
copied (COM-006 AC3).

## What this corpus is not

**Verified.** Seven of the twelve graphs fail the strict example gate, one of them by wiring an
output that does not exist. Circulation is not verification — see
[`../MEASURED-2026-09-10.md`](../MEASURED-2026-09-10.md) §4.
