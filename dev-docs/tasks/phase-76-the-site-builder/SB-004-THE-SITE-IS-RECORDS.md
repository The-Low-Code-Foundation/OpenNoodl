# SB-004 — The site is records

**Status: 🟡 AUTHORING COMPLETE s3 (2026-08-26); the real backend run is what remains.** The data
model, the ACL matrix and the flows below are settled against measured backend behaviour (§1). **All
six components — three endpoints and three helpers — are authored through the MCP doors and green**
(`noodl-mcp/tests/sb004Authoring.test.ts`, 13 specs; noodl-mcp 60 suites / 694). s2 closed the debt
that the plan door had never driven a cloud target end to end; s3 finished the set and, while
finishing it, found two defects in the *already-authored* publish flow that no gate can see (§6 F5).
Left: **only §7's real-backend run**, which is the first thing that can say the publication invariant
holds.

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

🔴 **And the template must PROVISION `admin`, because nothing else does** — see §6 F7. `role:admin`
is a row in `_Role`, not a built-in, and the backend-admin *token* is a different principal
entirely. Two calls with the admin credential do it — `POST /admin/roles {name:'admin'}`, then
`POST /admin/roles/:name/users {userId}` — and until they have run, every rule in this table and
every ACL in §3 grants nobody. This belongs in the template's first-run path (SB-005), and §7 should
assert the un-provisioned state refuses, so the step cannot be quietly dropped.

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
(template `site/SetSectionAccess`) → `Update Record`(the Page itself) → Response. This is D2's
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
**Status: ✅ CONFIRMED by measurement s2** — `noodl-mcp/tests/sb004RunTasksTemplate.test.ts`, four
arms. Both controls fired (`wrong-runtime-node`; `repeater-template-unresolved`), and both probes —
a nonexistent helper and a browser component across the boundary — were accepted `0/0/0` and
written to disk. **Filed as its own task, [SB-009](SB-009-A-COMPONENT-NAMED-IN-A-PARAMETER.md)**,
because the fix spans 12 uncovered ports across 8 node types and its blocking promotion needs a
corpus sweep. ⚠️ SB-009 also records the correction to this paragraph's reach: a live-editor check
(`checkTemplateContract`) *does* warn on a missing template for **browser** graphs, and is inert for
cloud — so "the authored door" is the accurate scope, not "every gate".

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

**F5 — 🔴 the publish flow authored in s2 was wrong in two ways, and both are legal graphs.**
Found s3 while reading `Query Records` and `Response` closely enough to author `duplicatePage`.

1. **`publishPage`'s section query had no filter at all.** It carried `collectionName: 'Section'`
   and nothing else, so it returned *every Section in the site* — publishing one page would have
   flipped the access rules on all of them, in one authority, exactly as designed. §5 says
   "Query Records(Section where page = pageId)"; the graph did not say it. An absent `visualFilter`
   is a legal "match everything", so no validator can call it an error.
2. **The Response declared `pageId,published` and wired neither.** A Response's `params` mints
   `pm-<name>` *inputs* (catalog `parameterEncoding`), and a declared parameter with nothing on its
   port is simply omitted — a 200 carrying `{}`.

Both are fixed and, more to the point, **pinned by assertion on what is written to disk**
(`expectQueryFilteredOn`, `expectEveryResponseParameterWired`), because a fix nothing grades is a
fix the next author silently drops. Four mutants graded, each killed by the assertion that names it.
The filter assertion checks *two* things, because the rule alone is not the filter:
`collectFilterParameters` mints `qp-<input>` from the rule and a rule whose port supplies nothing is
**dropped rather than failed** (`saved.ts`, deliberate — that is how an optional filter port works),
so a rule with no wire narrows nothing and says nothing.

Recorded against `verify-the-consequence-not-just-the-mechanism`: s2's run was green, both doors
agreed, every assertion passed — and the flow published the wrong rows and answered with an empty
body. Green meant *well-formed*, which is all it ever claimed.

**F6 — ✅ the plan door resolves an UNAPPLIED sibling, so a helper and its caller fit in one plan.**
Measured s3, and it matters for SB-005/006, which are helpers-plus-callers all the way down.
`stage_plan_operation` on `submitContactForm` — which instantiates `site/ContactRecipient` as a node
**type** — succeeds when the helper is a staged sibling in the same plan, and is refused
(`unresolved-component-ref`) when it is not. The refusal arm is in the spec beside it: without it,
"the sibling resolved" and "staging never resolves references" are the same green.

⚠️ One asymmetry an agent parsing these has to know: `create_component` returns structured
`details.newErrors`; `stage_plan_operation` returns only `details.readable` prose
(`planTools.ts:795-801`). The code is in the line, not in a field.

