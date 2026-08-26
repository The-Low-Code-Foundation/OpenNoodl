# SB-004 — The site is records

**Status: 🟡 DESIGNED + publish flow AUTHORED s2 (2026-08-26).** The data model, the ACL matrix and
the flows below are settled against measured backend behaviour (§1). The publish flow —
`site/SetSectionAccess` + `publishPage` — is authored through **both** MCP doors and green
(`noodl-mcp/tests/sb004Authoring.test.ts`); **this closes s1's debt that the plan door had never
driven a cloud target end to end.** Left: `duplicatePage`, `submitContactForm`, the three remaining
helpers, and a real backend run (§7).

Depends on SB-001/002/003 (all ✅ s1). Feeds SB-005 (admin panel), SB-006 (public site), SB-008
(the drive). Canonical prose model: `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`.

## 1. What this is grounded in (measured s2, not assumed)

Every design decision below rests on one of these. Each was read from the working tree today.

- **The cloud vocabulary is 84 node types**, from `packages/noodl-types/src/node-catalog.json`
  filtered on `availableIn ∋ 'cloud'` — a build-time *measurement* (`scripts/node-catalog`
  registers every node in every runtime), not a declaration. It includes `Query Records`,
  `Create/Update/Delete Record`, `Aggregate Records`, `Filter Records`, `Run Tasks`, `Array Map`,
  `Array Filter`, `Send Email`, `Secret`, `HTTP Request`, `Component Inputs/Outputs`.
- **Classes and columns are created on demand.** `LocalSQLAdapter._ensureTable`
  (`noodl-runtime/src/api/adapters/local-sql/LocalSQLAdapter.ts:649`) auto-creates the table on
  create/save/query, and `create` (`:905-914`) adds a column for every unknown key, typed by
  `inferColumnType`. **The template therefore ships no migration and no schema step** — first write
  wins. (`AdapterFacade.ensureImportShape` is the data-*import* path only; the wire create path is
  `parse-wire.ts:201-202` → `rawCreate` → the adapter.)
- **The ACL vocabulary a graph can emit is exactly three principals**, from
  `dbmodelcrudbase.ts:_getACL` (`:882-947`): `'*'` (target `everyone`), a user id (target `user`),
  and `'role:<name>'` (target `role`) — each with `{read, write}` booleans.
  - `…-target` is `allowEditOnly: true` (`:796-802`) → **a parameter, never a wire**.
  - `…-read` / `…-write` are plain boolean input ports (`:836-858`) → **wirable**. This is what
    makes "publish" a single record write driven by a boolean rather than two code paths.
  - `…-role` is a string port → wirable; `…-userid` is `allowConnectionsOnly`.
- **An absent ACL means public.** `canAccessRecord` (`nodegx-backend/src/security/model.ts:701-718`):
  `if (acl === null || acl === undefined) return true`. There is no explicit deny — a present ACL
  grants to any principal key with the flag `true`, and denies by silence.
- **Two enforcement layers, and they are not switched together** — see §5 F2, which is the sharpest
  thing found this session.
- **A cloud function runs as the system** (master key, per the model doc §Users), so it bypasses
  both layers. Anything a function reads, the function must filter itself.

## 2. The classes

Five, plus one derived thing that is deliberately not a class.

| class | fields | who writes it |
|---|---|---|
| `Page` | `title` String · `slug` String · `published` Boolean · `publishedAt` Date · `navOrder` Number · `showInNav` Boolean · `seoDescription` String | admin panel (content); **`published` only ever by `publishPage`** |
| `Section` | `page` Pointer→Page · `kind` String · `order` Number · `data` Object | admin panel |
| `Theme` | singleton row: `tokens` Object · `name` String | admin panel |
| `SiteSettings` | singleton row: `siteName` · `homeSlug` · `contactRecipient` | admin panel |
| `ContactMessage` | `name` · `email` · `message` · `pageSlug` · `handled` Boolean | **only `submitContactForm`**, as system |

**Navigation is derived, never stored** — a query for published pages with `showInNav`, ordered by
`navOrder`. README §2 asks for exactly this ("navigation derived from published pages"), and it is
also the only version that cannot go stale against the publication state.

`Section.kind` is a string discriminator (`hero` | `richText` | `gallery` | `contact` | `cta`) and
`data` is one `Object` column carrying the kind-specific payload. One column rather than a wide
sparse table because `inferColumnType` (`AdapterFacade.ts:364-377`) types an object as `Object` and
the section shapes have almost nothing in common. Sections are always fetched by page, never
filtered on `data`, so nothing needs to query inside it.

