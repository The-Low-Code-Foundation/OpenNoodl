# Phase 77 — task board

Task table lives in [README.md](README.md) §5 with the dependency order. This file carries
per-task status and the session log.

## Status

| id | status | note |
|---|---|---|
| SBR-001 | ✅ closed s2 | driven end-to-end; ACs 1–5,7 verified live, AC6 by spec + shelf listing |
| SBR-002 | ✅ closed s4 | AC4 driven — all three states, each with its negative control; the drive **found and fixed a real defect** (the watchdog could never bark — see s4 log) |
| SBR-003 | 🟡 s4: built, swept, driven | AC1–4 verified live (floor stamps, overlay beats it, delete falls back); AC5 spec half green. **Owed: the `var(--token)` dimension-port probe — carried into SBR-004.** Person-sentences complete with SBR-004/006/009 |
| SBR-004 | 🟢 s8b: AC1/2/4 driven PASS; root-URL fix DRIVEN with a control pair | **AC1 ✅** nav 219→**68px, three links on one row at y=24**; header **98**, footer **74** (were 218/219) — the lever is `sizeMode` on seven Groups + the nav link, collected as `STACKED_IN_A_COLUMN`. 🔴 `flex-grow` is NOT the lever. **AC2 ✅** `--primary`/600 on the current link, muted/400 on siblings, on a fresh `/home` load **and** after in-app nav to `/about`, nothing poked. 🔴 **The AC2 cause was NOT in the template**: the NDA-017 migration writes `runOnChange-*: false` on load for every node whose control signal is wired — **37 nodes in a fresh project, zero `true`s**; an explicit `true` survives, absent does not (§9.2). **AC4 ✅** re-confirmed at 360px with control; a 51-char title is clipped, not scrolled. ⚠️ **`maxWidth` is inert on `Text`** — authored, driven (`computed: none`), removed (§9.3). 🔴 **Next and bigger than either AC: the root URL `/` renders NO page** — `The slug to show` is the one migrated node whose `run` (`didMount`) genuinely races its `in-homeSlug` (§9.2). 🔴 49 specs were green while both ACs failed; three new checks + mutants close it (§9.5). AC3 remains SBR-012's. **s8b**: 🔴 **the root URL is DRIVEN** — but the first reading was a PASS and 12 reloads all passed, because the race wins on a warm local backend; forcing it to lose (`Fetch.requestPaused` delaying only `*8594*` by 1500ms) gave a real control pair, same project, only the two parameters varied. 🔴 **§9.2's characterisation was WRONG**: it is not the empty-slug path — with a slow fetch `/`, `/home` and `/about` ALL render no page, because the guard gates every slug. ✅ §10.2's probe answered: the nav click **remounts** (`window` marker survived, element stamps died), so `in-slug: true` is defensive, not a second fix. **s8**: the root URL's cause is fixed (`runOnChange-in-slug`/`-in-homeSlug: true` on `The slug to show`) and gated artefact-wide in `sb007Template.test.ts`, but 🔴 **the drive is OWED** — Richard hand-drove the only editor stack all session. §10.3's census replaced §9.2's armchair clearance of the other 32 silenced nodes: 27 nodes / 48 parameters, and the property that separates a harmless silencing from a blank page is whether the input's producer is ordered before the control signal — `PageInputs` is the template's only such producer (`router.tsx:586`) |
| SBR-005 | ⬜ open | |
| SBR-006 | 🟢 s9: built + driven; **AC1 ✅, AC5 ✅ (control pair)**, AC2 🟡, AC3/AC4 ❌ | Two new components (`/Admin/Shell`, `/Admin/NewPageDialog`), three rebuilt. **AC5 is a control pair**: same shell placed twice, `Pages` reads `--primary`/600 on `/admin/pages` and `--foreground`/400 on `/admin/theme` while `Theme & settings` does the opposite — nothing poked. **AC1** the rail items STACK (y=65/96/127) and heading+`New page` share one row. 🔴 **The finding: the admin set had never been walked by the layout gate** — `findGrowingNodes` over the shipped artefact reported **11 growing nodes** in admin against 2 on the public site; `/Admin/PageRow` alone had four, so rows divided the page instead of stacking. 🔴 **And the gate nearly shipped with a hole**: a walk that stops at a component instance never reaches the bodies behind `Component Children` — it graded **41 nodes not 61** and `/Admin/PageRow` VANISHED, which read as an improvement. The report got QUIETER. 🔴 **AC2 half-blocked by SBR-008**: the dialog changes where title/slug come from and does not change the outcome — one `Page` table now holds a dialog-written row (`title None, slug None`) beside a cloud-written one (`Copy of Untitled`, `page-copy-np3ui4`), the cleanest SBR-008 evidence yet. 🔴 **AC3 blocked by a defect with no owner**: `publishPage` and `duplicatePage` BOTH time out at 30s with no response while `claimSite` succeeds in 29ms on the same backend — and they disagree, duplicate did its work, publish did nothing. ❌ **AC4 defect found**: View site landed on the literal `/%7Bslug%7D`; `pm-slug: ''` authored and gated but **NOT driven**. 🔴 §5.8: a refused query and an empty collection are the SAME SCREEN — no rows, no sentence, no explanation |
| SBR-007 | ⬜ open | deployed-save half blocked on SBR-008 |
| SBR-008 | ⬜ open | ruling taken: §11.4 option 1 (derive in runtime) |
| SBR-009 | ⬜ open | |
| SBR-010 | ⬜ open | |
| SBR-011 | ⬜ open | ruled BUILD, not strike |
| SBR-012 | ⬜ open | |
| SBR-013 | ⬜ open | |
| SBR-015 | 🟡 s12: **AC3 ✅ ANSWERED, AC1 ❌** | **drive done 2026-08-29.** The 30s hang is gone: zero-section publish answers **`HTTP 400 This page could not be published.` in 12–19 ms**, which is `deny`'s own message — SBR-015's wiring is what made it speak. 🔴 **The node is `sections-3`, measured not inferred**: `GET /classes/Section?where={"pageId":…}` → **500 `no such column: "pageId"`**; the auto-created `Section` class holds only `objectId/createdAt/updatedAt/ACL`. **Control pair, one variable** — add the column (via a Section row on a *different* page, so the page under test still has zero) and the identical publish returns **200 in 24 ms**. So RunTasks on an empty list fires `done` not `unchanged`, the guards pass, and **a zero-section page is legitimately publishable**. 🔴 **AC1 still fails**: `/Admin/PageRow`'s three `CloudFunction2` nodes wire `done` and **no `failure`**, so the admin sees **nothing for 47 s observed** — while the success arm through the same button closes the menu at **211 ms**. The fix landed on the cloud half only. Two rows carried out: SBR-016 and phase 80 **s10 (build):** **found by SBR-006 s9, built s10.** Neither `publishPage` nor `duplicatePage` wires a single `failure` edge — every node's only exit is the happy path, so any error is a 30s 504 with no status and no node named. `claimSite` (same file, same author, 5 failure wires → 7 send edges) answers in **29ms** and is the control. 🔴 **The two do NOT disagree**: both stall at the same kind of point and differ only in where their write sits relative to it — duplicate creates its copy *before* the barrier, publish writes *after* it. Three tempting causes were each REFUTED (undeclared signal ports — the artefact declares all six; RunTasks on an empty list — NDA-012 §B3 ends it `done`; an empty query not publishing `items` — `setCollection` flags it unconditionally). Which node broke is deliberately still OPEN: wiring the failures is what makes the backend able to say. 🔴 `execution_steps` is EMPTY for all three executions — the table exists and nothing writes to it |
| SBR-014 | ⬜ open | last; re-verifies every person-sentence AC |
| SBR-016 | ⬜ open | **found by SBR-015's drive s12.** [The list that never asks](SBR-016-THE-LIST-THAT-NEVER-ASKS.md) — arriving at `/admin/pages` renders no rows and no count sentence while `GET /classes/Page` on the same session returns two. 🔴 **Not a refused query: 0 requests to `:8597` after load**, control 5 to `:8574`. `pages-2` fetches only on `create.done` or a row's `Changed`, so any drive that creates a page first cannot see it. Adds a **third** state to SBR-006 §5.8's pair |
| SBR-017 | ⬜ open | **found by SBR-015's drive s12.** [There is no way back in](SBR-017-THERE-IS-NO-WAY-BACK-IN.md) — the template's only auth node in 21 components is `SignUp` on `/Pages/Setup`; there is no `LogIn` anywhere. An owner whose session ends cannot re-enter their own admin. Measured: a second signup on a claimed site is **201 with a session token**, and `claimSite` then correctly **400**s — a right refusal and a locked door |

