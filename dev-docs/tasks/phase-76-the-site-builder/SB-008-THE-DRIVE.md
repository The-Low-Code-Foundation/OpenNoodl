# SB-008 — The drive

**Status: ✅ DONE s8 (2026-08-26). The browser half is measured.** The public site and the admin
panel are authored through the real MCP door into one project, deployed beside SB-004's four cloud
components on a real SQLite backend with **`devOpen: false`**, and driven in a headless Chrome as an
**anonymous** visitor. `packages/nodegx-backend/tests/sb008-public-site-drive.test.ts` — **20 specs,
4 known-firing controls, 3 one-edge arms.**

🔴 **This closes SB-005 acceptance 6 and SB-006 acceptance 9**, which are the same claim from two
sides and were the only two criteria in the phase left deliberately unmet.

Depends on SB-004 (✅ the cloud half and the ACL invariant), SB-005 (✅ the panel), SB-006 (✅ the
site). Feeds SB-007 — a template nothing has ever run is not a template.

## 1. What the drive is, exactly

| step | what happens | why it is that way |
|---|---|---|
| author | `SB006_COMPONENTS`, then `SB005_COMPONENTS`, then `SB004_COMPONENTS`, through `createServer` from `src` | the site **first** — SB-006 F17 (start page) and F14 (the catch-all's tie). The dist on this machine is stale and the bound servers run it. |
| deploy | `bundleAuthoredComponents` over the four cloud keys → one `*.workflow.json` | SB-004 §7's bridge, unchanged. The browser half is served from the same directory on disk. |
| enforce | `security.json` written **before** `start()`, `devOpen: false`, asserted `enforced === true` | `SecurityState` reads it in its constructor; a config applied after the boot leaves it dev-open |
| bind | `metadata.cloudservices = { appId, endpoint }` written into the project file | `render-from-disk.js:292` rewrites the endpoint to a same-origin `/__backend` it proxies — **only when the key is already there**, and the MCP fixture has no `metadata` block at all |
| seed | over HTTP as the owner, after `claimSite` minted the admin role; published through **`publishPage`** | the row states are the ones the product writes, not ones the test typed |
| drive | `withRenderedPage` (`scripts/devtools/render-report.js`) → headless Chrome, five URLs | no session token ever reaches the browser |

**The five URLs**: `/` (home by `homeSlug`), `/about` (published), `/secret` (draft), a slug that is
no record at all, and `/secret` again on a **dev-open twin**.

## 2. The four controls, because every headline claim here is an absence

🔴 An absence claim is worth nothing without a signal known to fire. "The draft did not appear" has
a dozen causes with nothing to do with permissions — an unbound query, a failed fetch, a page that
never rendered — and every one of them looks identical from the DOM.

1. **The published page renders**, records and all — same instrument, same expression, same run. So
   the harness does draw a title, an `h1` and a section body when it is allowed to.
2. **The draft is there, and an admin can read it** over HTTP. Without this the 404 is equally
   consistent with "the row was never written".
3. 🔴 **The dev-open twin.** The same project, the same components, the same seed, with one
   configuration line changed — and the draft the enforcing run refused **renders**: `h1` reads *The
   unreleased page*, the body marker is on the page. This is SB-004 F2's trap turned into a positive
   control: the instrument can see a leak, so not seeing one is a statement about the ACL.
4. **The raw boolean throws** (F18's unit spec) — the arm that makes "bound as `1`" a measurement
   rather than a tautology.

⚠️ **The leak check is made against `document.documentElement.outerHTML`, not `innerText`.** A draft
rendered behind `visible: false` is `display: none`, which `innerText` skips — the absence would have
passed on a page that was carrying the draft.

## 3. What it found

### F18 — 🔴 a boolean filter cannot be queried on the SQLite backend at all. **FIXED.**

The write path folds booleans to 0/1 (`serializeValue`, *"Handle booleans - SQLite uses 0/1"*). The
read path never did, and `node:sqlite` refuses to bind a JS boolean — so the failure was not a wrong
answer but a **throw**: `Provided value cannot be bound to SQLite parameter 1`, surfaced as a **500**
from `/classes/:c` and as `query-records/query-failed` in the browser.

Measured on one table, one route, three arms before the change:

| query | result |
|---|---|
| `{flag: true}` | **500** |
| `{flag: 1}` | **200**, returns the row |
| `{name: 'yes'}` | **200** — the control that says the route works |

The second arm is what makes this the missing conversion and not a storage question: the data was
already in the shape the fix converts to. `$eq: true` and `$ne: false` failed identically.

**The consequence in the template**: SB-006's derived navigation filters `showInNav` — a boolean
literal, the third query shape — so **every page of the site rendered with no navigation**, and the
only trace was a console line. SB-004 §2's "navigation is derived, never stored" was dead on arrival
and five sessions of structural specs were green over it.

**The fix** is `convertQueryValue` in `QueryBuilder.ts`, applied at all four binding sites (direct
equality, the comparison operators, `$in`, `$nin`) rather than at one — a boolean is legal in every
one of them and a half-converted operator set is the harder bug to find. ⚠️ **Nothing that works
today can regress**: every path it changes threw before it, on every input.

### F19 — 🔴 four existing unit specs pinned the unbindable value as correct.

`QueryBuilder.test.js` asserted `expect(params).toEqual([true])` in three places and
`['A', 'B', true]` in a fourth. Each certified a WHERE clause that threw the moment it reached
`db.prepare(sql).all(...params)`.

⚠️ **The contradiction was already in that file, a few dozen lines apart**: `serializeValue(true) === 1`
is asserted too. The write path's conversion was pinned correct and the read path's *absence* was
pinned correct, in one file, and nothing compared them. **A params list is only evidence if something
binds it** — the new block does, with the raw boolean as its control.

### F20 — 🧭 nothing in the template ever creates a `Theme` row.

Measured on a real claim, before this drive seeded one: `GET /classes/Theme` returns **0** rows on a
freshly claimed site. `claimSite` seeds `SiteSettings` and stops there. SB-005's theme editor saves
through `SetDbModelProperties` with `idSource: 'explicit'` fed from `theme.firstItemId`, which is
`undefined` on an empty collection — so **on every new site the theme editor's Save writes nowhere**
and the site keeps the shipped palette permanently.

A census over all three component sets is in the suite: `NewDbModelProperties` appears for `Page`,
`Section`, `ContactMessage` and `SiteSettings`, and never for `Theme`. The control beside it is that
creators *do* exist, so the empty list is an absence and not a broken census.

Two fixes, and picking is a design call rather than a defect report: `claimSite` seeds a default
`Theme` the way it already seeds `SiteSettings` (one node, the pattern is one wire away), or the
theme editor creates on first save. Filed as **SB-014**.

### F21 — 🔴 one `claimSite` writes the `SiteSettings` singleton **twice**.

Two identical rows, 11 ms apart, both `My site` / `home`, both with the world-read ACL, from a single
call on a fresh backend. SB-004 §7 graded `claimSite` with five mutants and could not see it: it
asserted the role, the ACL and every refusal path, and never counted the rows.

**The mechanism, measured with two one-edge arms rather than inferred** (each varies a single wire of
the shipped bundle and nothing else):

| arm | change | rows |
|---|---|---|
| shipped | — | **2** |
| A | drop `grant.unchanged → mark.store` | **1** |
| B | drop `secret.done → settings.storageFetch` | **1** |

The outcome contract fires exactly one of `done`/`unchanged` per invocation (`node.ts:866-905`; a
second report raises `outcome/duplicate`), so two rows means **two invocations**. Arm B names where
they come from: the settings query is the *unfiltered* singleton shape SB-004 s4 arrived at — both
`runOnChange-*` boxes ON, because with them off nothing would trigger it — so it fetches at
graph-build time **and** again on the explicit `storageFetch`. Two `fetched` pulses, two gate runs,
two grants, two stores. Arm A names what turns the second pass into a *record*: the wire whose
comment reads *"a re-run must not go red"*.

🔴 **So the wire that makes a re-run safe is the wire that makes a re-run duplicate**, and the
duplicate is only reachable because a query that must keep its boxes on is also triggered by hand.
The role is unaffected — one member in every arm — which is why nothing downstream ever complained.

**Consequence**: both readers take `rows[0]` and nothing orders that list, so the panel's setup page
can edit one row while the site reads the other — a Save that appears to do nothing. Filed as
**SB-013**.

## 4. What the drive confirmed that had only ever been claimed

- ✅ **F16 is real, and the fix that looks right really does nothing.** The tab reads *About the
  workshop* on `/about` and *Welcome* on `/`, through `Noodl.SEO.setTitle`. The static `Page.title`
  parameter is `Site`, and that is exactly what the not-found page still shows — so the two states
  are distinguishable in one run, which is the only reading that separates the working fix from the
  one the door accepts.
- ✅ **The `Page` node's `description` port is live**: `<meta name="description">` carries the record's
  `seoDescription` on both published pages.
- ✅ **F17 as a property, not an order**: the root URL opens on the page `homeSlug` names.
- ✅ **F14's tie is gone in practice**: `/about` is a record reached through `{slug}` while four admin
  paths sit under `admin/`, and nothing competed for it.
- ✅ **The not-found panel does not flash.** `visible: false` stands until a fetch has answered — the
  drive polls until the page stops changing and never sees the panel on a published page.
- ✅ **A slug that is no record is answered identically to a draft** — same text, same headings, same
  title. A visitor cannot tell "not for you" from "not here".

## 5. Acceptance

1. ✅ **Both component sets authored through the real door into one project, site first**, and
   deployed beside the cloud half. The bundle's component names are asserted against
   `SB004_COMPONENTS`.
2. ✅ **`devOpen: false`, asserted from `started.security.enforced` before any reading is taken.**
3. ✅ **The project is bound to *this* backend**, snapshotted at bind time rather than re-read —
   the dev-open control rebinds the same file, and reading it later would certify the wrong run.
4. ✅ **A published page renders to an anonymous visitor** — heading, section body, site name, no
   not-found text.
5. ✅ 🔴 **An unpublished page 404s, and no part of it is in the document** — asserted against the
   whole `outerHTML`, with the admin-read control and the dev-open control beside it.
6. ✅ **A slug that is no record is indistinguishable from a draft.**
7. ✅ **The derived navigation draws one link per published page in `navOrder` and none for the
   draft** — the check that found F18.
8. ✅ **No failed query on any URL**, per visit rather than cumulatively.
9. ✅ **F21 and F20 measured rather than described**, with one-edge arms and a census.

## 6. What SB-008 did NOT do, stated so it is not assumed

- ⬜ **The panel was never driven.** It is authored, deployed and part of the routing measurement, but
  no browser clicked a Publish button. SB-005's acceptance 6 was about the *consequence* of
  publication being visible through the site, and that is met; "the panel works" is not a claim this
  task makes.
- ⬜ **The contact form was never submitted.** SB-004 §7's `submitContactForm` row is measured on the
  backend; F8 (does the mail reach anyone) is still Richard's.
- ⬜ **Rule 4 (`points to` widens instead of failing) is still UNMEASURED in the browser.** Nothing in
  either panel filters on a Pointer. Three sessions have now recorded this; it stays unanswered.
- ⬜ **SSG is still not a claim this template can make** (SB-006 §7): `routesFromExport` skips dynamic
  `{param}` routes, so the public site is client-rendered. The drive renders client-side, which is
  the honest configuration, and does not test an SSG build.

## 7. Session log

- **s8 (2026-08-26)** — **BUILT and RUN.** 20 specs, 4 controls, 3 one-edge arms; the publication
  boundary holds through the shipped site. Four findings: **F18** (a boolean filter is unbindable on
  SQLite — **fixed**, and it had killed the site's navigation outright), **F19** (four unit specs had
  pinned the unbindable value), **F20** (nothing creates a `Theme` row → **SB-014**), **F21**
  (`claimSite` writes its singleton twice → **SB-013**). Suites: nodegx-backend **104 / 1143**,
  noodl-mcp **62 / 747**, noodl-runtime **141 / 2552**; `typecheck:mcp`, the backend's and the
  runtime's all exit 0.
