# Phase 76 — task list

Status legend: ⬜ open · 🟡 partial · ✅ done · 🔒 blocked on a ruling · 🧭 needs Richard

Build order per README §4: SB-001..003 (enablement — the core bugs this template was picked to
flush out), then SB-004..006 authored *with* the new surface, then SB-007/008.

## Rulings (README §5)

- 🧭 **D1 — one project or two?** Draft assumption in force: **one** project, role-gated admin pages.
- 🧭 **D2 — function-calls-function stays deferred.** Assumed confirmed unless SB-004 hits a wall.
- 🧭 **D3 — does SB-003's boundary fix land in 0.2.1?** Touches the permissions panel and every
  existing backend.

## Tier 1 — enablement

- ✅ **SB-001** — [the cloud component Claude can write](SB-001-THE-CLOUD-COMPONENT-CLAUDE-CAN-WRITE.md)
  — **BUILT + SPECCED s1.** The README's finding 3 was half-wrong: `toPathForm` was fine, the bare
  `pathToLegacyName` was the leak — now delegates to the importer's `toLegacyName`. Type/path
  cross-check at the door; `checkRuntimeContext` in the SHARED gate (`wrong-runtime-node`,
  blocking; gate parity preserved); `looksLikePageComponent` cloud-safe; AWP-002 pins all four
  types. 10-spec suite, mutation-graded; MCP 57/675/0. ⚠️ Plan door with a cloud target: pieces
  tested, end-to-end drive is SB-004's dogfood.
- ✅ **SB-002** — the backend has a vocabulary too — **DONE s1.** `BACKEND_DOCTRINE_MD`
  (`prompts/backend.ts`, imports nothing, same containment rule as the other doctrines) rides
  `get_project_info` as `backendDoctrine` beside `authoringDoctrine` — a result field because the
  surface budget gate measures `instructions` and a result rides free (`toolDisclosure` green
  before and after proves the surface did not grow). Carries the one correction that matters: a
  cloud FUNCTION's interface is the Request node's `params`, **NOT Component Inputs** (helpers use
  Component Inputs — the frontend doctrine was actively misleading here). Specced over real stdio
  (verbatim bytes + read-only omission + claim census). Canonical prose model stays
  `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`, referenced from the module header.
- ✅ **SB-003** — [a helper is not an endpoint](SB-003-A-HELPER-IS-NOT-AN-ENDPOINT.md) — **DONE
  s1.** Helpers 404 identically to nonexistent names, write no execution record, vanish from the
  permissions listing/status; mutation-graded spec over real HTTP; full backend suite 102/1094/0.
  Name rule RESOLVED: nested names legitimate (every caller encodes — measured), RE re-scoped in
  its header as a minting style. 🧭 D3 (rides 0.2.1?) still Richard's.

## Tier 2 — the template

- ✅ **SB-004** — [the site is records](SB-004-THE-SITE-IS-RECORDS.md) — **DONE s4. The invariant is
  measured.** All seven components authored through both MCP doors, deployed to a real SQLite
  backend with **`devOpen: false`**, and driven over HTTP from the outside — anonymous and non-admin
  callers, never the function's own view (`nodegx-backend/tests/sb004-publication-invariant.test.ts`,
  **29 specs**; backend **103/1123**, noodl-mcp **60/696**, both typechecks clean). Acceptance 1–9
  all met; §7 carries a table of what each one actually turned up.
  🔴 **The run found four defects that both authoring doors had passed, and every one of them shipped
  a broken template:**
  **F10** — a `JavaScriptFunction`'s custom signal outputs are DEAD once deployed unless the graph
  declares them as ports (the derivation is behind `isRunningLocally()`); `claimSite` threw
  `Outputs.ok is not a function` and **504'd after 30s**.
  **F11** — a signal is not a promise that the values beside it arrived; values drain one input per
  update pass, so a *correct* setup token was refused and `duplicatePage` copied 1 of 2 sections.
  **F12** — a Query Records node fetches ONCE, UNFILTERED, at graph-build time, and that result is
  what the graph acts on: **publishing one page opened every Section on the site**, with the correct
  filter sitting on disk. F5's defect by a second road no authored assertion can see.
  **F13** — `points to` cannot narrow from a cloud function and **widens instead of failing**
  (no schema in the cloud runtime; the refusal is reported through the absent editor connection).
  §2's unhedged bet lost; the String fallback §2 itself named is taken — `Section.pageId`.
  All four fixed, four mutants graded. F10 and F12/F13 are **core gaps, not template gaps**, filed as
  **SB-010** and **SB-011**. The four runtime rules are in
  `dev-docs/reference/BACKEND-AUTHORING-MODEL.md` §"Five things a deployed graph does not do the way
  the canvas does".
  ⚠️ **F8 is still Richard's** and blocks SB-006's contact section.
  ⚠️ Acceptance 5 is met on the row, not the mail (no SMTP in the run); acceptance 2's "admin path"
  is the REST API as the owner, because SB-005's panel does not exist yet — see §7.
  ⚠️ **Its graph moved in s10.** `claimSite` gained the SB-013 fix (gate boxes off, a readiness
  guard on `items`, the query's load-time fetch off) and SB-014's `Theme` creator. The suite gained
  five arms and the two assertions it never had — count the rows, count the themes. Read
  `sb004Components.ts` as it is, not as §6a describes it.

- ✅ **SB-005** — [the admin panel](SB-005-THE-ADMIN-PANEL.md) — **BUILT s6, CLOSED s8.**
  Structurally complete and mutation-graded s6; **behaviourally measured s8** by SB-008's drive.
  Six browser components through the real door
  (`noodl-mcp/tests/sb005Components.ts`), **21 specs / 9 mutants**
  (`noodl-mcp/tests/sb005AdminPanel.test.ts`). Acceptance 1–5 met s6; **6 met s8 in two halves** —
  a draft is invisible to an anonymous visitor through the shipped site with enforcement on
  (SB-008), and the state that draft is in is the state this panel's `Create Record` authors (s6,
  two mutants). ⚠️ **The residual is named rather than rounded off**: the row was written over REST
  carrying the panel's ACL, **not by a click**. Nothing has driven the panel's UI.
  🔴 **A green authoring run means well-formed and nothing else** — the phase's own lesson, three
  times over. What building it measured (§7), each item having changed a graph:
  **rule 2 does not bite `CloudFunction2`/`Query Records`** (both defer through
  `scheduleAfterInputsHaveUpdated`; F11 was about a *producer* emitting signal and value in two
  passes, not about signals);
  **rule 3 does not transfer whole** — a JS output publishes only when it CHANGES
  (`simplejavascript.ts:162`), so a panel's refresh MUST be a `storageFetch` wire, and acceptance 4
  was rewritten around the half that is load-bearing;
  **a new rule the draft did not have** — an `Update Record` must carry NO access rules, or saving a
  title on a *published* page rewrites its ACL to draft-only while `published` stays `true`;
  and **acceptance 3 refined** — creation may state `published: false` beside the draft ACL (as
  `duplicatePage` does); an *update* is what makes mirror and ACL disagree.
  ⚠️ Near-miss worth carrying: `options.items` as a comma string is a **static** `array` port, so no
  `dynamic-port-skipped` info covers it and the door was silent — it would have thrown on render.
  A static port carrying a structured value is a gap no diagnostic here names.
  ⚠️ **Rule 4 is still UNMEASURED**; nothing filters on a Pointer. Do not record it as answered.
  🔴 **Amended s7 by SB-006 F14**: the four page `urlPath`s moved under `ADMIN_PATH_PREFIX`
  (`admin/pages`, `admin/setup`, `admin/theme`, `admin/page/{pageId}`). They were one segment each,
  which ties with the public site's catch-all `{slug}` — resolved by the order the components were
  written in. The 21 specs are unchanged and still pass.

  ✅ **The claim the task owed is now held on the real path.** SB-004 §7 wrote its rows through the
  REST API as the owner because this panel did not exist, so no spec could tell a panel that sets the
  draft ACL from one that does not. `Create Record` for `Page` and for `Section` now carries the rule
  as parameters, asserted rule by rule against SB-004's own constant and graded by two mutants —
  including the subtle one an author actually writes, an `accessControl` list whose rule parameters
  are missing, which builds **no ACL at all**. ⚠️ That is the *authored* claim; whether the row
  written at run time carries it is still SB-008's.
  ✅ Carried from s5's grounding, both still true: `Page` is invisible to every catalog listing an
  author would use but the write door refuses a page component without it by name, so the cost was
  one round-trip (and, in the event, none — every page here was built around a `Page` node);
  and `CloudFunction2`'s `in-`/`out-` parameters register on the **parameter** path
  (`nodescope.ts:203`), which is what lets one endpoint serve a Publish and an Unpublish button as
  two constants with no wires.
- ✅ **SB-006** — [the public site](SB-006-THE-PUBLIC-SITE.md) — **BUILT s7, CLOSED s8.** Five
  browser components through the real door (`noodl-mcp/tests/sb006Components.ts`), **29 specs /
  12 mutants / 1 control** (`noodl-mcp/tests/sb006PublicSite.test.ts`). Acceptance 1–8 met s7;
  **9 was SB-008's and is now ✅ MET.**
  🔴 **s8 also found that this site had never had a navigation.** The nav query filters a boolean
  literal, and a boolean literal could not be bound at all (SB-008 F18) — so acceptance 4's third
  query shape was structurally right and returned a 500 every time. Fixed in the adapter; the drive
  now reads two links in `navOrder`.
  🔴 **It changed a file SB-005 had already graded**, and that is the session's headline finding:
  **F14 — the public site's catch-all `{slug}` ties with every one-segment sibling page, and the
  Router breaks the tie by the order the components happened to be written in**
  (`router.tsx:775-783`, the guard is `>` not `>=`). So `/admin` resolving to the panel rather than
  to a content page called "Admin" was luck. SB-005's four page paths moved under `ADMIN_PATH_PREFIX`
  (`admin/pages`, `admin/setup`, `admin/theme`, `admin/page/{pageId}`), which removes the tie rather
  than relying on it — `{slug}` still matches `/admin/pages`, at distance 1, and distance is read
  before order. SB-005's 21 specs still pass. The assertion re-implements the Router's own rule over
  **both panels' pages at once**, which is why this suite authors both into one project.
  Three more, each of which changed a graph:
  **F15** — a component instance has **only** the ports its `Component Inputs` declares, so `visible`
  cannot go on one and conditional placement needs a wrapper `Group` (the door refuses it by name;
  the same run also raised `inert-dimension` on `objectFit` without `sizeMode: 'explicit'`, and
  🔴 `unitless-dimension`: a bare number on a dimension port is read as a **percentage**);
  **F16** — a `Page` node's **`title` port is dead after export** (the Router titles from the exported
  `routerIndex`, `router.tsx:584`) while its **`description` port is live** (`Page.tsx:162-168`), so
  a records-driven title must go through `Noodl.SEO.setTitle` — on the one template whose product is
  SEO, the fix that looks right does nothing;
  **F17** — the door makes the **first page written** the router's start page, so authoring order
  decides where the app opens; the panel-first order left `startPage: /Pages/PageEditor`, an editor
  for no record.
  🆕 **A third query shape**, and it is what most of this site is made of: a query filtered by a
  **literal** keeps its load-time fetch, because the literal is on the node from the moment it is
  built and there is no `qp-` port for anything to trigger. **The precondition of SB-004's fix is a
  filter PORT, not a filter** — the sentence a future author will get wrong.
  🆕 **Two cross-file contracts now checked**: the theme keys `buildTokens` writes are the keys
  `applyTheme` reads, and every field a section view reads out of `data` is one `Admin/SectionRow`
  can write. Neither was checked anywhere before.
  ⚠️ Also recorded: `isEmpty` is `true` **before** the first fetch by contract, so a not-found panel
  wired to it shows from load; `For Each` has no channel for a value constant across items (the
  repeater family's half of SB-004 §5's `Run Tasks` limit), which is why the contact form is a
  sibling of the section list; and 🔴 **SSG skips dynamic `{param}` routes**, so it would pre-render
  the three literal admin paths and *not* the public site — a claim SB-007 must not make.
  🧭 **One ruling: `Section.kind` has five values and `data` can express four.** `cta` has no
  destination and no control would write one. Either the panel drops it or `data` grows
  `linkSlug`/`linkLabel`; the second changes SB-004 §2's class model, so it is Richard's.
  ⚠️ **Rule 4 is still UNMEASURED.** Nothing here filters on a Pointer either.
  ✅ **F8 does not block the browser half**, contrary to the s6 handover: `site/ContactRecipient` is
  where the recipient lives and the form names no recipient. What F8 blocks is the claim that a
  submitted message *reaches* anyone — SB-004 §7's territory, still open.