## Standing gates and traps (carried from phase 76 — still live)

- **Floor: `test:ci` — 2863 specs, 4 failures**, all four `AIX-006 style vocabulary` **by
  name**. A build failure has no summary line: *not measured*, not red.
- 🔴 The template artefact and the component sets are **two populations** — edit a set ⇒
  regenerate (`npm run template:site-builder`) or `sb007Template.test.ts` reddens.
  `site-builder.security.json` is hand-edited, NOT generated. Node count moves
  `sb-007/site-template.test.ts` id count (194) and the backend helper's connection total (101).
- 🔴 The door remaps node ids (`save` ships as `save-3`) — assert template wires by node
  **label**, never id.
- 🔴 `setDynamicPorts` REPLACES a node's dynamic port list — two writers erase each other.
- 🔴 A parameter is not a connection — the export filters wires, copies parameters verbatim.
- 🔴 `sb017-deploy-connection-parity.test.ts` asserts its shortfall equals a named
  `REMOVED_BY_SB018` list — an exemption, not a relaxation. SBR-008 retires it deliberately or
  updates it deliberately; never lets it drift.
- 🔴 A poisoned jest transform cache = red specs with EMPTY failure messages; prefer artefact
  and test mutants over source mutants; `npx jest --clearCache`.
- Driving: modal renders twice (stamp the non-Measuring copy, click twice), `elementFromPoint`
  before every click, IIFE around every `cdp eval`, launcher watchdog can reap the stack —
  `npm run cdp -- health` before trusting it.