**F7 — 🔴 nothing creates the `admin` role, and every rule in §3 and §4 names it.**
Read from source s3 while scoping §7's run, and it is a hole in *this design*, not in the backend.

`role:<name>` and backend-admin authority are two different things that share a word.
`principal.kind === 'admin'` is the **credential** — the bearer token minted into
`<dataDir>/secrets.json` — and it bypasses everything: `canAccessRecord` returns `true` for it
(`model.ts:706`), `checkClp` lets it through (`:541`, `:615`), and `aclFor` returns `undefined` for
it (`state.ts:288`). `role:admin`, which is what §3's ACLs and §4's table actually say, is a row in
`_Role` joined to a user through `_Join_users__Role` (`state.ts:305-320`). **Nothing seeds it.**
There is no built-in role of any name, and `signup` in `security.json` is a rule about *who may
sign up* (`model.ts:278`, `:457-462`) — it cannot grant one.

So a fresh deploy of this template, exactly as §4 specifies it, is **un-authorable**: no user holds
`admin`, so `Page.create: 'role:admin'` refuses the site owner, and the `role:admin` ACL on a draft
grants nobody. Only the admin *token* can touch anything, and that is not a thing an admin panel
holds. The template therefore needs a **provisioning step** — create the role, put the owner in it —
which §2 and §4 do not currently have.

⚠️ **Scope of this claim.** It is derived from source, not yet from a run: what is measured is that
no seeded role exists and that `signup` cannot create one. The refusal itself is a §7 assertion, and
a good one — it fails in exactly the direction that would otherwise read as "the permissions work".

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

## 6b. What authoring the other four taught (s3)

`duplicatePage`, `submitContactForm`, `site/CopySectionToPage`, `site/ContactRecipient` — all
through `create_component`, and the contact pair through the plan door as well.

1. 🔴 **`Create Record`'s `sourceObjectId` is a LOCAL read, not a backend fetch.** It seeds from
   `(this.nodeScope.modelScope || Model).get(id).data` (`newdbmodelpropertiesnode.ts:106`), and
   `Model.get` on an id nobody fetched returns an empty model — so an unfetched source seeds `{}`
   **in silence**. It is used in `duplicatePage`, where a `Record` node fetched the page into that
   same component's scope a moment earlier, and deliberately **not** in `site/CopySectionToPage`,
   where whether a Run Tasks task component shares its creator's model scope is a runtime question
   authoring cannot answer. The worker is sent each section's fields inside its item instead.
2. 🔴 **A Pointer is a tagged object on the wire, and `prop-<field>` stores whatever it is given,
   verbatim** (`dbmodelcrudbase.ts:650-652`). `inferColumnType` types the column by reading
   `__type === 'Pointer'` (`LocalSQLAdapter.ts:1251`). So writing a bare id string into
   `Section.page` creates a **String** column on first write — after which §2's `pointsTo` filter
   has no `targetClass` and refuses (`parse.ts:219-232`). §2's "one unhedged bet" is won or lost on
   one line of one code node, and the bet fails **loudly** rather than returning an empty set, which
   is the one mercy here.
3. **`receive` is the ordering-safe request trigger** — "fires when a request arrives, *after every
   parameter output has been updated*". Triggering a query from `pm-<param>` instead, as s2's
   publishPage did, works only because wire order happened to deliver the filter value first.
4. 🔴 **The instance door IS checked where the parameter door is not — both arms now in one file.**
   `site/ContactRecipient` named as a node **type** is refused with `unresolved-component-ref` when
   absent; the same helper named through `RunTasks.taskTemplate` is accepted `0/0/0`
   ([SB-009](SB-009-A-COMPONENT-NAMED-IN-A-PARAMETER.md)). That is the sharpest form of SB-009's
   claim: not "the gate does not run here", but **the same reference, checked one way and not the
   other**, in the same validator, on the same graph.

⚠️ **What s3 still could not verify, and neither can any authoring run:** the ACL parameters
(`acl-*`), `collectionName`, `prop-*` and `ptype-*`/`preq-*` all return `dynamic-port-skipped`. The
Pointer round-trip (finding 2), whether a code node receives Models or plain objects from
`Query Records.items`, and whether `Run Tasks` fires `completed` on an empty item list are all §7
questions.

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
8. **The run drives the components this task authored**, reconstructed from disk — not hand-written
   twins of them. See §7a: a twin bundle would measure a copy and leave the artefact untested.

## 7a. How §7 runs (scoped s3, not yet built)