- ✅ **SB-007** — [it ships as a template](SB-007-IT-SHIPS-AS-A-TEMPLATE.md) — **DONE s9.**
  On the embedded shelf as `embedded://site-builder`, category `site`, and its content is
  **generated from the components the door writes** — `npm run template:site-builder`
  (`scripts/generate-site-template.ts` → `noodl-mcp/tests/sb007Template.ts` →
  `…/templates/site-builder.content.json`, 19 components, 191 nodes). **22 specs**
  (`noodl-mcp/tests/sb007Template.test.ts`) + **12** (`noodl-editor/tests-unit/sb-007/`),
  6 mutants graded.
  🔴 **The task's real content was the component five sessions never authored.** Every
  prior run authored into `tests/fixtures/demo-app`, which already holds an `App` with a
  `Router` named `Main` — and `ROUTER = 'Main'` in SB-005 is a reference to *that fixture's
  node*, which eleven `RouterNavigate` nodes point at. Into a clean skeleton the door
  writes every page, **succeeds on every one, and registers nothing**:
  `pageRegistration.ts` treats a router-less project as legitimate, so `registeredPages` is
  simply **absent from the payload** — no diagnostic, no field to notice missing. Measured
  as a one-edge arm: **18 components / 5 pages / 5 green writes / 0 registered** against
  **19 / 5 / 5 / 5**, everything else held. So the `App` shell is part of the product and is
  authored through the same door.
  🔴 **The template is generated, and the drift gate is byte equality over the whole
  artefact.** Hand-writing the graphs would twin four suites at once. Regeneration is
  deterministic because id remapping, auto-placement and page registration are all
  functions of the authoring order; the three per-write fields that are not (`created`,
  `modifiedBy`, component `id`) are dropped so the comparison can be over *all* of it
  rather than a chosen part. Graded: editing `sb006Components.ts` without regenerating
  reddens with the line, both strings, and the command.
  🔴 **F22 — `instantiateContent` missed a field that names node ids, and it was missed
  because nothing had one. FIXED.** It regenerates node ids and rewrites connections but
  not `graph.visualRoots`; `hello-world` is hand-written with none, and it was the only
  embedded template. Every v2-door component carries one — **12 dangling ids measured in
  an installed project before the fix**. ⚠️ The near-miss: a rewrite matching *any* string
  equal to an old id would have corrupted eight parameters here (`as: 'section'`,
  `as: 'nav'`, `as: 'header'`, five `flexDirection: 'row'`) — graph ids and HTML element
  names come from one small vocabulary. Cost is bounded: `NodeGraphModel` re-derives
  `visualRoots` on save, so the window is install → first save, and every reader taking
  the file at face value is in it.
  ✅ Also checked over the shipped artefact, none of it checkable over the component sets:
  the router is named what all eleven navigates ask for, lists every page, opens on
  `/Pages/Site` (F17); reference closure for instance types, repeater templates and
  **routed** navigate targets (the gap `pageRegistration.ts` names in its own header —
  `checkNavigation` resolves against component *names*, not registration); and F14's tie
  re-read as segment counts over both panels in one router.
  🧭 **SB-015 filed**: the policy this template cannot carry.
  ⬜ Nothing has opened it in the editor, and nothing has deployed a project made from it.
  **Relayed from the FB-005 T3 session, 2026-08-26 (uncommitted in the shared checkout at relay
  time — verify by commit, not by this note):** reusable pieces exist — `hooks/useProjectTemplates.ts`
  **Relayed from the FB-005 T3 session, 2026-08-26 (uncommitted in the shared checkout at relay
  time — verify by commit, not by this note):** reusable pieces exist — `hooks/useProjectTemplates.ts`
  (`TemplateGalleryState`), `TemplateStepBody` (hook-free, jest-renderable), and
  `models/template/PlatformTemplateProvider.ts` (`community://<slug>`). On any human-facing surface
  use `templateRegistry.listing({})`, NOT `list()` — `list()` swallows a provider failure, so an
  outage reads as an empty shelf. 🔴 **Ship EMBEDDED, not platform**: platform templates go to
  Postgres via `publish-project-template.ts` but the editor cannot see them — nexus-1 lacks the
  migration and routes, and `COMMUNITY_URL` is a hardcoded constant with no env override. Embedded =
  a `*.template.ts` + one map line in `EmbeddedTemplateProvider`, offline, in the picker immediately.
  ✅ **Category vocabulary settled with FB-005 T4 (s1) and ENFORCED on their side:** this template
  uses `site` — the platform CHECK vocabulary (starter/data-app/dashboard/site/form/integration) —
  in the embedded provider's field. `EMBEDDED_TEMPLATE_CATEGORIES` in
  `tests-unit/fb-005/template-shelf.test.ts` now rejects prose categories (known-firing arm), so
  `site` passes unchanged and a wrong string reddens loudly.
  **Relayed by the FB-005 peer 2026-08-26, T4 committed (`fe9bade4`) — verify by commit:** the
  category vocabulary cannot express 3 of Richard's 8 roster templates (`pixel-game`,
  `interactive-fiction`, `shared-canvas` all collapse to `starter` under `0020`'s CHECK) — **not
  ours**, `site` is in the vocabulary, but the ruling is coming. `TemplateStepBody` gained optional
  `filter`/`onFilterChange`, so this call site is unaffected; if the Templates tab wants the facet
  bar, use the exported `filterTemplates` rather than a second matcher, so a pill's count and its
  rows come from one pass. Cards now draw the category *label*, not the slug.
- ✅ **SB-008** — [the drive](SB-008-THE-DRIVE.md) — **DONE s8. The browser half is measured.**
  Both panels authored through the real door into one project (**site first**), deployed beside
  SB-004's cloud half on real SQLite with **`devOpen: false`**, driven in headless Chrome as an
  **anonymous** visitor: `packages/nodegx-backend/tests/sb008-public-site-drive.test.ts`,
  **20 specs / 4 known-firing controls / 3 one-edge arms**.
  🔴 **This closes SB-005 acceptance 6 and SB-006 acceptance 9** — the same claim from two sides, and
  the only two criteria in the phase left deliberately unmet. A published page renders to an
  anonymous visitor; an unpublished one shows the not-found panel and **no part of it is anywhere in
  the document** (asserted against `outerHTML`, not `innerText` — a draft behind `visible: false` is
  `display: none`, which `innerText` skips).
  🔴 **The absence claims stand on four controls**, because "the draft did not appear" has a dozen
  causes that are not permissions: the published page renders through the same instrument; the admin
  *can* read the draft over HTTP; the **dev-open twin** — same project, same seed, one config line —
  **does** render the draft; and F18's raw boolean throws.
  🔴 **Four findings, one of them fixed and it had killed a whole feature:**
  **F18** — 🔴 **a boolean filter cannot be queried on the SQLite backend at all.** The write path
  folds booleans to 0/1 and the read path never did, and `node:sqlite` refuses to bind a JS boolean —
  so it *threw*: 500 from `/classes/:c`, `query-records/query-failed` in the browser. SB-006's derived
  navigation filters `showInNav`, so **every page of the site rendered with no navigation** and the
  only trace was a console line. **Fixed** (`convertQueryValue`, all four binding sites); nothing that
  worked before can regress, because every affected path threw.
  **F19** — four existing unit specs pinned the unbindable value as correct, in a file that also
  asserts `serializeValue(true) === 1` a few dozen lines away. **A params list is only evidence if
  something binds it.**
  **F20** — 🧭 **nothing in the template ever creates a `Theme` row** → **SB-014**.
  **F21** — 🔴 **one `claimSite` writes the `SiteSettings` singleton twice** → **SB-013**.
  ✅ Also confirmed rather than claimed: **F16 is real in a browser** (the tab reads the record on a
  published page and the static `Site` on the not-found one, in one run); the `description` port is
  live; the root URL opens on `homeSlug`'s page; a slug that is no record is indistinguishable from a
  draft.
  ⬜ **Not done, stated so it is not assumed**: the panel was never *clicked* (it is authored,
  deployed and part of the routing measurement); the contact form was never submitted; **rule 4 is
  still UNMEASURED**; SSG is still not a claim this template can make.

## Tier 3 — found while building