- Shared checkout: commit by pathspec (untracked ⇒ add+commit one chain), never stage-then-commit;
  announce editor launches AND teardowns; `test:ci` alone.

## Session log

- **s10 (2026-08-28)** — **SBR-015 written, built and gated; the drive is owed.**
  The unowned 30s-timeout defect §5.7 handed on is **one cause, not two**: neither
  `publishPage` nor `duplicatePage` wired a single `failure` edge, so every node in both graphs
  had exactly one way out and any error became a silent 504 naming nothing. `claimSite` (same
  file, 5 failure edges, 29ms) is the control that made it diagnosable. The two "disagree" only
  because duplicate creates its copy **before** the point it stalls at and publish writes
  **after** one.
  🔴 **Four candidate causes each FITTED and each was refuted** — undeclared signal ports (the
  artefact declares all six), RunTasks on an empty list (NDA-012 §B3 ends it `done`), an empty
  query not publishing `items` (`setCollection` flags unconditionally), `.map` on a Collection
  (it extends Array). **Which node broke is still open on purpose**: wiring the failures is what
  lets the backend say, and a fifth guess would waste the measurement.
  🔴 **A second defect fell out of proving the first**: both Run Tasks were wired by
  `completed`, which *"fires after every invocation, whatever the outcome"* — publish marked a
  page published after a run that set **no** section's access rules, duplicate answered with a
  page id after a failed section copy. Both now `done`. Two more silent exits the new gate then
  found: `submitContactForm`'s `stored` (a throw hung the template's one **public** endpoint)
  and `claimSite`'s own `gate`, whose two hand-written signals only *look* exhaustive.
  🔴 **The gate's own first version had a hole shaped like the defect** — it asked "does this
  node reach a Response?", which every node on a happy path does, so it would have passed the
  unfixed `publishPage`. It grades the failure **edge** now; the mutant is what caught it.
  🔴 **A pin had been red since SBR-006 landed and nobody saw it** — browser Function nodes
  18 → 20 (`/Admin/Shell`, `/Pages/ThemeEditor`), red from `dc931e01` because s9 never ran
  `test:ci`. The first `test:ci` of this session showed **7**; three were real.
  Gates: **`test:ci` 2889 specs, 4 failures, all four `AIX-006` by name — the floor exactly** ·
  mcp sb00* **155/155** · editor sb-007/015/017/018 + sbr-001/002/003 + fb-005 **377/377** ·
  backend sb0* **141/141** · `typecheck:editor` 0 · `typecheck:mcp` 0. Template regenerated;
  connection total 101 → **118**, node ids 232 → **234**, both with named movers.

