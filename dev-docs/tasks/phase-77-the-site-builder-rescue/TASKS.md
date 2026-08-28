# Phase 77 — task board

Task table lives in [README.md](README.md) §5 with the dependency order. This file carries
per-task status and the session log.

## Status

| id | status | note |
|---|---|---|
| SBR-001 | ✅ closed s2 | driven end-to-end; ACs 1–5,7 verified live, AC6 by spec + shelf listing |
| SBR-002 | ✅ closed s4 | AC4 driven — all three states, each with its negative control; the drive **found and fixed a real defect** (the watchdog could never bark — see s4 log) |
| SBR-003 | 🟡 s4: built, swept, driven | AC1–4 verified live (floor stamps, overlay beats it, delete falls back); AC5 spec half green. **Owed: the `var(--token)` dimension-port probe — carried into SBR-004.** Person-sentences complete with SBR-004/006/009 |
| SBR-004 | 🟡 s5 built + s6 driven on a CLAIMED site | **AC1 and AC2 FAIL, both diagnosed with control pairs (§8).** AC2: the state function never runs — `runOnChange` false and `changed` fires before the links exist; poke the variable and both channels are correct (`--primary`/600 vs muted/400). AC1: nav renders as a **column** and nav/header/footer each take a third of the viewport — both are platform size defaults (`width/height: 100%`), not authored. AC4 overflow half ✅ re-confirmed claimed at 360px. Also **drove SB-017 §11.1's predicted `prop-title`/`prop-slug` drop: the admin creates title-less, slug-less rows** — the admin→site loop is broken in the *preview*, not only on deploy |
| SBR-005 | ⬜ open | |
| SBR-006 | ⬜ open | |
| SBR-007 | ⬜ open | deployed-save half blocked on SBR-008 |
| SBR-008 | ⬜ open | ruling taken: §11.4 option 1 (derive in runtime) |
| SBR-009 | ⬜ open | |
| SBR-010 | ⬜ open | |
| SBR-011 | ⬜ open | ruled BUILD, not strike |
| SBR-012 | ⬜ open | |
| SBR-013 | ⬜ open | |
| SBR-014 | ⬜ open | last; re-verifies every person-sentence AC |

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
