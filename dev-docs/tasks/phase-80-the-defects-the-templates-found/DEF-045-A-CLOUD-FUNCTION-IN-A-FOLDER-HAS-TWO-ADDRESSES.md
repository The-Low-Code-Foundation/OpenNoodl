# DEF-045 — A cloud function in a folder had two addresses and only one of them worked

**Status: 🟢 BUILT AND GATED 2026-09-03 (s44).** Promoted out of
[TASKS.md § *Findings this phase raised that nobody owns*](TASKS.md#findings-this-phase-raised-that-nobody-owns),
where it had sat unowned since 2026-08-30 (raised by DEF-015 s11).

---

## 1. 🔴 THE ROW AS RECORDED WAS WRONG, AND THE CORRECTION IS THE MOST USEFUL THING HERE

The register said: *"A cloud function in a FOLDER is declared, listed, ticked on the card — **and
unreachable over HTTP**."* It is **not** unreachable. It has two addresses and the row measured
one of them.

**Driven at HEAD against a real `BackendService` over a real socket**
(`packages/nodegx-backend/tests/def045-nested-function-address.test.ts`), one bundle carrying a
nested `site/publishPage` and a flat `publishPage` control:

| address | before | after |
|---|---|---|
| `POST /functions/publishPage` — the flat control | **200** | 200 |
| `GET /admin/workflows` lists `site/publishPage` | **listed** | listed |
| `POST /functions/site%2FpublishPage` — **percent-encoded** | 🟢 **200**, `{"who":"site/publishPage"}` | 200 |
| `POST /functions/site/publishPage` — **raw slash** | 🔴 **404 `Not found: POST /functions/site/publishPage`** | 🟢 **200** |

🔴 **A second file in this repo had already measured the other half and neither row knew about the
other.** `newFunctionFromStep.ts:44-52` (SB-003) records: *"every caller percent-encodes the name
(`cloudfunction2.ts:280`, `cloudfunction.ts:289`, `api/cloudfunctions.ts:83`,
`BackendManager.js:325`), the backend router splits the path before decoding … so an encoded `a/b`
matches `functions/:name` … nested names are shipped practice in the prefab library and **work on
every call path**."* Both readings were true. Neither was the whole picture, and each read as a
verdict on the other's question.

**So the real defect, and the honest severity:**

- ✅ **The product's own callers were never broken.** The site-builder template's three functions in
  `site/` work, in the app, today, and always did.
- 🔴 **The address the name convention promises did not work.** A person with `curl`, a third-party
  webhook (`/functions/stripe/webhook`), or anybody reading `POST /functions/<name>` in the docs
  got a `404` whose body — *"Not found: POST /functions/site/publishPage"* — is **the same sentence
  the router gives for a function that does not exist**. Nothing distinguishes *"you must encode the
  slash"* from *"no such function"*.
- ⚠️ **DEF-015's card was right to tick it** — the function really is deployed and really does run.
  The row's claim that the card *"shows a green ✓ for something the backend will not route to"* does
  not survive the measurement.

---

## 2. What was built

`functions/:name` → **`functions/*name`**, plus a final-segment rest-capture in `segmentsMatch`
(`packages/nodegx-backend/src/server/HttpServer.ts`). A trailing `*name` captures every remaining
segment joined with `/` and requires at least one; every other route keeps exact-length matching,
which is what stops `admin/ops` swallowing `admin/ops/x`.

**Exactly one route in a table of 92 uses it.** Both addresses now reach the same graph — the
encoded form was not broken and was not changed.

### 2.1 The two consumers the rename owed

`route.pattern` is not only a matcher, it is the **low-cardinality label** the access log and the
rate limiter carry (`trace.route = route.pattern`, `classifyRoute(route.pattern, …)`).

- `tests/ops-request-id.test.ts:143` finds its log line by `l.route === 'functions/:name'`
- `tests/ops-rate-limit.test.ts:117` asserts `classifyRoute('functions/:name', 'function')`

Both updated. 🔴 **And neither could be run here** — see §3.

---

## 3. Gates, and the one this box cannot give

| gate | reading |
| --- | --- |
| `def045-nested-function-address.test.ts` **before** the fix | **exit 1 — 1 failed, 3 passed**: the raw-slash arm alone, with the flat control, the listing and the encoded address all green |
| the same file **after** | **exit 0 — 6 passed**, including two arms added to cover §2.1 and one control for the matcher itself |
| `tsc -p packages/nodegx-backend --noEmit` | **exit 0** |
| the six suites that read the route table | 🔴 **all six fail on this box before reaching any assertion** — see below |
| `tsc -p packages/nodegx-backend/tsconfig.tests.json` | 🔴 **cannot complete here**: OOM at the 4 GB default (**exit 134**), SIGTERM at 9 GB after 10 minutes (**exit 143**). CI runs it |

### 3.1 🔴 The backend's HTTP suites cannot run on this machine at all

`better-sqlite3` is **not installed** and Node here is **20.11.1**, which has no usable
`node:sqlite` (it needs ≥ 22.13). A `BackendService` therefore refuses to start:

```
LocalBackendPersistenceError: The local SQLite engine (better-sqlite3) could not be loaded …
```

Measured across the six route-table suites: **59 failed, 40 passed**, and **every** failure is that
error — 118 occurrences. That is not a regression from this change; it is the state of the box.

⚠️ **So `ops-request-id` and `ops-rate-limit` — the two specs this change edits — did not execute.**
A pattern rename verified by nothing is how a green suite ends up describing a route that no longer
exists, so both of their assertions are made **again** inside `def045-…test.ts`, which runs here
because it passes `allowEphemeral: true`: routing needs no database. The one thing that spec cannot
reproduce is the log line itself, and the link is stated where it is asserted —
`HttpServer.handle` sets `trace.route = route.pattern`, so the pattern IS the label.

### 3.2 The control for the matcher change

`*name` relaxes a length check every other route depends on, so a green arm proves it relaxed
**exactly one**: `POST /functions` (no name) still 404s — a rest-capture needs at least one segment
— and `GET /classes/Thing/extra/segments` still 404s on an ordinary `:param` route.

---

## 4. Left open, named rather than swept

- 🧭 **`ComponentItem.tsx:188` refuses to create a cloud function inside another cloud function,
  and its stated reason is now false**: *"a name the backend's `/functions/:name` route cannot
  address"*. That address is addressable now. **The behaviour was not changed** — SPR-005 made it a
  visible disabled row deliberately, and whether function-inside-function should be allowed is a
  product question, not a routing one. Owner: **`NONE`**. The comment is the thing that is stale.
- ⚠️ **The 404 body still cannot tell *"no such function"* from *"wrong address"***. It no longer
  matters for a nested name, but the message is the same for a typo and always was.
- 🔴 **`better-sqlite3` missing on this machine blinds every backend HTTP drive.** Anyone reading a
  green `nodegx-backend` run here should check the suite count against the directory first. Owner:
  **`NONE`** — it is an environment row, not a product one, and it will keep costing sessions the
  30 seconds it costs to rediscover.