- ✅ **SB-015** — [a template cannot carry its own permissions](SB-015-A-TEMPLATE-CANNOT-CARRY-ITS-OWN-PERMISSIONS.md)
  — **DERIVED s9, DRIVEN s11, BUILT s12 as shape 1.** The template ships
  `site-builder.security.json`; `EmbeddedTemplateProvider.install` writes it into a new
  project as `nodegx.security.json`; the backend installs it as its own `security.json` at
  startup **step 1.4, before `SecurityState`** — because a policy applied one step later is a
  correct file on disk that the running process is not enforcing. **22 backend specs + 5
  editor specs, 4 mutants graded** (`sb015-project-policy.test.ts`,
  `tests-unit/sb-015/template-ships-a-policy.test.ts`).
  ✅ **§3's two objections are answered rather than argued away** (§6.2–6.3): the absence is
  the no-op, so nothing migrates; and a received policy can only ever replace
  `defaultSecurityConfig()`, never a `security.json` somebody already has — the rule
  `deploy/entrypoint.sh` has followed since WF-003, graded by a mutant. When it *cannot*
  apply, that is a named outcome with a message, because a correct policy that is not the one
  being enforced is this task's own bug.
  ✅ **The local case has an answer**: verbatim, `devOpen` included. Any other answer leaves
  the author testing with the boundary off and shipping with it on. 🔴 **And it has a stated
  cost** — enforced locally, an author is anonymous on their own machine until `claimSite`
  puts them in `admin`, and the `SITE_SETUP_TOKEN` that needs is a secret **provisioning does
  not write**. ✅ **DRIVEN s13** (`sb015-first-local-run.test.ts`, **14 specs / 3 mutants**,
  two arms differing in that one secret and nothing else).
  🔴 **F27 — the prediction was wrong in the direction that matters.** §6.4 predicted "a site
  that renders, a nav, and an admin panel whose every write is refused". A person actually
  gets **the not-found panel on their own home page** — `claimSite` **400**, roles **`[]`**,
  every write **403**, and **no `SiteSettings` or `Theme` row at all**, because `claimSite` is
  what mints them (SB-013/SB-014). The refusal is at the start, not the edge.
  🔴 **That screen now has THREE pixel-identical causes** — a genuine draft (SB-008), a
  policy-refused read (F24), and an empty site nobody could claim — wanting three different
  fixes, and **the one a person reaches for first is turning the boundary off**.
  🔴 **F28 (s14) — BOTH of §6.4's candidates were unbuildable as written**, and the option
  set was the wrong shape rather than the wrong number. *"The setup page mints and stores the
  token"* cannot be built: the only door that writes the `functions` namespace is
  `PUT /admin/secrets/:name`, admin-gated, and `devOpen: false` (which this template ships)
  means gated on loopback too — so a template graph reaches it only by carrying an admin
  credential. *"Provisioning seeds the token"* is self-defeating in its obvious form: a
  minted value the author cannot read is not a fix, and the log is closed to it because
  `SecretValueScrubber` redacts every `functions` value ≥8 chars — on a 5s refresh, so it
  would leak the real token *sometimes* and print `REDACTED` otherwise.
  ⚠️ **And F28's own first census was wrong**, which is the sixth instance of the phase's
  shape and the first this task file produced itself. It said `/admin/secrets` had no caller;
  the route is **mounted** and the three `backend:*` IPC channels **exist** — only the
  renderer panel was missing. Two known grep lies stacked: `--include="*.ts"` excluded
  `BackendManager.js`, and `HttpServer.ts` carries **one NUL byte** so grep skips it as
  binary. 🔴 **The known-firing control fired and did not help**, because control and subject
  were read through the same two blind spots — a control only bounds the error when it sits
  on the *other* side of the suspected blindness.
  ✅ **RULED s14 (Richard): build the missing Secrets panel** — the only shape that adds no
  new credential path. ✅ **BUILT s14**, registered as the **eighth** backend surface, with
  its decisions extracted to `secretsPanelModel.ts` because jest here is
  `testEnvironment: 'node'` and the component cannot be mounted. **33 specs / 10 mutants, 10
  killed**, and the spec pins the renderer's duplicated name-pattern and env-prefix against
  the backend's own constants — nothing previously failed when those two copies disagreed.
  ✅ **F27's SCREEN IS FIXED s14.** `diagnoseNotFound` drives the panel's text and
  visibility: *That page could not be found.* / *This site has not been set up yet.* /
  *This site’s pages are not available right now.* ⚠️ None names a credential, collection or
  policy — all three are read by visitors, and a spec asserts it.
  🔴 **Two orderings were wrong first, and only the drives caught them.** (1) An unclaimed
  site makes the Page query **fail**, not return empty — `claimSite` creates the collections
  — so "refused" and "not set up" are simultaneously true and the condition that *explains*
  the other must win. (2) 🔴 **`claimed === false` is not evidence of an unclaimed site**: it
  comes from the settings query's `items`, and a **refused** query publishes an empty `items`
  exactly like an **empty** one (`Run` is additive, so the reader runs on `items` regardless
  of `fetched`). Arm C of `sb015-default-policy-drive` is the refused case and was reporting
  itself as "not set up". ✅ Fixed by wiring the settings query's **`error`** in beside it —
  **the known-firing-signal rule in its exact form**.
  🆕 **Three specs that ASSERTED the defect went red and were rewritten to assert the fix**
  (§6.4c), and **one mutant stopped biting**: it found its target by script content, so when
  visibility moved to a new node it mutated a node the assertion no longer read and
  **survived**. It now resolves its target *through the wire* it asserts about. Its sibling
  `toContain('if (Inputs.rows === undefined) return;')` was a source-text check pinning a
  spelling; it now **runs** the script with no inputs and asserts nothing is published.
  🔴 **The finding that came free: `SITE_SECURITY` was a typed constant in a test helper**, so
  SB-008 measured a publication boundary produced by a file no project would ever receive.
  `helpers/site-drive.ts` now imports the shipped artefact — one copy, and what the drive
  measures is what a person gets. **SB-008's 20 specs pass unchanged.**
  ✅ **BOTH SPAWNERS, s13.** The editor's passes `--project-dir` too, so §1's claim no longer
  has a path it does not hold on. **20 specs / 7 mutants**, split across the two runners that
  can each see one half of the chain (`tests-unit/sb-015/editor-spawner-passes-project-dir.test.ts`
  12, `tests-main/local-backend/service-supervisor-project-dir.test.js` 8).
  🔴 **F26 — §7 predicted "more than one call site (auto-start on project open, the panel)".
  There are FOUR**: those two, plus `provisionBackend` and `models/lessonbackend`, which
  nothing had named. The hole is closed twice over rather than once, because the two halves
  do not cover each other — **`projectDir` is a REQUIRED POSITIONAL PARAMETER** of the shared
  helper, so a fifth call site does not compile until its author decides; and **a census
  asserts no renderer module invokes `backend:start` except the helper**, because the compiler
  cannot see a call that bypasses it. ⚠️ **Fourth time this phase a recommendation's own
  numbers were wrong** (SB-013's row count, SB-016 §4/F25, s11's F24, this) — see §6.7.
  🆕 The census **reddened on prose** when written as a quoted-string match, which is the
  looser instrument despite reading as the tighter one; it strips block comments and matches
  the bare string. 🆕 `buildSpawnArgs` was **extracted** from `ServiceSupervisor.start()` —
  SB-016's move, same reason: `start()` spawns a bundle that need not be built, so the only
  other available assertion was source-text, which passes on dead code.
  ⬜ Still not opened in the editor; still no `secrets.json` channel; `securityPolicy` is on
  `ProjectTemplate` so only **embedded** templates can carry one.

- ✅ **SB-016** — [the gate with no defaults tier](SB-016-THE-GATE-WITH-NO-DEFAULT-TIER.md)
  — **MEASURED s11 as SB-015 F23, BUILT s12** as Richard's disposition 2. A non-loopback bind
  whose endpoints resolve only from the graph port refuses to start
  (`UNDECLARED_FUNCTION_ON_PUBLIC_BIND`) and names every one of them. **30 specs / 5 mutants**
  (`sb016-function-gate-interlock.test.ts`).
  🔴 **F25 — §4's reason for the narrow predicate was false, measured.** §4 said *refuse only
  where the port resolves to `authenticated`* "refuses exactly the two that are wrong". It
  refuses **three**: `claimSite` is unticked, resolves to `authenticated`, and `authenticated`
  is what SB-004 §4 wants for it. The deeper finding is that **neither candidate
  discriminates** — what separates `claimSite` from `publishPage` is an intention that is in
  neither the port nor the config, so no startup-time predicate can read it.
  ✅ **The broad predicate ships, and the reasoning inverts §4's**: the endpoints the narrow one
  exempts are exactly the `public` ones — the only surface an anonymous stranger can reach —
  so exempting them makes the interlock silent about what it exists to protect. The refusal
  does not say *this is wrong*; it says **you have not said**.
  🔴 **The message is graded like code**, because this task is about a failure of messages:
  every endpoint named with its port state, `public` ones flagged as reachable by anyone, the
  file named by path, and a `functions` block that is **merged** with existing entries
  (a one-key paste would undeclare the rest — mutant), **preserves what is enforced right
  now** (mutant), is a *valid* config, and — a separate spec from every text assertion —
  **is SUFFICIENT**: extracted from the refusal, pasted in, the same service starts.
  🔴 **It runs at step 1.5, off disk, not from the `WorkflowRunner`** — the runner comes up at
  step 5 and the HTTP server listens at step 3, so an interlock reading it would fire after
  the port is open. A spec asserts the chosen port is still bindable after the refusal. The
  endpoint predicate moved to `workflow/functionDeclarations.ts` and the runner imports it;
  another spec asserts the two agree over a real bundle.
  ⚠️ **This repository's own container deploy is affected**: `deploy/security.production.json`
  is arm C exactly (`devOpen: false`, `collections: {}`, `functions: {}`), so a project with
  cloud functions deployed that way now refuses with the block to paste. `deploy/README.md`
  says so.
  ⬜ The corpus sweep is still open, and a **defaults tier for functions** (disposition 1) was
  not ruled and is not built — a loopback backend can still be in the state silently.

- ✅ **SB-013** — [a singleton written twice](SB-013-A-SINGLETON-WRITTEN-TWICE.md) — **FIXED s10,
  and NOT by the fix the task file recommended.** One `claimSite` left two identical `SiteSettings`
  rows; it leaves one. 🔴 **The recommendation was measured on the row count, and the row count is
  not the property this endpoint is for.** Asking the other question — *does an already-claimed site
  still refuse?* — separates the candidates: one checkbox away from the recommended arm, **an
  outsider ends up in the `admin` role on a claimed site**, and the endpoint still answers
  `This site cannot be claimed.` while doing it. Cause: **`Run` is purely ADDITIVE**
  (`run-on-value-change.ts` §1) — wiring `fetched → Run` unticks nothing, so the gate also re-ran as
  each value arrived, and the run carrying the secret lands **before** the query, where `isEmpty` is
  `true` for a collection with rows in it. So the recommended fix passes on a race it does not own.
  The graph closes it **twice**, each barrier graded independently against that failure: the gate's
  `runOnChange-in-*` boxes off, and a readiness guard on `items` (the one output that separates
  *matched nothing* from *has not run*). ⚠️ The guard alone also costs the ANSWER — `claimed:
  undefined` from a site that IS claimed. 🆕 And the row half is finer than F21 said: with the gate
  deciding on `fetched` alone, restoring the load-time fetch changes nothing. **The second row was
  the second gate run, not the second fetch.** 5 arms in `sb004-publication-invariant.test.ts`.