- **s9 (2026-08-28)** — **SBR-006 built and driven.** `/Admin/Shell` (sidebar, brand,
  Pages · Theme & settings · Messages, View site, screen body via `Component Children`) and
  `/Admin/NewPageDialog` (Show Popup / Close Popup); `/Admin/PageRow` becomes a table row with a
  derived status pill and the three write actions behind one overflow menu; `/Pages/ThemeEditor`
  places the same shell with `active: 'theme'`.
  ✅ **The popup mechanism was measured before anything was authored** (§4 says not to invent one):
  the viewer installs the popup layer unconditionally (`viewer.jsx:174`), and close results are
  flagged dirty BEFORE the close action fires (`showpopup.ts:204-210`) — the ordering that keeps
  this from being a second SB-017 §11.1.
  🔴 **The finding that outlives the task: the admin screens had never been walked by
  `sb006PublicSite.test.ts`'s growing-node rule.** Eleven growing nodes to the public site's two.
  🔴 **The new gate's own hole**: no `Component Children` hop ⇒ 41 graded instead of 61 and the
  worst offender disappeared from the report. The green arm now asserts node NAMES, because a count
  is the thing the hole moved the wrong way.
  🔴 **`sb005AdminPanel.test.ts` was grading a population the panel never ships into** — the admin
  set authored into an empty project; the first outward reference refused the component and took all
  twenty other assertions with it. It now writes the public site first, as the generator does.
  Two door refusals kept: a bare `width: 240` means **240%**, and `Text` has no padding or
  border-radius ports at all.
  Gates: template regenerated (21 components, 5 pages) · `typecheck:editor` 0 · `typecheck:mcp` 0 ·
  mcp sb00* **148/148** · editor sb-007/015/017/018 + sbr-001/002/003 + fb-005 **377/377** ·
  backend sb0* **141/141** · `test:main` **6253/6254** (the single red, `BLD-004`, is a
  timing-sensitive stall test unrelated to this work and green in isolation).
  ⚠️ **`test:ci` still NOT run** — owed since s8.

- **s8 (2026-08-28)** — **the root URL's cause is fixed and gated; the drive is owed.**
  `resolveSlug` now carries `runOnChange-in-slug`/`-in-homeSlug: true` in `sb006Components.ts`,
  regenerated into the artefact. The ordering consequence the handoff asked to check first was
  checked and is benign: `out-slug` is `pageQuery`'s only trigger, but a run before `homeSlug`
  publishes nothing, so the first run that reaches the body is the first fetch.
  🔴 **§9.2's clearance of the other 32 silenced nodes was an armchair claim and is now a
  census**: 27 nodes / 48 parameters, and the discriminating property is whether the silenced
  input's producer is ordered before the control signal. The template has exactly one control
  signal that fires on a clock its values do not share (`Page.didMount`) and exactly one
  producer with that ordering guarantee (`PageInputs`, `router.tsx:586`). Two mount-triggered
  nodes; one was the defect, one is measurably safe. New gate in `sb007Template.test.ts` —
  known-firing signal, a grader that asserts its **reason column**, and a mutant that calls the
  grader and reds on `in-homeSlug` **alone** while clearing `in-slug`.
  Gates: `template:site-builder` regenerated · `typecheck:editor` 0 · `typecheck:mcp` 0 ·
  mcp sb004/005/006/007 **122/122** · editor sb-007/015/017/018 + sbr-001/002/003 + fb-005
  **377/377**. `test:ci` NOT run — see below.
  🔴 **No editor seat all session**: Richard was hand-driving the only stack (pid 6774, TPL-001,
  owned by session 65956), and two editors cannot coexist. The AC-grade drive of `/` is s9's
  first job; the probe table is SBR-004 §10.4.

