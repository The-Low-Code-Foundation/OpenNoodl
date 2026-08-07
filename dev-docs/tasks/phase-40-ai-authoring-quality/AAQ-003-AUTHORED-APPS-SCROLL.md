# AAQ-003 — Authored apps scroll

**Finding:** #8 — every AI-created page is stuck at the top of the viewport, in this app and the
previous test app.
**Status:** built (2026-08-04); **criterion 1 closed live (2026-08-05)**, criterion 3 closed in code and
under test. Criterion 2 (a dashboard brief's regions scrolling independently) is not driven — it needs a
second brief, and belongs with the engine work.

## The live pass, 2026-08-05

Driven end to end through the launcher wizard (`scripts/aaq40-live/`), against a real preview:

- `bodyScroll: true` in Project Settings after Apply, and the panel says so in Project Settings' own
  words: *"Body Scroll is on in Project Settings, so a page taller than the window scrolls."*
- The **viewer's `<body>` carries `body-scroll`** — the setting reached the runtime, which is the thing a
  green setting cannot prove.
- The listing page: `scrollHeight` 1832 against a `clientHeight` of 343, `window.scrollTo(0, 900)` lands
  at 900, and the screenshot shows a live scrollbar with the middle of the list on screen. It scrolls.

Worth stating because it was nearly missed: for the first three runs this criterion could not be tested
at all, because the app opened on the template's Home rather than the built page (AAQ-001 defect 2) and
then rendered nothing at all (AAQ-001 defect 3). **A scroll test needs something to scroll**, and this
one was blocked behind two defects in a different task.

## What was built

**The scope carries the choice.** `ProjectScope.scroll: 'page' | 'app'` (validated against the union in
`mergeScope`, never cast — an unrecognised value from a model must not silently become `'app'`, which is
the clipped shape). `record_scope` gains the field with the two definitions in it, and the scoping prompt
tells the model to *infer* it rather than ask: "a question about scrolling is not a question anyone came
here to answer."

**The plan carries it to the apply.** `AuthoringPlan.scroll`, set by `planFromScope` **only when the plan
builds pages** — defaulting to `'page'`, so a scope that never discussed it still produces an app that
scrolls. `recoverPlan` validates and carries it too, or a recovered plan would silently go back to being
clipped.

**The apply writes it, undoably.** `ApplyPlanOptions.settings`, applied inside the same undo group as the
components, and **only for settings the project has no value for**: a user who has been to Project Settings
and switched Body Scroll off has decided, and a plan overriding that would be this phase's own failure
pointed the other way. A Build-panel plan against an existing project carries no `scroll` and therefore
changes no setting at all. The panel states what it wrote, in Project Settings' own words.

**The doctrine is in the authoring prompt** ("CONTENT THAT DOES NOT FIT"): the two shapes, and
`scrollEnabled` on the Group that holds the long list — the port name was read out of the catalog
(`scrollEnabled`, boolean, default false), not from this file's memory, per the instruction above.

### Decisions taken

- **The validation rule in step 3 was dropped**, as this file allows. A static "can this overflow with no
  scroll surface" analysis over authored output is not reliable enough to block on — content height depends
  on data, fonts and viewport — and the honest check is the rendered one AAQ-007 builds, where a clipped
  page is visible in a screenshot. The setting being *chosen* rather than left at its default is what
  actually closes the finding.
- Note for whoever does the live pass: `bodyScroll` sits under **"Experimental features"** in
  `project-settings.ts`, which is where a user would least expect to find the switch that decides whether
  their app scrolls. Worth moving; filed as a remark here rather than changed inside this task.

## The mechanism, verified

`bodyScroll` is a **project setting**, default off (`project-settings.ts:67`). When off:

- the viewer adds no `body-scroll` class, so `#root`'s ancestor keeps `overflow: clip`
  (`static/viewer/index.html:55`, `viewer.jsx:183-187`);
- the app root group is `position: fixed` (`nodecontext.ts:923-926`).

Content taller than the viewport is simply clipped — no scrollbar, no scroll container, by design.
Hand-built Noodl projects either enable Body Scroll in project settings (page-like apps) or put
scroll on an inner Group (app-like shells with their own scroll regions). **Nothing in the AI path
does either**, and nothing warns. It is not a preview bug — the deployed app would clip identically.

## The doctrine to encode (confirm with Richard, then write it down)

- A **page-like** app (marketing page, listing site, docs) wants `bodyScroll: true` — the browser
  scrolls, position: fixed headers work as on the web.
- An **app-like** shell (dashboard with sidebar, chat) wants `bodyScroll: false` with explicit
  scroll-enabled Groups for each scrolling region.
- The scoping conversation already knows which kind it is building (it records pages and audience);
  the scope should carry the choice and the provisioner of project settings should apply it.

## What to build

1. **Scope → setting**: the scoping/plan path records the scroll mode and applies `bodyScroll` to the
   project settings at apply time (undoable alongside the plan, same pattern as `setCloudServices`).
   Default for AI-created projects: `true` unless the scope is explicitly app-like.
2. **Prompt doctrine**: the authoring prompt's layout section states the two modes and when to
   scroll-enable a Group (`nativeScroll`/scroll section on Group — verify the exact port names from
   the catalog before writing them into the prompt; do not trust this file's memory of them).
3. **Validation**: a warning (blocking for authored output) when an authored page's root chain can
   overflow with no scroll surface anywhere — i.e. `bodyScroll` off, no scroll-enabled ancestor, and
   the page root's children use content-driven heights. Calibrate on the corpus; if the static
   analysis cannot be made reliable, drop the rule and rely on AAQ-007's rendered inspection instead
   (a screenshot shows a clipped page immediately) — record the decision here.

## Acceptance criteria

1. Cold replay of the puppy brief: the listing page scrolls in the editor preview, in a detached
   preview window, and on a phone via the LAN URL.
2. A dashboard-style brief gets an app-like shell whose list regions scroll independently while the
   shell stays fixed — driven live, not inferred.
3. The setting is visible and correct in Project Settings after apply, and undo restores the prior
   value.

## Traps

- Seam 3 of the diagnosis session lives in the same files (`web-server.js` token injection): the
  detached-preview check in criterion 1 doubles as a regression check for it.
- HMR does not reach `main.js`/`web-server.js`; full Electron restart to verify anything there.
- `nodecontext.ts:923` reads the setting at root-group creation — check whether a mid-session
  settings change propagates without reload before promising live behaviour in the panel copy.