⚠️ **`Section.page` as a Pointer is the one unhedged bet in this model.** A plain `pageId` String
would be the safe choice, and if the pointer-equality path in `Query Records` defects, that is the
fallback — but the Pointer is the idiom the product teaches, and this template exists to exercise
the idiom. It is the first thing authoring should prove; see §6.

## 3. The publication invariant

> **The ACL is the publication state. `published` is a queryable mirror of it. Only `publishPage`
> writes either, and they may never disagree.**

| state | ACL on the Page row *and* every Section row |
|---|---|
| draft | `{ "role:admin": {read:true, write:true} }` |
| published | `{ "role:admin": {read:true, write:true}, "*": {read:true, write:false} }` |

Two consequences that are the whole point:

- **A public visitor needs no `published` filter.** With `find` public at the collection layer, the
  row-level predicate already returns published rows only — it is a permission boundary, not a
  display filter, and the same predicate gates realtime delivery (model doc §Per-record access
  control), so the admin panel's live preview cannot leak a draft either.
- **`published` exists for the admin panel alone**, which can read both and needs to tell them
  apart. It is a mirror, and a spec should assert the two never disagree.

🔴 **Which is why the admin panel must not write `published` directly.** A `Set Record Properties`
on that boolean in the admin graph would move the mirror and leave the enforced state behind. The
publish flow is a cloud function *because* the invariant spans two collections and must be written
in one authority.

🔴 **And a draft must be born with its ACL.** `_getACL` returns `undefined` when a node carries no
access rules, an absent ACL means public (§1), so a page created without the admin-only rule is
world-readable from the instant `Page.find` goes public. **Create Record for `Page`, `Section` and
`ContactMessage` carries the `role:admin` rule from creation**, not from publish.

## 4. The security config (`security.json`, ships with the backend)

`security.json` is policy: diffable, deploys with the backend, MCP-editable
(`nodegx-backend/src/security/state.ts:5-9`) — unlike `secrets.json`, which is machine-local. So
the template can and must ship this table.

A rule is `public` | `authenticated` | `nobody` | `role:<name>`, or an array of those
(`model.ts:63-75`, `validateRuleValue`).

| collection | find | get | create | update | delete |
|---|---|---|---|---|---|
| `Page` | public | public | `role:admin` | `role:admin` | `role:admin` |
| `Section` | public | public | `role:admin` | `role:admin` | `role:admin` |
| `Theme` | public | public | `role:admin` | `role:admin` | `role:admin` |
| `SiteSettings` | public | public | `role:admin` | `role:admin` | `role:admin` |
| `ContactMessage` | `role:admin` | `role:admin` | **nobody** | `role:admin` | **nobody** |

`role:<name>` is available at the collection layer, so the writes say `role:admin` directly rather
than `authenticated` leaning on the ACL to finish the job. The row-level ACL is still load-bearing
and not redundant — it is what separates *published from draft* on the public read path, which no
collection rule can express.

`ContactMessage.create: 'nobody'` closes the browser's direct door: the row is only ever written by
`submitContactForm`, which bypasses both layers because it runs as system. `delete: 'nobody'` keeps
the record of who wrote in from being cleared through the API at all.

Function `call` rules: `publishPage` and `duplicatePage` → `role:admin`; `submitContactForm` →
`public`.

## 5. The functions, in the §1 composition idiom

**Endpoints** — `/#__cloud__/…` with a `noodl.cloud.request` node. Their interface is the Request
node's `params` string, **not** `Component Inputs` (SB-002's correction; `newFunctionFromStep.ts:113-145`).

| function | params | auth |
|---|---|---|
| `publishPage` | `pageId`, `publish` | `role:admin` |
| `duplicatePage` | `pageId` | `role:admin` |
| `submitContactForm` | `name`, `email`, `message`, `pageSlug` | **public** (`Allow Unauthenticated` ticked) |

**Helpers** — `/#__cloud__/site/…`, `Component Inputs`/`Outputs`, **no Request node**, so after
SB-003 they 404 rather than 500 and never appear in the permissions listing.

| helper | job |
|---|---|
| `site/SetSectionAccess` | the `Run Tasks` template: one `Update Record` carrying the two ACL rules for one section |
| `site/CopySectionToPage` | the `Run Tasks` template for duplicate: one `Create Record` cloning a section onto a new page id |
| `site/ContactRecipient` | the Settings-component idiom (as `Stripe/Settings` does): `SiteSettings` + `Secret`, out comes the recipient |

⚠️ **One helper cannot serve two collections, and this is a real limit on the idiom.** `Update
Record`'s `collectionName` is registered as an **edit-only** enum of the project's classes
(`get_node_type` `runtimeBehavior`, s2) — a parameter, never a wire. So the "set the access rules on
this record" step cannot be written once and pointed at `Page` and `Section` in turn: the page's own
ACL is written by an `Update Record` in the endpoint's own graph, and only the per-section write is
a helper. Composition by component instance is bounded by which ports are edit-only, which is worth
saying out loud in SB-002's doctrine.