- ✅ **SB-014** — [the row nothing creates](SB-014-THE-ROW-NOTHING-CREATES.md) — **FIXED s10** by the
  fix its file recommended, in the same pass over `claimSite`. **Nothing in the template ever created
  a `Theme` record**, so the theme editor's Save — targeting `theme.firstItemId`, `undefined` on an
  empty collection — wrote nowhere and said nothing. `claimSite` now mints it beside `SiteSettings`,
  world-readable because the public site reads it with no session. 🔴 **The tokens are the four keys,
  all EMPTY, and that is a deliberate non-decision**: `applyTheme` only overrides a truthy value, so
  the seed renders exactly the shipped palette and the author's first Save is the first thing that
  has ever had a visible effect. ⚠️ Its failure edge answers the SUCCESS response, not the refusal —
  by then the site IS claimed, and "cannot be claimed" would send a real admin away with no second
  claim possible. ✅ SB-008's census now asserts **exactly one creator per singleton, named** — the
  linter question §5 asked for, asked over this template; asking it of any project is still open.

- ⬜ **SB-012** — [three spellings of a component name](SB-012-THREE-SPELLINGS-OF-A-COMPONENT-NAME.md)
  — **MEASURED s6, worked around in SB-005, not fixed.** `RouterNavigate.target` and
  `For Each.template` **are** checked at the door (blocking, with a *did you mean*) — but only
  against what is **already on disk**, unlike a node `type`, which SB-004 §6 F6 measured as resolving
  against an unapplied sibling in the same plan. So **an app whose pages link to each other cannot be
  authored in one pass by either door**: a real panel's dependency graph has genuine cycles and no
  topological order exists. Found the first time this phase built something with more than two pages.
  ⚠️ Fails closed and names its own fix, so nothing ships broken; the cost is a round-trip per cycle
  edge. Workaround in SB-005: create with the links omitted, then `update_component` to restore them,
  with a known-firing control proving the create pass really refuses. 🧭 Which of three fixes
  (resolve siblings / downgrade to warning / a plural create) is Richard's — the task file argues
  against the middle one.

- ⬜ **SB-010** — [the script ports the authored door does not write](SB-010-THE-SCRIPT-PORTS-THE-DOOR-DOES-NOT-WRITE.md)
  — **MEASURED s4, worked around in SB-004, not fixed.** The MCP door does not derive a
  `JavaScriptFunction`'s script ports, so **every cloud component any agent authors** has dead
  custom signal outputs once deployed — a 30-second 504 rather than an error. The derivation exists
  and is correct; it is behind `context.editorConnection.isRunningLocally()`, and an authored graph
  is by definition not being watched by an editor. Same shape as SB-009, and the same disposition:
  whether the fix writes or merely warns needs a corpus sweep.
- ⬜ **SB-011** — [a query that widens when it cannot narrow](SB-011-A-QUERY-THAT-WIDENS-WHEN-IT-CANNOT-NARROW.md)
  — **MEASURED s4, worked around in SB-004, not fixed.** Two independent ways a `Query Records` node
  in a cloud function returns every row when asked for a few: a translation failure becomes *no
  filter* (not an error), and the node fetches once unfiltered at graph-build time. The second has a
  sharp edge — SB-004's workaround is correct only on a query that HAS a filter parameter, and
  applying it to an unfiltered one made `claimSite` read a claimed site as unclaimed. Fixing it in
  the node needs a corpus sweep.
- ⬜ **SB-009** — [a component named in a parameter is not checked by the authored gate](SB-009-A-COMPONENT-NAMED-IN-A-PARAMETER.md)
  — **MEASURED s2, not fixed.** A cloud `Run Tasks` naming a nonexistent helper, or a browser
  component across the runtime boundary, is accepted `0/0/0` and written to disk; the two
  known-firing controls beside it (`wrong-runtime-node`, `repeater-template-unresolved`) prove the
  clean result is "not checked" rather than "not run". 13 `component`-typed ports exist, 1 has an
  owner. Filed rather than absorbed: the fix touches 8 node types including `Show Popup`, and
  whether the new code blocks authored output needs a corpus sweep, not an argument. Probe:
  `noodl-mcp/tests/sb004RunTasksTemplate.test.ts`. **s3 sharpened the claim** (arms E/E′ in
  `sb004Authoring.test.ts`): the same helper named as a node **`type`** is refused
  `unresolved-component-ref` and named as a **parameter** is accepted `0/0/0` — so it is not that
  the authored door fails to resolve references, but that **one spelling of the same reference goes
  unresolved**. That names the fix's diagnostic for it.

