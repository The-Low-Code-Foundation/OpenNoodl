# BCN-004 — what the three REST wires actually do

**Measured 2026-07-31** against Directus 11, PostgREST v12.2.3 and PocketBase 0.30.0 in the
[uba-e2e rig](../phase-16-runtime-deploy-health/uba-e2e/). Probe:
[`bcn-004-wire-probe.mjs`](../phase-16-runtime-deploy-health/uba-e2e/bcn-004-wire-probe.mjs).
Raw output: `BCN-004-WIRE-PROBE-OUTPUT.txt`.

Written **before** any adapter code, because this phase has paid three times for the opposite
order: BCN-002 found all three of Parse's carefully-documented file cells wrong, BCN-003 found
four descriptor cells that a real server contradicted, and BCN-007 shipped a Directus field
mapping marked *"documented, not probed"* naming BCN-004 as the task to confirm it.

---

## 1. ⚠️ The finding: the presets carry a wrong total, and it is the RUN-003 defect

BCN-004's spec says the adapter is *"configured per backend type by the existing
`BackendPreset` (endpoints, response envelope, pagination style)"*. Driving it from the preset
as written would ship a known bug.

| Backend | Preset (`presets.ts`) | Measured | Verdict |
|---|---|---|---|
| Directus | `totalCountPath: 'meta.total_count'` | `total_count` **ignores the filter** | ⚠️ **wrong** |
| Supabase | `totalCountPath: ''` | total is a **response header** | under-expressive |
| PocketBase | `offsetParam: 'page'` | `page` is a **1-based page number**, not an offset | ⚠️ **mislabelled** |

### 1.1 Directus — `total_count` is the wrong number on a filtered query

Three rows, two matching `tag = x`:

```
unfiltered, limit=2 :  {"total_count":3,"filter_count":3}
filter tag=x, limit=1: {"total_count":3,"filter_count":2}
```

`filter_count` is the one pagination over a filtered list needs. This is **exactly** the defect
RUN-003 fixed in `byob-utils.ts::pickTotalCount`, whose comment already says so — and the
preset points at the other field. The spec's own trap list names this class first: *"a fix that
must survive; it is exactly the class of bug that returns a plausible wrong number."*

### 1.2 PocketBase — a 1-based page wearing an offset's name

```
perPage=1&page=1&sort=name -> ["Ada"]
perPage=1&page=2&sort=name -> ["Alan"]
perPage=1&page=0&sort=name -> ["Ada"]     <- clamped to page 1
```

`IDataAdapter.query` takes `skip` (a row offset). The preset's `offsetParam: 'page'` invites an
adapter to pass `skip` straight through. Two failures follow, and the first hides the second:

- `skip=0` → `page=0` → **clamped to page 1**, so page one looks correct;
- `skip=10, limit=10` → `page=10` → the *tenth page*, i.e. rows 90–99, not rows 10–19.

The conversion the adapter owes is `page = floor(skip / limit) + 1`, and it must refuse or
round when `skip` is not a whole multiple of `limit`, because a page-based wire cannot express
an arbitrary row offset at all.

### 1.3 Supabase — two things `ResponseConfig` cannot say

```
GET /articles?limit=2                          -> Content-Range: 0-0/*      (total unknown)
GET /articles?limit=2  Prefer: count=exact      -> Content-Range: 0-0/1      (total known)

POST /articles                                  -> 201, body ""             <- empty
POST /articles  Prefer: return=representation   -> 201, [ {...} ]           <- the row, in an array
```

- **The total is a header.** `totalCountPath` is a body path; there is no string it can hold
  that reaches `Content-Range`. The preset's `totalCountPath: ''` comment already admits this
  (*"Needs special header: Prefer: count=exact"*) — it is recorded as a gap, not solved.
- ⚠️ **A create returns an empty body unless asked.** `IDataAdapter.create` hands `success`
  an `AdapterRecord`. An adapter that omits `Prefer: return=representation` calls `success`
  with **nothing**, on a `201` — no error anywhere, and the node's created-record output is
  silently empty. This is the same shape as the `convertFilterOp` defect BCN-003 found: a
  success path returning the wrong thing quietly.
- The created row arrives **wrapped in an array of one**, so the adapter unwraps `[0]`.

---

## 2. The measured wire, per backend

Everything below was observed, not read. `pk` is the primary-key field name.

### Directus 11