- **s4b (2026-08-28, hold cleared mid-session)** — **the owed sweep ran clean and both drives
  landed.** Gates: template regenerated · `typecheck:editor` 0 · `typecheck:mcp` 0 · **`test:ci`
  2863/4, all four `AIX-006 style vocabulary` by name** (floor exactly) · `test:main` 6253/6254
  — the single red was SBR-003's own third install write hitting sb-007's *exhaustive*
  written-files pin, updated deliberately · mcp sb004/005/006/007 91/91 · backend 35/35 + 20/20.
  🔴 **SBR-002 AC4's drive found a real defect the specs could not**: the no-backend deadline
  **never spoke**. A signal into a VALUE port writes true-then-false, and the input queue holds
  **one entry per input name**, so the two writes coalesce and the decider runs ONCE with
  `false` — its `Inputs.watchdog === true` guard was a watchdog that could never bark. Guard is
  now `!== undefined` (the deadline is the port's only writer, so "defined at all" IS "the
  deadline passed"); the spec's abstain row and its mutant were inverted to match, artefact
  regenerated, sb006 33/33. Re-driven on a wizard-fresh project: **no backend → the sentence,
  visible and hit-tested; unclaimed → "not set up"; claimed + bogus slug → "not found", with the
  answered home page as the negative control (panel `visibility: hidden`)**. SBR-003: floor
  reaches `:root` live (`--primary #1e4d8c`, `--site-measure 44rem`), the real deployed
  `claimSite` seeds exactly the twelve contract keys, a Night write overlays them (companions
  land as live `color-mix`, not frozen), and deleting the row falls every token back to Studio.
  Method notes: the editor preview is 988×313 until you pick a device size — probe reachability
  at a **real** viewport, and `elementFromPoint` returning `null` means below the fold, not
  hidden; the honest hidden signal here is `visibility`. `SITE_SETUP_TOKEN` was provisioned
  through the product's own Secrets panel (writing the backend's `secrets.json` by hand is
  blocked, and the panel is the flow a person uses anyway).

