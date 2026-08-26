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
  `dev-docs/reference/BACKEND-AUTHORING-MODEL.md` §"Four things a deployed graph does not do the way
  the canvas does".
  ⚠️ **F8 is still Richard's** and blocks SB-006's contact section.
  ⚠️ Acceptance 5 is met on the row, not the mail (no SMTP in the run); acceptance 2's "admin path"
  is the REST API as the owner, because SB-005's panel does not exist yet — see §7.

- 🟡 **SB-005** — [the admin panel](SB-005-THE-ADMIN-PANEL.md) — **BUILT s6. Structurally complete
  and mutation-graded; behaviourally UNMEASURED.** Six browser components through the real door
  (`noodl-mcp/tests/sb005Components.ts`), **21 specs / 9 mutants**
  (`noodl-mcp/tests/sb005AdminPanel.test.ts`). Acceptance 1–5 met; **6 is SB-008's and is UNMET** —
  it is listed rather than quietly counted as met by the structural ones.
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
- 🟡 **SB-006** — [the public site](SB-006-THE-PUBLIC-SITE.md) — **BUILT s7. Structurally complete
  and mutation-graded; behaviourally UNMEASURED.** Five browser components through the real door
  (`noodl-mcp/tests/sb006Components.ts`), **29 specs / 12 mutants / 1 control**
  (`noodl-mcp/tests/sb006PublicSite.test.ts`). Acceptance 1–8 met; **9 is SB-008's and is UNMET** —
  listed rather than quietly counted as met by the structural ones.
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
- ⬜ **SB-007** — it ships as a template (via FB-005's registry — consume, don't re-spec).
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
- ⬜ **SB-008** — the drive (verify the consequence: anonymous visitor sees the published page;
  unpublished 404s). 🔴 **Must run with `devOpen: false` over a real SQLite engine** — see SB-004 F2;
  a default local backend does not enforce row-level ACLs at all, so a passing drive there is not
  evidence for any publication claim.
  ✅ **The backend half is already done** by SB-004 §7 — an anonymous caller reads a published page
  and 404s an unpublished one, with enforcement on. What SB-008 still owes is the *browser* half:
  the public site actually rendering it. Scope it as a UI drive, not a permissions drive, and do not
  re-litigate what §7 measured.
  ✅ **The browser half now exists** (SB-006, s7) and the drive must boot `sb006Components.ts` beside
  `sb005Components.ts`, **site authored first** (SB-006 F17). `scripts/devtools/render-from-disk.js`
  serves a v2 project straight from disk against the working-tree runtime and reconstructs
  `routerIndex` the way the exporter does — that is the likely harness, and its header names the
  export-contract traps it already solved.

## Tier 3 — found while building

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
  carries §"Four things a deployed graph does not do the way the canvas does", lifted from the
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