| | |
|---|---|
| auth | `Authorization: Bearer <token>` |
| list | `GET /items/{c}?filter={json}&limit=&offset=&sort=&fields=&meta=total_count,filter_count` |
| envelope | `{meta, data}` — rows at `data` |
| total | `meta.filter_count` (filter-aware); `meta.total_count` ignores the filter |
| pagination | `limit` + `offset`, **0-based** |
| create | `POST /items/{c}` → `200`, `{data: {...}}`; accepts an **array** for bulk |
| pk | `id` |

### PostgREST v12.2.3 — the Supabase REST wire

| | |
|---|---|
| auth | `apikey: <anon>` + `Authorization: Bearer <token>` (per Supabase; PostgREST alone needs neither) |
| list | `GET /{table}?select=*&limit=&offset=&order=` + filter predicates as query params |
| envelope | **bare array** — no `dataPath` |
| total | `Content-Range` **header**, and only with `Prefer: count=exact`; otherwise `0-0/*` |
| pagination | `limit` + `offset`, **0-based** |
| create | `POST /{table}` → `201` **empty** unless `Prefer: return=representation`, then `[{...}]` |
| pk | `id` |

⚠️ The seed grants `web_anon` `SELECT` only, so a create probe answers `42501 insufficient
privilege` and tells you nothing about the wire. The grant needed to ask the real question is
in the probe's header comment.

### PocketBase 0.30.0

| | |
|---|---|
| auth | **both** `Authorization: <token>` and `Authorization: Bearer <token>` return 200; no header → 401 |
| list | `GET /api/collections/{c}/records?perPage=&page=&filter=&sort=&expand=` |
| envelope | `{items, page, perPage, totalItems, totalPages}` — rows at `items` |
| total | `totalItems`, **filter-aware** (2 of 3 under `tag='x'`) |
| pagination | `perPage` + `page`, **page-based and 1-based**; `page=0` clamps to page 1 |
| create | `POST .../records` → `200` and the record **as an object** (not an array) |
| pk | `id` |

The auth result is worth stating plainly because it is the question the probe existed for:
PocketBase's header has changed across versions, and on 0.30.0 **both spellings work**, so the
preset's `method: 'bearer'` is correct rather than merely untested.

---

## 3. What this means for the adapter's design

The spec says preset-configured. The measurements say the preset is the wrong home for three of
these facts, so the proposal is:

**The five known backends get a built-in wire profile; `custom` alone reads the saved
`endpoints`/`responseConfig`.**

Two reasons, both evidenced above rather than aesthetic:

1. **For a known backend the wire is a fact about the backend, not user configuration.** A
   project saved before a preset fix keeps the old config forever — so the Directus
   `total_count` bug above would persist in existing projects even after the preset was
   corrected. This is the same argument BCN-009 made in its deviation #2 for *referencing* the
   capability descriptor rather than copying it onto the preset.
2. **`ResponseConfig` cannot express what the wires need** — a header-borne total, a required
   `Prefer` request header, an array-wrapped create response, or a page-vs-offset conversion.
   Widening it to cover all of them makes it a description of five specific servers, which is a
   built-in profile with extra steps.

`custom` keeps reading the saved config because there it genuinely *is* user configuration, and
the phase already decided `custom` is a **declared** backend whose owner fills in its own
capabilities.

### Consequences to carry

- `resolveBackend` currently returns `{url, token, type, endpoints, collections}` and **drops
  `responseConfig`** — which every project has been serialising and nothing has ever read.
- BCN-009's preset cells above should be corrected or removed rather than left to look
  authoritative. Whichever way §3 is decided, `totalCountPath: 'meta.total_count'` is wrong
  today.
- The Directus field mapping BCN-007 left as *"documented, not probed"*
  (`filename_disk`/`filename_download`/`type`/`filesize`) is **still unprobed** — this probe
  covered records, not files. It remains BCN-004's to confirm.

## 4. Not probed here

- **`nodegx` and `parse`** — the Parse wire, already behind `ParseWireAdapter` from BCN-002 and
  exercised against a real Parse Server there. Their preset cells (`dataPath: 'results'`,
  `totalCountPath: 'count'`, `offsetParam: 'skip'`) are untouched by this probe.
- **Relations.** BCN-005 owns them; the spec's Out of Scope says not to start `GET /relations`.
- **Files.** BCN-007's remainder.
- **Realtime.** BCN-008.