**`Run Tasks` is the composition primitive.** It is the only iteration the cloud runtime has, it
takes a **component** as its `taskTemplate` and a Template Contract (`Do` in; `Success`/`Failure`/
`Error` out), and it is what the README §1 evidence (`cloud-run-tasks-loop.test.ts`) actually rides
on. So `publishPage` is: Request → `Query Records`(Section where page = pageId) → `Run Tasks`
(template `site/SetRecordAccess`) → `Update Record`(the Page itself) → Response. This is D2's
"composition by component instance" in its literal form, and it is why D2 can stay deferred.

✅ **The task-template mechanic, settled by reading s2 (`runtasks.ts:393-432`).**
`createTaskComponent` instantiates the template with `{ _forEachModel: model, _forEachNode: this }`
— the `Component Object` mechanism — **and then also pushes the item onto Component Inputs**:
`Id`/`id` get the model id, and every key of the item that matches a **declared** component input
is set on it (`:419-432`). So both channels work, and a worker written the ordinary way — Component
Inputs in, Component Outputs signals out — is correct. This is what the `data-run-tasks-batch`
example teaches, and the example is right.

What follows for this design is unchanged, because only *the item's own keys* are pushed:
**there is still no channel for a value that is constant across tasks.** `isPublic` cannot be
handed to the helper separately; the items array is built with `Array Map` so each entry carries
its own `isPublic` beside its `objectId`. One node, and a requirement rather than a preference.

The template contract itself is four port names matched by string, defaulting to `Do` / `Success` /
`Failure` / `Error` and overridable per node (`runtasks-template-contract.ts`). `Error` is optional
by design and its absence is deliberately never warned about.

## 6. Findings this session

**F1 — 🔴 the authored gate cannot see a component named through a `component`-typed parameter.**
`checkRepeaterTemplate` opens `if (node.type !== REPEATER_TYPE) continue`
(`validation/repeaterTemplate.ts:186`, `REPEATER_TYPE = 'For Each'`), so its two resolution codes
(`repeater-template-unresolved`, `repeater-without-template`) reach the browser Repeater and
nothing else. `checkRuntimeContext` (SB-001) walks node **types**; `taskTemplate` is a parameter
value. `parameterValues.component` is `nameTypeFormat('component')` (`parameterValues.ts:369`) — a
*shape* check, not existence and not runtime. The editor's interactive door is safe
(`componentpicker.ts:109-129` filters by runtime and excludes cloud functions); the authored door
that SB-001 just brought "to parity" is not — and the uncovered port is precisely the one SB-004's
whole composition idiom flows through. This is the tenth instance of
`a-gate-can-have-a-hole-shaped-like-the-defect`.
**Status: predicted from source; 4-arm probe written (`noodl-mcp/tests/sb004RunTasksTemplate.test.ts`,
two known-firing controls) — ⏳ not yet run, the phase-75 peer held the machine.** Do not treat as
confirmed until the arms print.

**F2 — 🔴 the two enforcement layers are not switched together, and the asymmetry flatters a drive.**
`devOpenActive` (= `devOpen && loopback`, default `devOpen: true`) appears in exactly one decision:
`SecurityState.aclFor` returns `undefined` (`state.ts:286-287`), disabling **row-level ACL**.
`checkClp` (`model.ts:539-552`) has **no `devOpen` branch** — collection permissions stay enforced.
So on a default local backend:

- CLP refuses an anonymous visitor (default `authenticated`) → the drive *looks* like it enforced
  something,
- while the published/draft distinction, which is **entirely** ACL, was never exercised.

A drive that stops at "anonymous was refused" has measured the layer it did not design and skipped
the one it did. **Worse, it inverts the moment this template's own §4 config lands**: with
`Page.find: 'public'` there is nothing left to refuse, and a loopback backend then serves **every
draft** to anonymous callers. SB-008 must therefore verify with `devOpen: false` — which requires a
real SQLite engine, because `devOpen:false` over ephemeral persistence is a refuse-to-start
(`service.ts:217-223`). Recorded against `verify-the-consequence-not-just-the-mechanism` and
`a-control-can-read-zero-read-it-first`.

**F3 — ⚠️ `submitContactForm` is a public door that writes rows**, and no rate limiting was found in
the sweep. It is the correct shape (one function, fixed row, `create: 'nobody'` everywhere else),
but a template that ships with a public write endpoint should say what stops a bot. Open question
for Richard / possibly a core gap to file.