- **s5 (2026-08-28)** — **SBR-004 built and driven; one AC pair still owed.** The public
  site has a shape: nav bar with a rule, a reading measure on `--site-measure`, spacing from the
  scale, a footer, and the empty-screen panels as centred `--surface` cards. Every colour,
  radius, gap, face and size in the five SB-006 components is a `var(--token)`; four dimensions
  are named in `RAW_DIMENSION_EXEMPTIONS` with a reason each. 🔴 **The finding that mattered:
  `TokenResolver.generateCss` stamps `:root {…}` and `body { font-family }` and NOTHING else
  (`TokenResolver.ts:137`), so `--background`/`--foreground` were declared on every deploy and
  read by no element — a Theme record could pick Night and the page stayed black-on-white. The
  new `frame` node is what makes any of this visible.** AC2 is derived, not authored: a
  `For Each` sets only the model's own fields (`foreach.tsx:586-597`), so the current slug — one
  value, constant across links — travels as an app-wide variable (`Noodl.Variables` is a proxied
  `Model`, so a write notifies), read twice over so neither creation order is missed; the
  distinction is colour AND weight, with a mutant holding the second channel.
  🔴 **AC2's parenthetical asks for `aria-current` and the platform cannot author it** — no
  visual node declares an aria or attribute port, and the only ARIA in the viewer is a hard-coded
  `aria-hidden` on `IconGlyph`'s svg. A platform gap, bigger than this task, recorded not fixed.
  🔴 **The drive's own find: `visible: false` is `visibility: hidden` and HOLDS ITS SPACE** (the
  port says so). At 360px the hidden contact wrapper was **365px** of empty page, and a
  `richText` section reserved a 320px image band it never draws, once per row. Six surfaces moved
  to `mounted`; re-driven on a second fresh project, the element is gone from the DOM. A spec now
  refuses `visible` anywhere on the public site (parameters AND wires) and its first run caught
  one I had missed by hand. ✅ **SBR-003's carried probe answered**: `max-width:
  var(--site-measure)` computes `704px` and renders 704px, against an unknown-token control that
  computes `none` and renders 940px — same element, same viewport, one variable. ✅ **AC4's
  measured half**: `scrollLeft` reaches 0, beside a planted-2000px control that reaches 1640, so
  the absence has a known-firing signal. ✅ **Also fixed the 2-suite `test:main` failure s4 left
  owed — never a flake**: four `tests-unit/sb-01{7,8}` specs declare `const siteBuilder` with no
  top-level import/export, so TS treats them as global SCRIPTS and ts-jest typechecks all of
  `tests-unit` in one program; whichever pair shared a worker failed TS2451 and the SUITE failed
  to RUN (2 failed suites, **0 failed tests**, 6244 not 6254). `export {}` scopes them.
  🔴 **OWED, and it is AC1 and AC2 themselves: both drives were of an UNCLAIMED site.** The nav
  renders zero links there, so AC2 has never been observed in a browser, and AC1's person
  sentence has only been seen on a "not set up yet" page. Claiming needs `SITE_SETUP_TOKEN`
  through the Secrets panel. ⚠️ Unexplained and undiagnosed: on the unclaimed page the `nav`
  measured 151px and `header` 150px against ~33/~36px of content; `flex-grow: 0` on the children
  changed neither — measure on a CLAIMED page before calling it a defect. Counts moved with the
  graph: node ids 195 → 203, browser Function nodes 17 → 18, sb006 specs 34 → 49.
  Gates: `typecheck:editor` 0, `typecheck:mcp` 0, mcp sb006+sb007 71/71, `test:main` 375/6254,
  `test:ci` **2875 specs / 4 failures, all `AIX-006 style vocabulary` by name** (seed 79133, tree
  78a04e69 — a peer's TPL-001 added 12 specs mid-session; one F44 red on an earlier run did not
  reproduce). Drive artefacts: projects "SBR-004 Theme Drive" (old graph) and "SBR-004 Mounted
  Drive" (carries the fix) in NodeGX test projects, backends `backend_mtd5sw9h8dz5g` and one more.
- **s4 (2026-08-28)** — **SBR-003 built end-to-end under the CPU hold; NOTHING EXECUTED**
  (code + specs saved for the sweep, per Richard's freeze). The contract is single-sourced in
  `models/template/templates/siteTheme.ts`: `THEME_TOKEN_FIELDS` (12 fields — the final list,
  AC deliverable), `SITE_THEME_PRESETS` (Studio/Press/Night verbatim from the screens
  artifact), `buildSiteDesignTokens()` (Studio floor + 7 companions), `buildThemeDoc()`
  (generated `docs/THEME.md`). Channels: `ProjectTemplate.designTokens`/`docs` →
  `install()` writes `metadata.designTokens` + validated `docs/*.md`
  (`assertTemplateDocPath` throws on escapes); overlay = `applyTheme` extended to the 12
  keys + `color-mix` companion derivations; writers = `buildTokens` (12 keys, font field →
  `fontDisplay`), `seedTheme` (12 empty). Pins updated in `sb004Authoring` (seed bound to the
  contract), `sb004-publication-invariant` + `sb008` drive (12-key literals). New
  `tests-unit/sbr-003/token-contract.test.ts` (vocabulary/presets/floor/install/doc/stamp,
  every absence beside a firing positive, refusal table for the doc-path validator, and a
  post-regeneration artefact gate). 🔴 **The artefact was NOT regenerated** (ts-node boots
  the door's validation tree — held): `sb007Template.test.ts` byte gate + the sbr-003
  artefact spec are red until `npm run template:site-builder` runs, which is therefore STEP 1
  of the sweep. Learned en route: `TokenResolver.generateCss` resolves a pure `var(--x)`
  token value inline at stamp time (freezes the link — floor companions are static hexes,
  runtime derivations use `color-mix`, which passes through verbatim); POL-006's
  `body{font-family:var(--font-sans)}` floor makes the token the effective font channel on
  stamped surfaces.

- **s3 (2026-08-28)** — **SBR-002 built; editor half closed and driven; AC4 + gates deferred
  under Richard's CPU hold** (*"avoid CPU/RAM intensive testing until I explicitly say to
  start again"* — mid-session, stands until he clears it).
  **Editor half (AC1–3 all driven live):** `ProjectTemplate.initialOpenComponent` (hand-set
  like `securityPolicy`; site-builder declares `/Pages/Setup`) → `install()` writes it into
  project metadata (`INITIAL_OPEN_COMPONENT_METADATA_KEY`) → `getDefaultComponent` resolves it
  FIRST via `resolveFirstOpenComponent` (`models/template/firstOpenComponent.ts` — pure,
  import-free module, because `projectmodel.utils`'s import chain cannot load in plain-Node
  jest; the hook's unconditional switch now IS the hinted switch, no layering). Driven:
  wizard-created "SBR Setup Drive" opened on `Pages/Setup` (`aria-current`), metadata verified
  on disk through the v2 re-save, SBR-001 binding intact (`backend_mtcvrppkyv22t`:8590);
  reopen landed on the saved place (App) — `selectedComponentName` still wins; hint-less
  "SBR Hello Control" opened on App as always. Unit: `tests-unit/sbr-002/` 8/8.
  **Template half (built, spec-graded, artefact regenerated — NOT yet driven):** the fourth
  state. 🔴 Measured first: with no backend the preview's SPA fallback answers
  `undefined/classes/…` with **200 + HTML**, `ParseWireAdapter.query`'s success handler throws
  on `response.results` (undefined), so the query publishes **neither `fetched` nor `error`**
  — the white void is a silently dead chain, and no failure-output wiring can ever see it. So
  the signal is a deadline: `Timer` ("The answer deadline", `NO_BACKEND_DEADLINE_MS` = 4000)
  armed by `page.didMount`, into a new watchdog arm in `diagnoseNotFound` that speaks ONLY
  when nothing has answered (`watchdog === true && claimed === undefined && missing ===
  undefined`; the value-port true-then-false double-write is handled — false pass abstains,
  outputs stay latched; any later real answer overwrites). New visitor-facing string
  `NO_BACKEND_TEXT` (deliberately names Backend Services — author-only state, noted in file).
  `sb006PublicSite.test.ts`: +3 specs incl. the ignores-an-answer mutant, census +`timers: 1`;
  33/33. Regenerated (`npm run template:site-builder`): **id count 194 → 195**
  (`sb-007/site-template.test.ts` updated). ⚠️ **The sb017 helper total stays 101** — its
  population is the seven `/#__cloud__/` components ONLY (comment added there); the standing
  "node count moves the backend helper's total" note is true only for cloud-component edits.
  **Gates run before the hold:** `typecheck:editor` **0 errors** (the WFA-002 5-error baseline
  is GONE), `typecheck:mcp` clean, sb007Template byte-gate 22/22, sb-007/sb-015/sbr-001/
  sbr-002/sb017-lossless/sb015-project-policy all green.
  **Owed by this lane (deferred, do NOT run until Richard clears the hold):** (1) AC4 drive —
  three states, three answers, negative controls, on a fresh wizard project (old projects
  carry the pre-deadline graph); (2) `test:ci` floor for SBR-002 (P75's 11:47 run predates
  this work); (3) one `test:main` had 2 failed suites (truncated log, only
  "'siteBuilder' was also declared here." survived — suspects import
  `site-builder.content.json` via `require`; ran beside webpack builds, so possibly the
  two-suites flake) — identify and re-run clean. Drive artefacts: "SBR Setup Drive" (new
  backend `backend_mtcvrppkyv22t`:8590, binding restored after the strip test) and scratch
  "SBR No Backend" in NodeGX test projects. ⚠️ dev:debug launcher exited unexpectedly twice
  mid-session (stack reaped cleanly both times); cause not identified.
- **s2 (2026-08-28)** — **SBR-001 closed, driven.** The wizard now attaches the backend:
  `TemplateItem`/`TemplateChoice` widened with a **derived** `needsBackend`
  (`templateNeedsBackend` = shipped `securityPolicy` OR `/#__cloud__/` components; community
  rows stay `undefined` = no), and `ensureTemplateBackend` (`models/templatebackend.ts`,
  mirrors `ensureLessonBackend`) runs in `handleCreateProjectConfirm` before the route:
  create owned (`backend:create` **with `{projectId}`**) + bind via `setCloudServices`.
  🔴 **Deliberately NO start and NO deploy from the launcher** — `CloudFunctionDeployer`
  exports `ProjectModel.instance` (wrong project on the launcher), and a backend started
  pre-route gets **adopted** by `ProjectBackendLifecycle`, whose adopted path never deploys
  functions. Create+bind hands start (with `--project-dir` ⇒ policy) and function deploy to
  the lifecycle at open, which its own SB-015 comment says it exists for. Verified by driving
  the real wizard: "SBR Drive Site" landed bound to a fresh owned backend, running,
  `security.json` byte-identical to the template's (`devOpen: false`), ACL probes discriminate
  (Page find 200 / ContactMessage find 403 / Page create 403), functions answer
  (`submitContactForm` 200 `received:true`, `publishPage` anon 403); hello-world control
  created with **no** backend, count unchanged. ⚠️ The template's cloud fns are **4 top-level**
  (claimSite, publishPage, duplicatePage, submitContactForm) — the three `site/*` components
  are nested helpers, and SBR-001's task file's `resolveSlug` does not exist; probe
  `submitContactForm`. Unit: `tests-unit/sbr-001/` 15/15 (jest/`test:main`). Floor:
  **2863 specs, 4 failures, all `AIX-006 style vocabulary` by name** (seed 65452). Drive
  artefacts left in place: projects "SBR Drive Site" + "SBR Hello Control" in NodeGX test
  projects, backend `backend_mtctpzoolycw4`. ⚠️ `typecheck:editor` has a pre-existing 5-error
  baseline (`@noodl-viewer-cloud/execution-history` unresolved in `src/main/execution-history`,
  since WFA-002) — not this session's.
- **s1 (2026-08-28)** — **Phase scoped.** Both artifacts read and challenged; the challenge
  found the platform already ships the token system the proposal wanted to invent (182 defaults,
  project overrides deployed as `:root` in index.html, `RawColorLiteral` warning) — recorded in
  README §3. Richard ruled: Studio default, Messages in scope, deploy fix = derive-in-runtime,
  **live preview BUILT not struck**, no short paths ("blow people's minds"). Wizard seam mapped
  (Explore): insertion points, the `useSwitchToDefaultComponent` trap (a previous restore
  attempt was deleted after driving — the default switcher runs unconditionally and wins; its
  spec passed on source text), `ensureLessonBackend` as the attach recipe, `TemplateItem` as the
  five-string bottleneck. Fourteen task docs written.