- ✅ **SB-017** — [the deploy drops half the cloud graph](SB-017-THE-DEPLOY-DROPS-HALF-THE-GRAPH.md)
  — **FIXED AND DRIVEN s17 (commit `0236a696`). 49 of 100 becomes 100, and both endpoints answer.**
  The editor now derives a cloud node's dynamic ports itself — three `NodeTypeAdapters` classes over
  an import-free `cloudDynamicPorts.ts` — replacing the client WF-007 deleted, per Richard's ruling.
  **Driven on the same preserved backend s15 used**: the deployed bundle went **49 → 100**
  connections, `submitContactForm` answers **200 in 0.055 s** (was 504 in 30.017 s) and stores all
  four submitted values, and `claimSite` answers **`{"claimed": true}` in 26 ms** (was
  `status = error`, 30005 ms), minting `_Role` 1, the join row, `SiteSettings` **1** and `Theme` 1
  — so SB-013's singleton fix holds on the real deploy path, which nothing had measured there.
  🔴 **With two known-firing controls**: a second claim with the **correct** token on the now-claimed
  site is refused, a wrong token is refused, and **neither wrote a row**.
  🔴 **`prop-*` is derived partly from the wires, and that is a measurement, not a shortcut.** The
  runtime builds it from introspected columns; the real drive project's `dbCollections` metadata,
  written by a live bound started backend, is `columns: []` on every class — **permanently**, because
  a column exists once something has written it and the graph that writes it is the graph whose ports
  are missing. (That also answers §6.5's open question about s15's live-backend control.) The
  runtime registers `prop-<anything>` from the wire, so the derivation states what the runtime does.
  ⚠️ **Its cost is stated**: on that family, on those types, in a cloud component, a wire can no
  longer be reported as going to a port that does not exist. Both controls still fire.
  ✅ **84 warnings → 23, and all 23 are browser-side** — `/Pages/PageEditor` 14, `/Pages/Admin` 3,
  `/Pages/ThemeEditor` 3, `/Admin/SectionRow` 1. **The public site and the Setup page are clean**,
  which bounds §6.5's browser question for the first time: the drop is confined to the admin panel.
  ✅ **s18 closed two of the three still owed.** The backend-side half of acceptance 1 is written
  (`sb017-helper-is-lossless.test.ts`, 5 cases / 2 mutants, **100 of 100** as a two-way multiset),
  and the browser half is **measured** (SB-017 §11): the 23 are **19 `prop-` wires + 2 dead
  `For Each.Changed`**, one family, and a deployed admin panel writes a `Page` that is published
  and in the nav with **no title and no slug**. 🧭 Its fix is Richard's — a fourth adapter is not
  it, because on a browser component the viewer is already the writer (§11.4).
  ⬜ **Still owed**: the Setup-page half of acceptance 2 (same browser deploy).
  🆕 **A third small template defect** found by the drive → SB-018 §5: `submitContactForm` answers
  `{"received": false}` about a message it stored, because `Outputs.built()` is a **signal** wired
  into the Response's **value** port `pm-received`.

  *The measurement that produced all of this, kept because it is what the fix is graded against:*
  **MEASURED s15 by the drive nobody had run. The template did not work.** Made from
  `embedded://site-builder` in the real editor, opened, given a backend through the real UI:
  **every cloud endpoint times out.** `claimSite` from the template's own Setup page, real signup,
  real generated token — `status = error`, **30005 ms**. `submitContactForm`, policy `public`,
  curl, no credential — **504 in 30.017 s**. Two of the two reachable without an admin session,
  and `claimSite` is what mints the admin.
  🔴 **The mechanism is measured, not inferred: the editor's deploy silently drops every
  connection whose port the target node does not declare — 51 of 100 cloud connections.**
  `claimSite`'s JS node is wired four `in-*` on disk and declares only `out-ok`/`out-denied`;
  in the deployed bundle **all four `in-*` and `out-claimed` are gone**, so the script's first
  guard returns every time, no `Response` is ever reached, and the request hangs to the cap.
  `execution_steps` is **empty for a 30-second execution** — it never ran and denied, it never ran.
  🔴 **This is SB-010, and SB-010 understated it**: it filed the consequence as dead signal
  *outputs*; the **inputs** go too, and that is fatal rather than subtle. SB-004 F10 declared
  `out-ok`/`out-denied` by hand — exactly the two ports that survive. **The fix was applied to the
  half that had been noticed.**
  🔴 **Why 29 green specs did not catch it**: `sb004-publication-invariant.test.ts` builds its
  bundle with `tests/helpers/authored-bundle.ts`, **not the editor's deploy path**, so it measures
  a bundle the product never builds. **Second instance in this file** — SB-015 §6.5 was the same
  shape for `SITE_SECURITY`, fixed by importing the shipped artefact; the same question was never
  asked of the bundle, which is the larger half. ⚠️ The helper exists for a real reason (the
  editor's converter needs a live `NodeLibrary`); what is missing is a test that the two agree.
  🆕 **The editor says so on open and nobody had looked: 84 `port doesn't exist` warnings**, 44 of
  them exactly these script ports. 🔴 **Re-measured with a real backend created, bound, started and
  holding the schema: the same 84** — the obvious "no backend, so no dynamic ports" reading refuted
  by a control that varied one thing. **The warnings are a preview of what the deploy deletes.**
  ⚠️ Bounded: saving prunes nothing — 255 connections shipped, 255 on disk after install, 255 after
  the editor's own save. The project file is faithful; only the bundle is lossy.
  ✅ **§6 RESOLVED s16 and the ruling TAKEN — see SB-017 §8.** It is **not the door**: every
  `JavaScriptFunction` persists a short `ports` array on **both** runtimes, and the browser side is
  *shorter* — **69 undeclared script-port connections, 0 warnings**, against the cloud's 44 and 44.
  Incompleteness is the norm; only one runtime breaks, so the disk shape is not the cause. And the
  runtime never needed the ports: `NodeScope.createConnection` registers a port **from the wire**
  (`nodescope.ts:149-150`) — which is why `authored-bundle.ts`, dropping nothing, works.
  🔴 **One cause, five families.** Dynamic ports reach the editor only from a connected runtime
  client calling `sendDynamicPorts`, and **WF-007 deleted the cloud-runtime window**
  (`NodeLibraryImporter.ts:285` says so); WFA-001 replaced it with a **static** library that carries
  no computed port. So for cloud components `in-`/`out-`, `prop-`, `qp-`/`acl-` and `storageFetch`
  are **all** missing at once. `pm-` is the exception **because WFA-009 already built the
  editor-side generator this task needs** — for one family.
  🔴 **"Fix the script ports" is NOT enough — 51 dropped = 32 script-only + 19 schema-family.**
  `claimSite`'s 19th is `secret.done -> DbCollection2.storageFetch`, **the wire that starts the
  function**: with every script port restored the collection still never fetches, `fetched` never
  fires, and it still hangs for 30 s. `submitContactForm` would run and store a `ContactMessage`
  with **no name, email, message or page**. **Scope the fix to dynamic ports as a family** — a
  script-only fix is the third pass of the same half-fix (SB-004 F10, then SB-010, then this).
  ✅ **Richard's ruling: derive the ports in the editor for cloud components** — replace the client
  WF-007 deleted. Where the code goes is already prescribed by `dynamicPortRules.ts`'s own header:
  **a `NodeTypeAdapters` class per family**, not a new `namedports/list` rule.
  ✅ **Acceptance 1 EXISTS AND IS RED (s16)**:
  `noodl-editor/tests/cloud/sb017-deploy-connection-parity.test.ts`, in the `cloud` barrel.
  It reproduces s15's **real deployed bundle exactly** — 4, 4, 5, 5, 8, 9, 14 = **49 of 100** —
  so what fails there fails in production. **Two controls are green**: the port warnings really
  fire (else the whole spec would pass on the defect), and a wire whose port is genuinely wrong is
  **still dropped** — so the fix cannot be "delete the health check".
  🔴 **Acceptance revised in SB-017 §9**: #3 now requires `submitContactForm` to **store the four
  values** (the old wording passes on a record of nulls); #4 is now reachable rather than a
  fallback; #6 is new — a negative control that the 69 browser connections still export.
  ⚠️ **Unbounded and worth measuring before 0.2.1**: `build/deployer.ts` exports through the *same*
  `exportComponent`, so the browser half is exposed to the same drop. 32 of its 40 warnings are
  `prop-`. SB-008 drove the public site; **nothing has clicked the admin panel.**
- ⬜ **SB-018** — [two dead wires, a port that resolves in one runtime and not the other, and a
  heading that says "Text"](SB-018-TWO-DEAD-WIRES-AND-A-PLACEHOLDER-HEADING.md) — **MEASURED s15.**
  (1) **`For Each` has no `Changed` output** and the template wires one twice (`PageEditor`,
  `Admin`); both dead. ⚠️ Bounded — a valid `NewDbModelProperties.done` wire sits beside each, so
  the refresh still fires. The gap it names: **no door checks that a wired port exists on a
  STANDARD node** — SB-009's hole one level down. (2) **`DbCollection2.storageFetch` is flagged in
  cloud components and not browser ones** — 🔴 **RESOLVED s16 and MOVED TO SB-017. The exclusion
  recorded here was wrong.** `dbcollectionnode2.ts:1222` pushes `storageFetch` from the node's
  **dynamic** ports function, so it is the *same* mechanism as the script ports (SB-017 §6.3), and
  it is **on `claimSite`'s critical path** — this file's own note that all four `runOnChange-*` are
  `false` is exactly why. Not one of three small things. ⬜ The SB-013 question it raised is still
  open and inherited by SB-017: in the deployed bundle that collection has **no fetch trigger at
  all**, so the explicit-fetch barrier is inert there and **SB-013's specs stay green either way**.
  (3) 🔴 **The public site's `<h1>` renders the literal word `Text`** on an unclaimed site — the
  node sets no `text` parameter and `text.ts:41` defaults to `'Text'`. **F27's territory that F27
  did not cover**: s14 made the body name its cause; the heading a person reads first still says
  `Text`.

## Session log

- **s1 (2026-08-26)** — phase opened; both code maps run (recorded in SB-001/SB-003 files).
  **SB-003 done** (`2ac993c5`): helper components 404 on every path, vanish from the permissions
  listing, mutation-graded spec, backend suite 102/1094/0; name rule resolved by measurement
  (nested names legitimate, every caller encodes). **SB-001 done** (`e47c7ac7`): `pathToLegacyName`
  delegates to the importer's `toLegacyName`; create door normalises + cross-checks type;
  `checkRuntimeContext` in the shared gate (`wrong-runtime-node`); AWP-002 pins all four types;
  MCP 57/675/0. **SB-002 done**: `backendDoctrine` on `get_project_info`, zero surface-budget
  spend. ⚠️ Editor unit suite carried ONE red both runs: `fb-005/template-shelf.test.ts` — the
  phase-75 peer's in-flight uncommitted work ('data-app' vs 'Data app'), not ours. ⚠️ `test:ci`
  not run (peer was using it; my editor changes are covered by tests-unit validation 52/0 —
  next session should ride a solo `test:ci` window before calling the editor half proven).
- **s2 (2026-08-26)** — **SB-004 designed and its publish flow authored** (see the entry above and
  the task file's §6a); **SB-009 filed** from a 4-arm probe. The peer's `test:ci` held the machine
  for the first hour, so the probe waited rather than contaminating their run. Two corrections made
  in-session and recorded where they were made: the Run Tasks item channel (Component Inputs *as
  well as* Component Object) and SB-009's over-strong "nowhere any gate looks" — a live-editor check
  does exist for the browser case, and is inert for cloud. noodl-mcp 60/684 green.
  ✅ **s1's `test:ci` debt CLOSED**: ran solo on a clear machine, summary line
  **`Jasmine: 2856 specs, 4 failures (failed)`** — all four `AIX-006 style vocabulary`, i.e. the
  recorded floor, so SB-001's validation/navigation changes cost nothing. (Read the summary line,
  not `$?`: the compound exited **1**, which is what the clean floor also does.)
- **s3 (2026-08-26)** — **SB-004's authoring finished**: the two remaining endpoints and two
  remaining helpers, through `create_component`, and the contact pair through the plan door too.
  The session's real finding is **F5**, and it is about s2's own work: reading `Query Records` and
  `Response` closely enough to author `duplicatePage` showed that the *already-green* publish flow
  queried every Section in the site and answered with an empty body. Both are legal graphs, so no
  gate could have caught either; both are now pinned by assertions on the files on disk, each graded
  by a mutant. **F6** answers a question SB-005/006 need: a plan can hold a helper and its caller.
  SB-009 gained arms E/E′. Then, on Richard's ruling, **`claimSite`** — F7's fix, gated fail-closed
  on an unclaimed site AND a `SITE_SETUP_TOKEN` secret, 5 mutants graded; building it turned up
  **F8** and **F9**. noodl-mcp **60 suites / 696** green, `typecheck` clean; no editor or runtime
  source touched, so `test:ci` was not re-run (nothing in its scope changed).
- **s4 (2026-08-26)** — **SB-004 CLOSED: §7 built and run.**
  `nodegx-backend/tests/sb004-publication-invariant.test.ts` (29 specs) authors the seven components
  through the real MCP server, converts what the door wrote into a workflow bundle
  (`tests/helpers/authored-bundle.ts` — the v2→legacy half is the editor's own pure importer, the
  legacy→runtime half is written there because the editor's version needs a live `NodeLibrary`), and
  drives it against SQLite with **`devOpen: false`**. The seven components' node/wire lists moved to
  `noodl-mcp/tests/sb004Components.ts` so the authoring suite and the run cannot drift — that
  extraction *is* acceptance 8.
  **Four defects found, all invisible to both authoring doors** (SB-004 F10–F13), the worst of which
  opened every Section on the site while the correct filter sat on disk. Four mutants graded. Two
  filed as core gaps: **SB-010** (the door writes no script ports) and **SB-011** (a query that
  widens when it cannot narrow). The rules an author needs are now in
  `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`.
  Final: backend **103 suites / 1123**, noodl-mcp **60 / 696**, both typechecks clean.
  ⚠️ `test:ci` not run — **no editor or runtime source was touched** (two test files, one test
  helper, one shared fixture, four docs), so nothing in its scope moved. s2's floor stands.
  ⚠️ **Deliberately not done**: SB-002's `BACKEND_DOCTRINE_MD` still lacks the four rules. It lives
  in noodl-editor source, and editing it puts `test:ci` back in scope — a peer held the machine with
  a live editor stack. First item for the next session; the text is already written in the reference
  doc and can be lifted.
- **s5 (2026-08-26)** — **s4's deliberate omission CLOSED** (`8ce12a3c`): `BACKEND_DOCTRINE_MD` now
  carries §"Four things a deployed graph does not do the way the canvas does" (renamed to Five in
  s10), lifted from the
  reference doc, including the counter-rule SB-004's own correction turned on (rule 3's fix is wrong
  on a query with no filter parameter). `sb002BackendDoctrine` gained a claim census over the four
  rules, asserted claim by claim rather than on the heading; **two mutants graded** (inverting the
  unfiltered-query counter-rule, dropping the declared-ports example). ⚠️ Worth knowing: the
  pre-existing verbatim-over-stdio spec passes under **both** mutants — it measures transport, not
  content. Surface budget untouched (`toolDisclosure`: 8255 tokens / 20 tools, 25 under).
  Then **SB-005 scoped** (see its file); nothing authored.
  Final: noodl-mcp **60 / 697**, `typecheck:mcp` and `typecheck:editor` both exit 0 (run unpiped —
  a piped `$?` is `tail`'s).
  ⚠️ **`test:ci` NOT run — a peer's editor stack held the machine for the whole session** (webpack +
  `start-electron-dev.js`, still live at close). The debt is **bounded, not discharged**: nothing in
  `noodl-editor` imports `prompts/backend.ts` — its only consumer is `noodl-mcp/src/editor-deps.ts` —
  so the sole path from this change to `test:ci` is compilation, which `typecheck:editor` covers. That
  is a bound on the risk, not a pass. **Next session should ride a solo window before calling the
  editor half proven**, exactly as s1→s2 did.
  ✅ **CLOSED in s6 by relay** — see the s6 entry.
- **s6 (2026-08-26)** — **SB-005 BUILT** (see its entry above and the task file's §6–§7): six browser
  components through the real MCP door, `noodl-mcp/tests/sb005Components.ts` + a 21-spec suite with
  **9 mutants graded**. Acceptance 1–5 met; **6 is SB-008's and left explicitly UNMET**.
  Four mechanisms were measured *before* anything was authored, and every one of them changed a
  graph — rule 2 does not bite `CloudFunction2`/`Query Records` (both defer through
  `scheduleAfterInputsHaveUpdated`); a JS output publishes only on **change**, so a panel's refresh
  must be a `storageFetch` wire; `For Each` delivers `id` plus same-named fields to an item
  component's declared inputs; and an update with **no** access rules leaves the stored ACL alone,
  which turned into a new invariant rule and a mutant. Two acceptance criteria were rewritten on
  those measurements rather than worked around.
  **SB-012 filed** from a navigation-cycle rejection: the two `component`-typed references this panel
  uses are checked at the door but only against what is on disk, so a mutually-linked set of pages
  cannot be authored in one pass by either door. Worked around with a documented two-pass authoring
  order and a known-firing control.
  ⚠️ Near-miss recorded rather than buried: `options.items` as a comma string is a **static** `array`
  port that no `dynamic-port-skipped` info covers — the door was silent and the page would have
  thrown on render. Caught by reading `Select.tsx`, not by any gate.
  Final: noodl-mcp **61 suites / 718**, `typecheck:mcp` and `typecheck:editor` both exit 0 (unpiped;
  `typecheck:mcp` is the stricter and caught 20 errors the editor's config passed).
  ✅ **s5's `test:ci` debt CLOSED, by relay rather than by this session's own run.** A peer
  (`Build share template dialog…`) rode a solo window and reported the summary line verbatim:
  **`Jasmine: 2856 specs, 4 failures (failed)`**, all four `AIX-006 style vocabulary` by name, on a
  tree including `8ce12a3c` — the recorded floor. ⚠️ Attributed as a relayed *measurement*, not a
  verdict. s6 itself moved nothing in `test:ci`'s scope (two new noodl-mcp test files, four docs).
- **s7 (2026-08-26)** — **SB-006 BUILT** (see its entry above and the task file's §7): five browser
  components through the real MCP door, `noodl-mcp/tests/sb006Components.ts` + a 29-spec suite with
  **12 mutants and one known-firing control**. Acceptance 1–8 met; **9 is SB-008's and left
  explicitly UNMET**.
  Nine mechanisms were measured *before* anything was authored and four changed a graph — one of them
  a graph SB-005 had already shipped. **F14**: the Router breaks a page-pattern tie by the order the
  components were written in, so the public site's catch-all `{slug}` was quietly competing with four
  one-segment admin paths; those paths moved under `admin/`, and the assertion re-implements the
  Router's rule over **both panels at once**, which is why this suite authors both into one project.
  **F15**: a component instance carries only its declared `Component Inputs` ports — no `visible`, no
  layout — so conditional placement needs a wrapper `Group` (the door refuses it by name, and raised
  two more blocking dimension diagnostics in the same run, including 🔴 a bare number on a dimension
  port being read as a *percentage*). **F16**: a `Page` node's `title` port is dead after export
  while its `description` port is live, so a records-driven title has to go through
  `Noodl.SEO.setTitle` — on the template whose product is SEO. **F17**: the door makes the first page
  written the start page, so authoring order decides where the app opens.
  🆕 A **third query shape** — literal-filtered, boxes ON — and the sentence behind it: *the
  precondition of SB-004's fix is a filter PORT, not a filter*. 🆕 The two cross-file contracts with
  the panel (theme keys, section fields) are now checked, having been checked nowhere before.
  🧭 One ruling filed rather than absorbed: `Section.kind` has five values and `data` can express
  four (`cta` has no destination).
  ⚠️ `test:ci` **not run — no editor or runtime source was touched** (three noodl-mcp test files, one
  of them edited, and two docs), so nothing in its scope moved. s6's relayed floor of 4 stands.
  Final: noodl-mcp **62 suites / 747**, `typecheck:mcp` and `typecheck:editor` both exit **0** (run
  unpiped).
- **s8 (2026-08-26)** — **SB-008 DONE. The browser half is measured, and the phase's two deliberately
  unmet criteria are closed** (SB-005 acceptance 6, SB-006 acceptance 9 — the same claim from two
  sides). `packages/nodegx-backend/tests/sb008-public-site-drive.test.ts`: both panels authored
  through the real door into one project (**site first**), SB-004's cloud half deployed beside them,
  a real SQLite backend with **`devOpen: false`** (`enforced === true` asserted first), and a
  headless Chrome with **no credential of any kind** — **20 specs, 4 known-firing controls, 3
  one-edge arms**.
  A published page renders records and all; a draft shows the not-found panel and **no part of it is
  anywhere in the document** (asserted against `outerHTML`, because a draft behind `visible: false`
  is `display: none` and `innerText` would skip it); a slug that is no record is indistinguishable
  from a draft.
  🔴 **The absence claims stand on a dev-open twin** — same project, same seed, one configuration
  line — in which **the same draft renders**. Without it, "the draft did not appear" would have a
  dozen causes that are not permissions, and each looks identical from the DOM.
  🔴 **Four findings. F18 is the one that had already shipped:** a boolean literal **cannot be bound
  to a SQLite parameter at all** — the write path folds booleans to 0/1 and the read path never did,
  and `node:sqlite` throws rather than answering. SB-006's derived navigation filters `showInNav`, so
  **the public site had no navigation on any page**, a 500 per fetch, and the only trace was a console
  line no structural spec reads. **Fixed** in `QueryBuilder.ts` (`convertQueryValue`, all four binding
  sites); **nothing that worked can regress, because every affected path threw**.
  **F19** — four pre-existing unit specs pinned the unbindable value as correct, in the same file that
  asserts `serializeValue(true) === 1` a few dozen lines away. **A params list is only evidence if
  something binds it**; the new block binds it, with the raw boolean as its control.
  **F20** → **SB-014** (nothing creates a `Theme` row). **F21** → **SB-013** (`claimSite` writes its
  singleton twice).
  ✅ Confirmed in a browser rather than claimed: **F16** (the tab reads the record on a published page
  and the static `Site` on the not-found one, in one run — the only reading that separates the working
  fix from the one the door accepts), the live `description` port, F17 as a property, F14's tie gone.
  ⬜ **Stated so it is not assumed**: the panel's UI was never clicked; the contact form was never
  submitted; **rule 4 is still UNMEASURED** (third session running); SSG is still not a claim.
  Final: nodegx-backend **104 suites / 1143**, noodl-mcp **62 / 747**, noodl-runtime **141 / 2552**;
  `typecheck:mcp`, the backend's and the runtime's all exit **0** (run unpiped).
  ✅ **`test:ci` RUN SOLO** — s8 touched `noodl-runtime` source (`QueryBuilder.ts`), which webpack
  compiles into the editor bundle, so it was genuinely in scope. Summary line:
  **`Jasmine: 2856 specs, 4 failures (failed)`**, seed 42097, all four `AIX-006 style vocabulary` **by
  name** — the recorded floor, so the adapter fix costs nothing. ⚠️ The compound exited **1**, which is
  what a clean floor does; the summary line is the signal, never `$?`.
  ⚠️ A peer had uncommitted `noodl-editor` edits (fb-005: `models/community`, `models/template`,
  `tests-unit/fb-005`) in the shared checkout during that window. Nothing red landed in that
  territory, but attribute by path if a later run does.
  ⚠️ **Deliberately not done**: `BACKEND_DOCTRINE_MD` (`prompts/backend.ts`, editor source) does not
  carry rule 3's new second half. The text is written in the reference doc and can be lifted — same
  shape as s4's omission that s5 closed.
- **s9 (2026-08-26)** — **SB-007 DONE. Tier 2 is closed and the phase has a shipped template.**
  `embedded://site-builder`, category `site`, into FB-005's registry without re-speccing any of it —
  a `*.template.ts`, one map line, and a JSON blob that is **generated**
  (`npm run template:site-builder`) rather than typed beside the component sets. **22 + 12 specs, 6
  mutants graded.** noodl-mcp **63 suites / 769**, editor jest **347 / 5751**, `typecheck:mcp`,
  `typecheck:editor` and `typecheck:editor-tests` all exit **0** (run unpiped).
  🔴 **The finding is the component nobody had ever authored.** Five sessions built eighteen
  components into a fixture that already contained the nineteenth. Authored into a clean skeleton
  the door writes five pages, succeeds five times and registers **none** — `pageRegistration.ts`
  rules a router-less project legitimate, so the answer is an **absent key**, which is the one shape
  no reader notices. Measured as a one-edge arm against its control (18/5/5/**0** vs 19/5/5/**5**),
  because "nothing registered" has a dozen causes that are not the missing router.
  🔴 **F22 — the id rewrite had a hole shaped like the feature that never existed.**
  `instantiateContent` rewrites connections and not `graph.visualRoots`; `hello-world` has none, and
  it was the only embedded template, so twelve dangling ids landed the moment a door-written template
  arrived. **Measured red before the fix**, fixed structurally — a string-matching rewrite would have
  corrupted eight parameters, because `as: 'section'` and `flexDirection: 'row'` collide with node
  ids drawn from the same small vocabulary.
  🧭 **SB-015 filed**: SB-004 §4's policy is a backend artefact and a template is a project
  directory, so the shipped graphs meet `defaultSecurityConfig()` — **unenforced locally, invisible
  deployed**, each failure looking like the other's fix. Derived from source and cited; **not
  driven**.
  ⚠️ The first full noodl-mcp run showed 2 reds in `projectOwnsBackend.test.ts`; it was **run
  concurrently with the editor's 347-suite jest**. Alone: 12/12. Re-run of the full suite alone:
  **63/769 green.** Attributed as contention, not a regression — and recorded rather than dropped.
  ✅ **`test:ci` RUN SOLO** — editor source changed (`EmbeddedTemplateProvider.ts`, plus a new
  template module and a 143 KB JSON that webpack compiles into the bundle), so it was genuinely in
  scope. Summary line: **`Jasmine: 2856 specs, 4 failures (failed)`**, seed 89171, all four
  `AIX-006 style vocabulary` **by name** — the recorded floor, so F22 and the new template cost
  nothing. ⚠️ The compound exited **1**, which is what a clean floor does; the summary line is the
  signal, never `$?`. **No debt carried into the next session.**
  ⚠️ **Still deliberately not done**, carried from s8: `BACKEND_DOCTRINE_MD` does not carry rule 3's
  second half.
- **s10 (2026-08-26)** — **SB-013 and SB-014 CLOSED in one pass over `claimSite`**, which is how
  their files asked to be taken, plus **s8's `BACKEND_DOCTRINE_MD` debt closed** and the reference
  doc corrected on a claim that was wrong.
  🔴 **The session's finding is that SB-013's own recommendation was measured on the wrong
  property.** Its two arms counted rows. Adding the question the endpoint exists to answer — *does
  an already-claimed site still refuse?* — split the candidates: one checkbox away from the
  recommended arm, **the outsider holds the `admin` role**, and every arm answers
  `This site cannot be claimed.` with a 400 while doing it. The only reading that separates a
  refusal from a refusal-shaped breach is asking the role who is in it.
  **Cause: `Run` is purely ADDITIVE.** `run-on-value-change.ts` §1 constraints 1–2 — wiring a `Run`
  adds a trigger and unticks nothing, every input ticked by default — so a gate wired
  `fetched → Run` reads like *decides after the query* and does not. The run carrying the secret
  arrives before the fetch, where `isEmpty` is `true` for a collection with rows in it. Two barriers
  ship, **each graded independently against that same failure**: gate boxes off (arm: guard removed,
  still refused) and a readiness guard on `items` (arm: boxes back on, still refused). Neither:
  outsider is an admin, three settings rows. ⚠️ The guard alone also costs the answer —
  `claimed: undefined` from a site that IS claimed.
  🆕 **And the row half is finer than F21 said**: with the gate deciding on `fetched` alone,
  restoring the load-time fetch changes nothing. The second row was the second **gate run**, not the
  second fetch — the fix belongs on the consumer, not only on the query.
  **SB-014** seeds the `Theme` singleton in the same graph, world-readable, tokens **empty on
  purpose** so seeding decides no palette; its failure edge answers the SUCCESS response because by
  then the site is claimed. SB-008's census now asserts one named creator per singleton.
  **Docs**: `BACKEND-AUTHORING-MODEL.md` §"Four things…" is now §"**Five**", rule 5 is the general
  form (`Run` is additive; `isEmpty`/`count`/`firstItemId` all answer before there is anything to
  answer about — take readiness from `items`), and 🔴 **rule 3's ⚠️ was a misattribution**: with the
  boxes off and an explicit `storageFetch` the query *does* fetch and `isEmpty` *is* flagged. Its
  table gains the row this endpoint is. `BACKEND_DOCTRINE_MD` carries all of it including s8's owed
  half; the claim census grew to five rules and was graded with a mutant (⚠️ the verbatim-over-stdio
  spec passes under it — it measures transport, as s5 recorded).
  Final: noodl-mcp **63 suites / 769**, nodegx-backend **104 / 1149** (10 skipped), editor jest
  **347 / 5751**; `typecheck:mcp`, `typecheck:editor`, `typecheck:editor-tests` and the backend's
  own `tsc` all exit **0** (run unpiped).
  ⚠️ The template was **regenerated** (`npm run template:site-builder`) — `claimSite` gained a node,
  so the artefact is 192 node ids where it was 191, and `tests-unit/sb-007` pins the new literal.
- **s11 (2026-08-26)** — **SB-015 DRIVEN.** §2 was a source derivation for two sessions; it is now
  15 specs over three policy files, one authored project, and a headless Chrome with no
  credential (`nodegx-backend/tests/sb015-default-policy-drive.test.ts`). Both predicted failures
  reproduced exactly — as provisioned the draft renders in full **and appears in the nav on every
  page**; with `devOpen: false` alone the *published* page is a 404 to the public.
  🔴 **And §2 understated it in both directions.** **F23** → **SB-016**: the deployed failure is
  not one-directional. Collections fall back to `defaults.permissions` and fail shut; **functions
  have no defaults tier at all** and fall back to the graph's `Allow Unauthenticated` port, which
  no security file can lower — so a stranger signs up and publishes the owner's draft, and the
  call runs **as system**. **F24**: a refusal renders as the not-found panel, so the author is
  told "That page could not be found" about a page they just published, on every URL of their own
  site.
  🔴 **F24's first spec asserted the two screens were identical and was RED.** They differ in
  exactly one way and it points away from the cause — a genuine draft still draws the site chrome,
  a refused site draws the bare string, so the state reads as *empty* rather than *refused*. The
  claim in the task file was corrected to what the spec measures. **A spec, not a sentence.**
  🔴 **The instrument was extracted, not copied.** SB-008's authoring, binding, data directory and
  page reader moved to `tests/helpers/site-drive.ts` and both suites import it: two suites
  comparing two policies mean nothing unless everything either side of the policy is identical.
  **SB-008's own 20 specs are the check that the extraction changed nothing — 20/20.**
  🔴 **A refactor script cut this file's whole prefix**, because `lines.index("/**")` matched the
  file's own header docblock rather than the intended one — and the file carried s10's
  **uncommitted** work. Rebuilt from the reads taken earlier in the same session and verified two
  ways: every removal in the region diffs as a moved harness block and nothing else, and s10's own
  additions (the singleton census) are present and passing. ⚠️ **The lesson is the marker, not the
  script**: an anchor that is not unique deletes to the wrong place silently.
  ⚠️ **And the backend's `typecheck` does not cover its tests** — `tsconfig.json` is
  `include: ["src/**/*"]` with `**/*.test.ts` excluded, so `tsc --noEmit` exited **0** on a file
  containing an undefined symbol. 🔴 **This was already recorded in s4 and it bit anyway**, which is
  the part worth keeping: a known trap does not protect you if you read the green without asking
  what it covered. Only ts-jest compiles the tests. **Run the suite.**
  ⚠️ `test:ci` **not run — nothing in its scope moved** (two backend test files, one new backend
  test helper, three docs). No editor, runtime or `noodl-mcp` source touched, and the three
  component sets are imported unchanged, so noodl-mcp was not re-run either.
- **s12 (2026-08-26)** — **BOTH RULINGS BUILT.** SB-016's deploy interlock and SB-015's
  project policy, plus the two things measuring them turned up.
  🔴 **F25 — SB-016 §4's stated reason for its narrower predicate was false, and the
  measurement is what found it.** §4 said *refuse only where the port resolves to
  `authenticated`* "refuses exactly the two that are wrong" on this template; read off the
  shipped bundle it refuses **three** — `claimSite` is unticked, resolves to `authenticated`,
  and `authenticated` is what SB-004 §4 wants for it. The finding underneath is that
  **neither candidate discriminates and none can**: what separates `claimSite` from
  `publishPage` is an intention in neither the port nor the config. The broad predicate ships
  and the reasoning **inverts** §4's — the endpoints the narrow one exempts are exactly the
  `public` ones, the only surface a stranger can reach at all, so exempting them makes the
  interlock silent about what it exists to protect. ⚠️ **Third time this phase** a
  recommendation carried a measurement of the wrong property (SB-013's row count, this, and
  s11's own F24 spec). **Re-derive the numbers before building on them.**
  **SB-016**: `UNDECLARED_FUNCTION_ON_PUBLIC_BIND` at startup **step 1.5**, beside the
  `devOpen` one, reading bundles off disk — because the `WorkflowRunner` comes up at step 5
  and the HTTP server listens at step 3, and a spec asserts the chosen port is still bindable
  after the refusal. The endpoint predicate moved to `workflow/functionDeclarations.ts` and
  the runner imports it; another spec asserts the two agree over a real bundle. The message is
  graded like code — every endpoint named, `public` ones flagged, the block **merged** rather
  than replacing, **behaviour-preserving**, valid, and — a separate spec from every text
  assertion — **sufficient**: extracted from the refusal, pasted in, the service starts.
  **30 specs / 5 mutants.**
  **SB-015** as shape 1: `site-builder.security.json` ships, `ProjectTemplate.securityPolicy`
  carries it, `EmbeddedTemplateProvider.install` writes `nodegx.security.json`, and
  `security/projectPolicy.ts` installs it as the backend's own at **step 1.4, before
  `SecurityState`** — the ordering mutant reddens four specs. §3's two objections answered in
  §6.2–6.3 (the absence is the no-op; a received policy can only ever replace the defaults,
  never an existing `security.json`), and the local case answered **verbatim, `devOpen`
  included**, with its cost stated: an author is anonymous on their own machine until
  `claimSite`, whose `SITE_SETUP_TOKEN` provisioning does not write. **22 backend + 5 editor
  + 3 MCP specs, 4 mutants.**
  🔴 **The finding that came free: `SITE_SECURITY` was a typed constant in a test helper**, so
  SB-008 measured a real publication boundary produced by a file no project would ever
  receive. `helpers/site-drive.ts` imports the shipped artefact now — one copy, and what the
  drive measures is what a person gets. **SB-008's 20 specs pass unchanged**, which is the
  check that the substitution changed nothing.
  🆕 **And `deploy/security.production.json` is arm C exactly** — the shipped default with
  `devOpen: false`, so `collections: {}` and `functions: {}`. This repository's own container
  deploy has been putting every project with cloud functions into the state SB-015 measured;
  it now gets SB-016's refusal instead. `deploy/README.md` says so.
  **Docs**: `BACKEND-AUTHORING-MODEL.md` gains §"The endpoint gate has no defaults tier",
  and `BACKEND_DOCTRINE_MD` carries the same rule with a five-assertion claim census — an
  agent that does not know it will author a `publishPage` correct in every other respect and
  callable by anyone who signs up.
  ⬜ **Deliberately not done, stated so it is not assumed**: the **editor's**
  `ServiceSupervisor` does not pass `--project-dir`, so SB-015 is wired for one spawner of
  two — and the unwired one is the path a person picking the template is on (SB-015 §7 names
  the threading and warns that `backend:start` has more than one call site). Nothing has
  opened a project made from this template in the editor, so §6.4's local-run prediction is a
  prediction.
  **Gates**: nodegx-backend **107 suites / 1226** (10 skipped) EXIT 0 — +2 suites, +52 tests
  over s11's 105/1174, reconciling exactly (30 + 22); noodl-mcp **64 / 773** EXIT 0; noodl-editor
  jest **348 / 5756** EXIT 0; `typecheck:mcp`, `typecheck:editor`, `typecheck:editor-tests` and
  the backend's own `tsc` all exit **0** (run unpiped).
  ⚠️ **The editor suite's first run carried one REAL red and it was the right one**:
  `sb-007/site-template.test.ts` asserts `install()` writes **exactly** one file, and SB-015
  makes it write two. The assertion was exhaustive and that is why it fired; it is still
  exhaustive, with a comment saying so. A `toContain` there would have let a new file land in
  every project made from every template with nothing to notice.
  🔴 **`test:ci` OWED, and the debt is bounded rather than discharged.** Editor source moved
  (`EmbeddedTemplateProvider.ts`, `ProjectTemplate.ts`, `site-builder.template.ts`,
  `prompts/backend.ts`, a new JSON webpack bundles), so it is genuinely in scope — but a peer's
  `vitest` held the machine all session and `test:ci` must run alone **on the machine**, not
  merely on the checkout. A contended run's timeout is indistinguishable from failures. **The
  bound**: every changed module reaches `test:ci` only by compilation, which `typecheck:editor`
  covers; the editor's own 348 suites exercise the template provider directly (17 specs across
  `sb-007` and the new `sb-015`); and `prompts/backend.ts`'s only consumer,
  `noodl-mcp/src/editor-deps.ts`, is not in `test:ci`'s graph. **Next session should ride a solo
  window** — same shape as s5→s6.
  ⚠️ **A peer's `vitest` held the machine for the whole session** (a different checkout,
  `nodegx-community`), so every timing here is contended and the first full `noodl-mcp` run
  showed 2 reds — `projectOwnsBackend` and `provision`, both real-backend spawners, both green
  alone in 2.3s. The recorded canary, attributed as contention. ⚠️ It also cost six minutes to
  a mutant runner that appeared to hang: a **failing** spec that starts a `BackendService`
  leaks it (the `stop()` is in the success path), so jest cannot exit — use `--forceExit` when
  grading mutants that make service specs red, and `python3 -u` so a killed run does not lose
  every result.
- **s13 (2026-08-26/27)** — **SB-015 IS WIRED FOR BOTH SPAWNERS, AND §6.4 IS DRIVEN.**
  🔴 **F26 — the editor had FOUR `backend:start` call sites, not the two §7 predicted**:
  `provisionBackend`, `ProjectBackendLifecycle` (auto-start on project open), the panel's
  `useLocalBackends`, and `models/lessonbackend`, which nothing had named. The hole is closed
  **twice**, because the two halves do not cover each other: `projectDir` is a **required
  positional parameter** of a new leaf module (`BackendServices/startLocalBackend.ts`), so a
  fifth call site does not compile until its author decides; and **a census asserts no renderer
  module invokes `backend:start` except that module**, because the compiler cannot see a call
  that bypasses it. `buildSpawnArgs` was **extracted** from `ServiceSupervisor.start()` —
  SB-016's move, same reason: `start()` spawns a bundle that need not be built, so the only
  other available assertion was source-text, which passes on dead code. **20 specs / 7 mutants.**
  🆕 **The census reddened when written, on prose** — a quoted-string match reads as the
  tighter instrument and is the looser one (it counts a docblock's backticks and misses a
  template literal). It strips block comments and matches the bare string; line comments are
  left in deliberately, because a census that cries wolf is fixed by rewording and one that
  misses a call is the defect.
  🔴 **F27 — §6.4's prediction was wrong in the direction that matters.** It predicted "a site
  that renders, a nav, and an admin panel whose every write is refused". Driven
  (`sb015-first-local-run.test.ts`, **14 specs / 3 mutants**, two arms differing in one secret
  and nothing else), a person provisioned into this template gets **the not-found panel on
  their own home page**: `claimSite` **400**, roles **`[]`**, every write **403**, and **no
  `SiteSettings` or `Theme` row at all** — because `claimSite` is what mints them. The refusal
  is at the start of the experience, not the edge. **That screen now has three pixel-identical
  causes** (a genuine draft, a policy-refused read, an unclaimable site) wanting three
  different fixes, and the one a person reaches for first is turning the boundary off.
  ⚠️ **The two-arm design is what made it safe for the prediction to be wrong**: the
  `with-token` control renders a real page through the same instrument, so "the author saw
  nothing" could not be read as a broken harness.
  **Gates**: nodegx-backend **108 suites / 1240** (10 skipped) EXIT 0 — +1 suite / +14 tests
  over s12's 107/1226, reconciling exactly; noodl-editor jest **350 / 5776** EXIT 0 — +2 / +20,
  also exact; `typecheck:editor`, `typecheck:editor-tests`, `typecheck:mcp` and the backend's
  own `tsc` all exit **0** (run unpiped). noodl-mcp not re-run — no `noodl-mcp` source moved.
- **s15 (2026-08-27)** — **THE DRIVE NOBODY HAD RUN, AND IT FOUND THAT THE TEMPLATE DOES NOT
  WORK.** Item 1 of the s14 handover, end to end through the real UI: `New project` →
  `Start from a Template` → **Site Builder** → created at
  `/Users/richardosborne/Documents/sb015-editor-drive` → opened → backend provisioned through the
  Backend Services panel → **Secrets panel driven for the first time** → `claimSite` called from
  the template's own Setup page. **SB-017 and SB-018 filed.**
  ✅ **SB-015's chain is confirmed byte-for-byte on the real path, which is what this drive was for.**
  Shipped `site-builder.security.json` → project `nodegx.security.json` → backend `security.json`,
  **all three md5 `7b007097c3259d92177db4c592055e50`**. `/health` on the created backend:
  **`devOpen: false, enforced: true`**. The backend was spawned with **`--project-dir`** (s13's
  work, on the real path for the first time). 4 endpoints deployed; the 3 helpers read
  *"in the project, not on this backend"* — **SB-003 visible in the UI**.
  ✅ **The Secrets panel passes its first drive.** `SITE_SETUP_TOKEN` typed, **Generate a value**
  produced 43 chars (32 bytes base64url, in the renderer as designed), saved, form cleared, and the
  row reports the environment's second door — *"Falls back to NODEGX_SECRET_SITE_SETUP_TOKEN on a
  server that has no secrets file."* Empty state and copy read correctly. Nothing found wrong with it.
  ✅ **F27's fix confirmed on the real path**: an unclaimed site with the policy enforced draws
  *"This site has not been set up yet."* — the right one of the three sentences, on a project a
  person actually made rather than a fixture.
  🔴 **And then nothing worked.** `claimSite` **30005 ms**, `submitContactForm` **504 in 30.017 s**
  — see **SB-017**. The cause is measured: **the deploy drops 51 of 100 cloud connections**, every
  one whose port the node does not declare, so the JS nodes get no inputs and no `Response` is ever
  reached. **SB-010, whose consequence was filed as dead signal outputs; the inputs go too.**
  🔴 **29 green specs could not see it** because they build their bundle with a test helper rather
  than the editor's deploy path — **the second `SITE_SECURITY`-shaped finding in this phase**, and
  the larger half.
  🔴 **84 `port doesn't exist` warnings on open**, 44 of them these ports — **and they are
  unchanged by creating, binding and starting a real backend with a live schema**, which refutes
  the obvious reading with a control that varied exactly one thing. ⚠️ Saving prunes nothing: 255
  connections shipped, 255 on disk after install, 255 after the editor's own save.
  ⚠️ **A wrong-token control arm was invalid and is recorded as such** — the second submit never
  reached the backend (the repeat signup fails first), so it measured nothing. The discriminating
  arm that did work was reading the **deployed bundle** against the project on disk.
  ⚠️ **No repository source was changed.** Two new task files and this log; the drive's own project
  is outside the repo. Gates not re-run — nothing in any suite's scope moved. The peer's solo
  `test:ci` in this window read **2856 specs / 4 failures, seed 57633** — the documented floor.
  🆕 **Relayed from the P75 peer, worth carrying**: `packages/noodl-editor/.webpack-cache` can
  poison a `test:ci` **build** with ~47 unresolved-alias errors (`@noodl-store/*`,
  `@noodl-versioning`, `@noodl-viewer-cloud/*`) in files nobody touched. It reads as your
  regression and it is not. `rm -rf` it; it is gitignored, only `test`/`test-ci` use it, and
  `renderer.dev` is `cache: false` so it cannot touch a running `dev:debug` stack.

- **s16 / s17 (2026-08-27)** — recorded in the task file rather than here: **SB-017 §8** is s16's
  resolution and Richard's ruling, **SB-017 §10** is s17's fix, drive and gates (commit
  `0236a696`, **49 of 100 becomes 100**, both endpoints answer).
- **s18 (2026-08-27)** — **the browser half priced, and acceptance 1 closed from both ends.** No
  source changed; two specs added, five mutants graded, every gate run.
  ✅ **SB-017 acceptance 1's backend half is written** — `nodegx-backend/tests/sb017-helper-is-lossless.test.ts`,
  **5 cases / 2 mutants**. `bundleAuthoredComponents` emits **100 of 100** connections per
  component, compared against the **shipped template** because the two converters cannot run in
  one process. 🔴 **As a two-way multiset of type-qualified wires, and the mutant proved that was
  necessary**: re-pointing `storageFetch` to `items` left every per-component count correct and
  reddened only the multiset case. "editor == helper" is no longer asserted of one side.
  ✅ **SB-017 §11 — the browser half is measured, and it did not need a drive.**
  `noodl-editor/tests-unit/sb-017/the-browser-half-drops-every-record-field.test.ts`, **6 cases /
  3 mutants**. The census is derived from the shipped artefact and the **real runtime modules**
  and reproduces s17's warnings panel exactly, per component — **14 / 3 / 3 / 1**.
  🔴 **The 23 are 19 `prop-<field>` wires + 2 dead `For Each.Changed`. One family, not two.**
  §10.8's candidate list said `prop-` *and* `storageFetch`; `storageFetch` already resolves on
  the browser side, measured through the same modules as the known-firing control. The browser is
  not missing a runtime client — the viewer is one — it is missing a **schema**, which is §10.2's
  finding on the other half: `recordFieldPorts` mints one port per column and a site nobody has
  written to has no columns.
  🔴 **The cost, which was the open question**: the loss is **total per write node**, so a deployed
  admin panel cannot save a title, give a section its `pageId`, or write a theme's tokens.
  🔴 **And the measurement corrected its own first reading, which is the finding worth carrying.**
  "Every wire dropped" is not "every field lost": a `prop-` set as a **parameter** is not a
  connection and survives. `/Pages/Admin` sets three that way and wires two — so the deployed panel
  writes a `Page` that is **published, in the navigation and ordered, with no title and no slug**.
  **A row that fails to appear gets reported; this one appears.** Asserted, with the two sets shown
  disjoint.
  ⚠️ **Stated as prediction, not measurement**: `SiteSettings`/`Theme` may resolve after a claim
  (`claimSite` mints them) while `Page`/`Section` cannot, because this panel is their only creator.
  Nothing measured it.
  🔴 **The mechanism is not template-specific** — any project deploying a form that writes to a
  class with no rows yet loses its wired record fields, and gets them back once something has
  written to the class. **So *when you pressed Deploy* is part of whether the deployed app works.**
  Not measured beyond this template; stated because the mechanism says it.
  🧭 **A fourth adapter is NOT the fix, and that is a measured constraint** (SB-017 §11.4): on a
  browser component **the viewer is already the writer** for these nodes and `setDynamicPorts`
  replaces, so an editor-side adapter and the viewer would erase each other. Three options, one
  recommended (derive it in the runtime, where the single writer already is — the wires are
  reachable through `ComponentModel`'s `inputConnectionAdded`), each with its cost stated.
  🆕 **The two `For Each.Changed` wires are 2 of the 23** and are recorded back into **SB-018 §6**:
  SB-017's fix **must not** restore them — they are exactly what its known-firing control is about.
  ✅ **Gates, all run alone**: `test:ci` **2863 specs, 4 failures, seed 64894, HEAD `e78f35fb`** —
  the documented floor, all four `AIX-006 style vocabulary` **by name**, fresh `test-results.json`
  (`.webpack-cache` cleared first). `nodegx-backend` full suite **109 suites / 1245 tests, 0
  failures**. `noodl-editor` `test:main` **359 suites / 5913 tests, 0 failures**.
  `typecheck:backend-tests` clean (exit 0); the `tests-unit/` file is typechecked by ts-jest
  against `tsconfig.tests-main.json` at run time, **confirmed by a deliberate canary** that made
  the suite fail *to run* (`Tests: 0 total`) rather than fail a case.