The harness exists; the bridge into it is the part that needed finding.

- **Boot.** `new BackendService({ dataDir, port: 0, … })` then `await service.start()`; the URL is
  `started.listen.url`. `allowEphemeral` **defaults to `false`** (`config.ts:81`) and no test in the
  suite overrides it, so passing nothing already yields a real SQLite engine. Write
  `<dataDir>/security.json` with `devOpen: false` **before** `start()`, and assert
  `started.security.enforced === true` — that assertion is what makes F2's trap visible rather than
  assumed. HTTP helpers: `nodegx-backend/tests/helpers/http.ts` (`httpClient`, `adminHeaders`).
- **The closest working precedent is `tests/cloud-system-roles.test.ts`** — `devOpen: false`, a cloud
  function called over HTTP, and a row that a reader 404s on until a role is granted. It is the
  template to copy, including its role-granting (which F7 says this template needs anyway).
- 🔴 **Deploy the REAL components.** A cloud function is registered by dropping a
  `*.workflow.json` bundle (`{components, settings, metadata}`) into `<dataDir>/workflows/`, where a
  component is the **legacy nested `graph.roots` shape** — not the v2 split files the MCP door
  writes. The converter is pure and already re-exported for exactly this:
  `reconstructLegacyComponent` / `unflattenNodes` (`noodl-editor/src/editor/src/io/ProjectImporter.ts:82`,
  `:185`), re-exported by `noodl-mcp/src/editor-deps.ts:250-258`, with zero runtime imports — no
  `ProjectModel`, no `NodeLibrary`, no Electron. `noodl-mcp/tests/roundtrip.test.ts` is a working
  template for calling it from plain jest. So §7 can author through the MCP door and then run *what
  the door wrote*, which is the difference between testing this task's output and testing a
  paraphrase of it (`measure-the-artefact-before-believing-the-task-file`).
  ⚠️ `visualRoots` is a fixed point through that converter (`editor-deps.ts:243-249`) — irrelevant
  for cloud components, which have no visual tree, but do not reuse the bridge for a page.
- ⚠️ **Two gaps the precedents do not cover**, so budget for them: no existing backend test puts a
  Record node (`NewDbModelProperties`/`SetDbModelProperties`/`DbCollection2`) inside a cloud
  function at all, and none drives a project directory end to end. Both are new ground, and the
  first is where §6b's Pointer question (finding 2) gets settled.
- ⚠️ A cloud function runs with `masterKey` (`service.ts:490-500`), so **its own writes bypass both
  layers**. The invariant is therefore tested from the *outside*: an anonymous and a non-admin
  caller reading `Page`/`Section` over HTTP, never the function's own view.

## 8. Session log

- **s2 (2026-08-26)** — model designed and grounded (§1: cloud vocabulary from the catalog,
  auto-schema from `_ensureTable`, ACL vocabulary from `_getACL`, absent-ACL-is-public from
  `canAccessRecord`, the CLP/ACL asymmetry from `aclFor` vs `checkClp`). F1 confirmed by a 4-arm
  probe with two known-firing controls and filed as **SB-009**; F2 is the sharp one.
  **Publish flow authored through both doors and green** (§6a) — s1's plan-door debt closed.
  noodl-mcp 60 suites / 684 green.
- **s3 (2026-08-26)** — **authoring finished**: `duplicatePage`, `submitContactForm`,
  `site/CopySectionToPage`, `site/ContactRecipient` (§6b), plus the contact pair through the plan
  door. **F5 found in s2's own output** — the publish flow queried every Section in the site and
  answered with an empty body; both fixed and pinned by disk-level assertions, four mutants graded.
  **F6**: a plan can hold a helper and its caller, measured beside a known-firing refusal arm.
  SB-009 gained its other half: the same helper, checked as a node type and unchecked as a
  parameter, asserted by diagnostic **code** in one file. noodl-mcp 60 suites / **694** green,
  `typecheck` clean. §7 is untouched — nothing here is evidence for the invariant. Also **F7** (the
  `admin` role nothing creates, read from source) and **§7a**, which scopes the real run: the
  harness exists, and `reconstructLegacyComponent` is pure enough to feed it the components the MCP
  door actually wrote rather than twins of them.
  ⚠️ **One correction made mid-session:** §5 first recorded, from `runtasks.ts:393-408`, that a task
  template receives its item *only* through `Component Object`. Reading on to `:419-432` showed the
  item is also pushed onto matching **Component Inputs**, which is what the `data-run-tasks-batch`
  example teaches and what this spec now uses. The half that survived — no channel for a per-task
  constant — is the half the design depends on, and it was re-derived, not assumed.