**F4 — process, not product: the MCP dist on this machine is six days stale and cannot author cloud.**
`packages/noodl-mcp/dist/noodl-mcp.cjs` is dated 2026-08-20 and `/Applications/NodeGX.app/…` 08-21;
both predate SB-001/002/003 (all 08-26). Proven by measurement rather than mtime: a live
`get_project_info` returns `authoringDoctrine` and **no `backendDoctrine`**, so the bound servers
are pre-SB-002. Authoring through them would exercise the old `toPathForm` and land the component
in the browser bundle. The vehicle is instead `noodl-mcp/tests/helpers.ts` → `createServer` from
`src` over a real in-memory MCP client — the actual tool surface, current code. Another instance of
`a-stale-mcp-dist-hides-a-merged-vocabulary-field`.

## 6a. What authoring it actually taught (s2)

Both doors, on the real server: `create_component` for each component, and `create_plan` → two
`stage_plan_operation` calls → `apply_plan` for the pair in one plan. Both land under the
editor-canonical `__cloud__/…` registry key, typed `cloud`, with the component file's `path`
carrying the `#` — **asserted by key and by `path`, never through `store.resolve`** (SB-001's trap).

Three things the door caught that reading had not:

1. **A `stringlist` is one comma-separated STRING, not an array** — `params: ['pageId','publish']`
   is rejected, because the editor calls `.split(',')` on it. The rejection suggested
   `"pageId,publish"` verbatim. Worth teaching in SB-002's doctrine: the Request node's interface is
   the port an agent gets wrong first.
2. 🔴 **`Array Map` cannot carry a constant either.** Its only inputs are `items` / `mapScript` /
   `refresh`, so its script closes over nothing — `nonexistent-port` on `isPublic`. Combined with
   §5's finding that `Run Tasks` pushes only the item's own keys, **the per-item payload must be
   assembled in a `JavaScriptFunction`**, which is also what doctrine §8 wants (once a step needs
   code, all of it in one code node). This is now the shape in the spec.
3. **`RunTasks`' ports are static on purpose and therefore checked**; the record nodes' are not.

🔴 **And the honest limit, which the door says out loud: the ACL configuration is unverified.** Every
run returns `dynamic-port-skipped` infos naming exactly the parameters that carry the security
model — `collectionName`, `acl-admin-*`, `acl-world-*`, `ptype-*`/`preq-*` — because those ports are
generated from the class schema and cannot be seen in the catalog. The message is careful about
this and says the node is *"unverified by that check rather than verified as correct"*. So a green
authoring run means the graph is well-formed; **it is not evidence that the publication invariant
holds.** Only §7's real-backend run can be that, which is the second reason F2 matters.

## 7. Acceptance

1. The five classes exist with the §2 fields, created by first write — no migration step anywhere.
2. A page and its sections created through the admin path carry the `role:admin` ACL **from
   creation** (F3's trap): a fresh draft is not readable by `*`.
3. `publishPage(pageId, true)` sets `"*": {read:true, write:false}` on the page **and every one of
   its sections**, and sets `published: true`; `publishPage(pageId, false)` reverses both. The
   mirror and the ACL agree after each call — asserted, not assumed.
4. `duplicatePage` produces a draft copy with its sections, admin-only ACL, `published: false`.
5. `submitContactForm` writes a `ContactMessage` and sends one email, called with **no session**.
6. Every helper 404s as a function name (SB-003's boundary), and every component authored lands
   under a `/#__cloud__/` registry key — asserted **by registry key and the component file's `path`**,
   never through `store.resolve` (SB-001's trap).
7. Verification of 2–4 runs with **`devOpen: false`** over a real SQLite engine (F2). A run with
   `devOpen: true` is not evidence for any ACL claim and must not be recorded as one.

## 8. Session log

- **s2 (2026-08-26)** — model designed and grounded (§1: cloud vocabulary from the catalog,
  auto-schema from `_ensureTable`, ACL vocabulary from `_getACL`, absent-ACL-is-public from
  `canAccessRecord`, the CLP/ACL asymmetry from `aclFor` vs `checkClp`). F1 confirmed by a 4-arm
  probe with two known-firing controls and filed as **SB-009**; F2 is the sharp one.
  **Publish flow authored through both doors and green** (§6a) — s1's plan-door debt closed.
  noodl-mcp 60 suites / 684 green.
  ⚠️ **One correction made mid-session:** §5 first recorded, from `runtasks.ts:393-408`, that a task
  template receives its item *only* through `Component Object`. Reading on to `:419-432` showed the
  item is also pushed onto matching **Component Inputs**, which is what the `data-run-tasks-batch`
  example teaches and what this spec now uses. The half that survived — no channel for a per-task
  constant — is the half the design depends on, and it was re-derived, not assumed.
