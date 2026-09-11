# The 14 code snippets, dispositioned

**COM-003 AC5, closed 2026-09-11.** *"Each becomes a dictionary row (COM-002), an example, a library
part, or an explicit discard. 🔴 A snippet with no disposition is invisible and gets rediscovered at
full price."*

The corpus's `Components/` half is three kinds of thing and only one of them converts. 12 are
clipboard-JSON graphs (landed as examples — COM-003 AC1). 3 are external links (COM-006). **These
14 are bare code**: a `Function`, `Script` or cloud-function body with no graph around it, so there
is nothing for `convert-exports.py` to convert and nothing for the example gate to score.

## How these were judged

🔴 **Every claim below was executed or grepped against the product, not read off the snippet.** Two
of the judgements reversed when measured:

- `Input mapping for re…` looked like it referenced an undeclared `object`. It does not — `object`
  is a real parameter (`new Function('map', 'object', script)`). But the snippet **still** fails to
  compile, for a different reason, found by running it. See [D3](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md#d3).
- The three snippets using `_noodl_cloudservices.masterKey` looked like a master key leaking into a
  browser. It cannot: `globals.d.ts` states *"`masterKey` is present here and nowhere in the browser
  — this is the server-side path, which is the only place a master key is allowed to appear."* The
  real hazard is the opposite and quieter — see the ⚠️ under §3.

⚠️ **"Discard" is a decision, not a deletion.** Every snippet stays in `corpus/`. Discard means *we
looked, and it does not earn a place in the product's own artefacts*, with the reason attached so
nobody pays for the look twice.

---

## The table

| # | snippet | disposition | why |
|---|---|---|---|
| 1 | Add params to URL | **discard** | `URLSearchParams` and string concatenation. No NodeGX content beyond `Inputs.`. COM-002 §7.4 already refused it for the phrasebook — it is not a Bubble operator, and a table whose whole asset is Bubble's search terms is diluted by NodeGX recipes. |
| 2 | Check if a group is [near the bottom] | **discard — it teaches a leak** | Measures with `getBoundingClientRect`, then `window.addEventListener('resize', …)` **with no removal**. That is precisely the defect `community-dropzone` and `community-ag-grid` now demonstrate the fix for. Landing it would teach the thing two landed examples exist to correct. |
| 3 | Check window width | **discard — the product has a node** | Same unremoved `resize` listener, and `Screen Resolution` already publishes width/height as ports (`docs/node-catalog/enrichment/screen-resolution.json`). COM-002 §7.4 refused it for the phrasebook separately. |
| 4 | Get a cloud function [record by id] | **discard** | Parse REST by hand for what `Cloud Data`/`Noodl.Records` do as nodes. Server-side only (§3). Nothing to teach that a node does not teach better. |
| 5 | Input mapping for repeater | ✅ **documented** | The only one that named a real, useful, **undocumented** facility. `For Each`'s `inputMappingScript` port now carries an enrichment note: the `map({...})` call, both mapping forms, the pre-filled identity mapping, and that a script which does not compile maps nothing. The snippet itself does not compile — [D3](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md#d3). |
| 6 | Is Noodl in dev or production | ✅ **verified, folded into the note above's neighbourhood** | `Noodl.deployed` is real and the product reads it itself (`group.ts`, `text.ts`, `node-shared-port-definitions.ts` all branch on `!Noodl.deployed`). Two lines; no artefact of its own is warranted, but the fact is now confirmed rather than folklore. |
| 7 | Make a reusable comp [typed GraphQL input] | **discard, with a pointer** | Shows `Script.Inputs` declaring `type: { name: 'string', codeeditor: 'graphql' }` plus a `Script.Setters` proxy. Genuinely NodeGX-specific, but it is a fragment of the GraphQL module's own concern and `library/modules/graphql` already ships. Not worth a second, partial account. |
| 8 | Map new values to an [array] | **discard** | `list.map(obj => ({...obj, extra}))`. Plain JavaScript. |
| 9 | Masonry grid for repeater | ➡️ **routed to [COM-005](COM-005-THE-RECORDERS-AND-THE-MASONRY.md)** | A CSS block, not a Function body — the only snippet of its kind. COM-005 already owns "masonry grid" as one of its three named library gaps, and this is its source material. **Do not discard: it is an input to an open task.** |
| 10 | Multiple dropdowns w[ith mapped options] | **discard the code; [D4](DEFECTS-THE-COMMUNITY-CORPUS-FOUND.md#d4) keeps the question** | The mapping half is `#8` again. The interesting half is a bare `setTimeout(…, 50)` between publishing items and announcing readiness — the signature of a mount-ordering workaround. Filed as a question to measure, explicitly **not** claimed as a defect. |
| 11 | Query Noodl database [by relation] | **discard** | `Noodl.Records.query("class", { field: { pointsTo: id } })`. ✅ `pointsTo` is real (`queryutils.ts`, `RestDataAdapter.ts`, `dbcollectionnode2.ts`), so the snippet is correct — but it is one call the `Cloud Data` nodes make for you, and the query vocabulary is documented where those nodes are. |
| 12 | Return all child rec[ords] | **discard** | Parse REST `$relatedTo` by hand, master-key headers, ~40 lines. Correct, server-side only (§3), and superseded by #11's one-liner for the same question. |
| 13 | Smooth scroll to bottom | **discard, with a caution recorded** | `Inputs.This.getDOMElement()` then `scrollTo({ behavior: 'smooth' })`. Small and correct. ⚠️ Kept out of the corpus deliberately: a smooth scroll does **not** move `scrollTop` synchronously, so any example built on it that then asserts a position reads `0` and looks like a bug in the scroll rather than in the assertion. |
| 14 | You want to bulk add [relations] | **discard** | 4 KB, the largest snippet here: batched `AddRelation`/`RemoveRelation` against Parse REST with the master key. Correct and genuinely useful — and entirely a *Parse backend* recipe, server-side only, for a backend this repo keeps by decision but does not lead with. Landing it as a product artefact would advertise a path we do not recommend. |

**Totals: 1 documented, 1 verified, 1 routed to an open task, 11 discarded with a reason.** Zero
without a disposition.

---

## §3 ⚠️ — What the master-key snippets actually do, which is not what it looks like

Snippets #4, #12 and #14 all read `_noodl_cloudservices.masterKey`. The alarming reading is *"the
master key is in the browser"*. **Measured, it is not:**

```
packages/noodl-runtime/src/globals.d.ts:30
  "`masterKey` is present here and nowhere in the browser — this is the server-side path,
   which is the only place a master key is allowed to appear."
```

`_noodl_cloudservices` is *"the backend credentials baked into a **deployed cloud-runtime** bundle"*.
So the real failure mode is the quiet one: **paste any of these into a client-side `Function` node
and `masterKey` is `undefined`**, the request goes out with `X-Parse-Master-Key: undefined`, and
Parse rejects it as unauthorised. The person reads that as a permissions problem with their data,
and every minute they spend on ACLs and class-level permissions is spent in the wrong place.

🔴 That is the single most valuable thing in these fourteen files, and none of them says it. It is
recorded here because three separate community answers hand people code that only works in one of
the two places they will try it, and the error message does not distinguish them.

---

## What this does not own

Making any of this installable — CMP-004 AC3 (P85) owns the shelf. The masonry CSS's fate — COM-005.
Whether Parse-era recipes should be recommended at all — `corpus/components/PARSE-ERA-ROWS.md` marks
the three Parse-era components and re-tests the claim; ⚠️ **mark them, do not delete them, and do not
promise them**: none has been run against a live Parse Server.
