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

- ⬜ **SB-005** — the admin panel (editor, image upload, theme, live preview via realtime).
  ✅ **SB-004 F7 is handled in the backend** by `claimSite`; SB-005 owns its *front* — a first-run
  screen that takes the setup token, signs the owner up, and calls it.
- ⬜ **SB-006** — the public site
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

## Tier 3 — found while building

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
