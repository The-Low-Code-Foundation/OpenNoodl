# DEF-014 — A filter on a column nothing has written is a 500

**Found by phase 77's SBR-015 drive, 2026-08-29.** A query that filters on a property no row
has ever carried does not return zero rows. It returns **HTTP 500**, and every graph
downstream of it takes its `failure` path.

## 1. The person sentence

**Someone who has just made their first site can publish their first page.** Today they
cannot: the site-builder's Publish refuses every page on a brand-new site, and keeps
refusing until some unrelated record happens to create the column it needs.

## 2. The evidence

A site-builder project minted by the wizard, its own backend, claimed, two pages created
through the admin dialog, **no sections authored anywhere** — which is the state of every
site on the day it is made.

```
GET /classes/Section?where={"pageId":"baa851b3-…"}
→ 500 {"error":"no such column: \"pageId\" - should this be a string literal in single-quotes?"}
```

The `Section` table exists — the first query auto-created it — and holds exactly the four
system columns:

| table | columns | rows |
|---|---|---|
| `Section` | `objectId`, `createdAt`, `updatedAt`, `ACL` | **0** |

An empty class and a filter naming a property of it is not an error condition from the
caller's side. It is the ordinary shape of "nothing matches yet".

### 2.1 The control pair

One variable moved: whether `Section` has a `pageId` column. The column was created by
writing a Section row against a **different** page, so the page under test carried **zero**
sections in both arms. Same page, same user, same backend, same request body.

| `Section.pageId` | `POST /functions/publishPage {pageId, publish:true}` |
|---|---|
| absent | **400** `This page could not be published.` — 12 ms |
| present | **200** `{"pageId":"baa851b3-…","published":true}` — 24 ms |

The template's graph is not at fault in either arm. `publishPage` is *correct* to refuse a
query that errored; there is nothing sensible for it to do with a 500.

### 2.2 Why this bites the whole story, not one screen

The site-builder's first-run story is: claim the site, create a page, publish it. The third
step fails on every new site, every time, and keeps failing until a Section row exists
somewhere in the backend — which only happens if the owner authors a section on some page
first. Nothing in the product says so.

🔴 **And it is not specific to the site builder.** Any app that queries a class before its
first row is written meets this: a dashboard filtering `Order.status`, a list filtering
`Task.done`. The template is where it was found, not where it lives.

## 3. Scope

- `nodegx-backend` — the query path that translates a `where` clause into SQL. A filter on a
  column absent from the table should match **nothing**, not raise. The current behaviour is
  SQLite's `no such column` surfacing verbatim.
- 🔴 **Decide the boundary deliberately**: "column absent from a class that exists" is not the
  same case as "class absent entirely", and neither is the same as a genuine typo the author
  would want told about. A silent empty result for every misspelling is its own defect — the
  `_Schema` table is what separates a declared-but-unwritten property from a nonexistent one,
  and the answer probably lives there.
- Whether auto-created classes should be given their declared columns at creation, which would
  make the question moot for anything the schema knows about.

## 4. Acceptance criteria

1. **(person)** A project minted from the site-builder template, claimed, one page created,
   **no sections anywhere**: Publish succeeds. Driven end to end, not asserted from a unit.
2. A query filtering on an absent column returns `200` with `results: []` — with a **negative
   control** in the same spec: the same query against a column that *does* exist and *does*
   match still returns its rows. An always-empty implementation passes AC2 alone.
3. 🔴 **The typo case is decided and graded either way.** If a misspelled property is to be
   an error, a test says so and names the mechanism that tells it apart from an unwritten one.
   If it is to be empty, a test pins that choice so nobody re-derives it as a bug.
4. A mutant: reintroduce the raise and AC1's drive-equivalent spec reddens.

## 5. Traps

- 🔴 **Do not fix this in the template.** Wiring around a 500 in `publishPage` would make the
  site builder work and leave every other app broken — and would remove the only place the
  defect is currently visible.
- ⚠️ **The failure is invisible from the graph's side.** `DbCollection2` reports `failure`
  identically for a 403, a 500 and a network drop. A drive that only reads the node cannot
  tell which; issue the query directly with the session token and read the body.
- ⚠️ The class is created lazily by the first query, so a backend inspected *before* any
  publish shows **no `Section` table at all** and one inspected after shows an empty one.
  Both readings are of the same defect.
