# Phase 76 — next session

Read `TASKS.md` here first. **s18 priced the browser half and closed acceptance 1 from both
ends.** No source changed this session — two specs, five mutants, every gate green.

Read **SB-017 §11** before anything else: it is the whole of what s18 did, and **§11.4 is the
one decision a reviewer should push on** (it is Richard's, not an edit).

Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Five things a deployed graph does not do the way the canvas does"**. Before any *browser*
component, **SB-005 §7** and **SB-006 §7**. Before touching the template, **SB-007 §3/§4**.

## Where s18 left it (2026-08-27)

✅ **SB-017 acceptance 1 is closed from both ends.** `nodegx-backend/tests/sb017-helper-is-lossless.test.ts`
(5 cases / 2 mutants) says `bundleAuthoredComponents` emits **100 of 100** connections per
component, measured against the **shipped template** — the same third thing the editor's half
compares to, because the two converters cannot run in one process.
🔴 **The multiset was necessary and the mutant proved it**: re-pointing `storageFetch` to
`items` left every per-component count correct and reddened only the multiset case.

✅ **The browser half is measured, and it did not need a drive.**
`noodl-editor/tests-unit/sb-017/the-browser-half-drops-every-record-field.test.ts` (6 cases /
3 mutants) derives the census from the shipped artefact and the **real runtime modules**, and
reproduces s17's warnings panel **exactly, per component — 14 / 3 / 3 / 1**.

- 🔴 **The 23 are 19 `prop-<field>` + 2 dead `For Each.Changed`. One family, not two.**
  §10.8 guessed `prop-` *and* `storageFetch`; `storageFetch` already resolves on the browser
  side. The browser is not missing a runtime client — the viewer **is** one — it is missing a
  **schema**, exactly §10.2's finding on the other half.
- 🔴 **The cost**: the loss is **total per write node**. A deployed admin panel cannot save a
  page title, cannot give a section its `pageId`/`kind`/`order`, cannot write theme tokens,
  and its editor fields never load their current values.
- 🔴 **The measurement corrected its own first reading, and the correction is the finding.**
  "Every wire dropped" is *not* "every field lost": a `prop-` set as a **parameter** is not a
  connection and survives. `/Pages/Admin` sets three that way and wires two — so the deployed
  panel writes a `Page` that is **published, in the navigation and ordered, with no title and
  no slug**. **A row that fails to appear gets reported; this one appears.**
- ⚠️ **Prediction, not measurement**: `SiteSettings`/`Theme` may resolve after a claim
  (`claimSite` mints them) while `Page`/`Section` cannot, this panel being their only creator.
- 🔴 **Not template-specific.** Any project deploying a form that writes to a class with no
  rows yet loses its wired record fields, and gets them back once something has written to
  that class. **So *when you pressed Deploy* is part of whether the deployed app works.** Not
  measured beyond this template — stated because the mechanism says it, and because it decides
  how wide the fix has to be.

## Next work, in order

1. 🧭 **SB-017 §11.4 is Richard's, and it is the gating decision.** A fourth
   `NodeTypeAdapters` class **cannot** be the fix: on a browser component the viewer is
   already the writer for these nodes and `setDynamicPorts` **replaces**, so the two would
   erase each other on every parameter change. Three options are laid out with their costs;
   the recommendation is **derive it in the runtime**, where the single writer already is
   (`ComponentModel.addConnection` emits `inputConnectionAdded`; `NodeModel.inputs`/`.outputs`
   are the connection lists). Its stated cost is a **second copy** of the wire-derived rule —
   the editor cannot import `@noodl/runtime` (§8) — and the harness for grading two copies
   against each other already exists (`tests-unit/sb-017/cloud-ports-agree-with-the-runtime.test.ts`).
2. ⬜ **The Setup-page half of acceptance 2.** s17 drove `claimSite` over REST with a fresh
   signup; "from the template's own Setup page" is the browser deploy.
   ⚠️ **The preserved backend is CLAIMED** by `sb017-owner@example.com` — clear `_Role` /
   `_Join_users__Role` / `SiteSettings` / `Theme` before driving it, or the Setup page
   correctly refuses and it reads as a broken fix. (`_User` also holds s15's
   `owner@example.com`; use a third address.) ✅ **The Setup page is clean of the browser
   drop** (§10.6), so item 1 does not block this.
3. ⬜ **SB-018 is three, and s18 added a constraint**: the two `For Each.Changed` wires are 2
   of SB-017's 23, so **SB-017's fix must not restore them** — they are exactly what its
   known-firing control is about. The right fix is to delete them (SB-018 §6). Plus
   `submitContactForm` answering `{"received": false}` about a message it stored (a **signal**
   into a **value** port, cast allowed, nothing warns) and the public `<h1>` rendering the
   literal word `Text`.
4. 🧭 **Richard's, still open**: F8 (does a contact message *reach* anyone — s17 proved it is
   stored, not delivered), `Section.kind`'s fifth value with no destination, D3 (does SB-003's
   boundary fix ride 0.2.1).
5. ⬜ **`securityPolicy` is on `ProjectTemplate`**, so `PlatformTemplateProvider`'s
   `community://` shelf still has no channel for one.

## Traps that will bite here specifically

- 🔴 **A `test:ci` build failure has NO summary line**, so the run is *not measured* rather
  than red. **Floor: `2863 specs, 4 failures`**, all four `AIX-006 style vocabulary` **by
  name**. (Quote the tree: s18 read seed 64894, HEAD `e78f35fb`, 65 s.)
- 🔴 **`.webpack-cache` can poison that build** with ~47 unresolved-alias errors in files
  nobody touched, and it reads as your own regression. `rm -rf packages/noodl-editor/.webpack-cache`
  first; gitignored, only `test`/`test-ci` use it.
- ✅ **`tests-unit/` IS typechecked** — by ts-jest against `tsconfig.tests-main.json` at run
  time, not by `typecheck:editor` or `typecheck:editor-tests`. s18 confirmed it with a
  deliberate canary: a type error makes the suite fail **to run** (`Tests: 0 total`), which is
  the same signature as a `Icon`/throwing-hook failure — so read `0 total` as "did not run",
  never as "nothing to run".
- 🔴 **`setDynamicPorts` REPLACES a node's dynamic port list.** Two writers on one node erase
  each other. On the **cloud** side this is why s17's three adapters are partitioned by node
  type; on the **browser** side it is why a fourth adapter is not available at all.
- ✅ **`tests-unit/` can `require` another package's source** and drive a runtime node's
  `setup()` with a fake editor connection capturing `sendDynamicPorts`. This is the instrument
  that priced the browser half without a drive.
  ⚠️ **Fire `editorImportComplete`**, or the Record and Query families announce nothing and
  every comparison passes on two empty lists. s18 graded this: dropping it left the
  "`prop-` is empty" case **green** and reddened only the known-firing control. **The control
  is the whole reason that case means anything.**
- 🔴 **A census is only evidence if it is calibrated against something it could miss.** s18's
  lands on all four of the editor's per-component numbers; a mutant widening it by one family
  the viewer *does* announce (`storageFetch`) broke the match immediately.
- 🔴 **A parameter is not a connection.** `exportComponent` filters wires and copies parameters
  verbatim, and the runtime registers a `prop-` input on either path. Any claim of the form
  "the deploy drops X so X never arrives" has to check the parameter side first — s18's did
  not, at first, and the corrected version is a worse bug than the one it replaced.
- 🔴 **The warnings list in the DOM is virtualised AND doubled by the ghost** — 42 rendered
  lines for 21 unique against a chip of 23. De-duplicate, and trust the chip for the total.
- 🔴 **There is no editor global for `WarningsModel`**, and `require('@noodl-models/…')` from
  `cdp eval` fails (webpack alias). Read the topbar chip and the panel text.
- 🔴 **Driving the wizard: the modal renders TWICE**, and `cdp click` hits an element's centre,
  which on these cards is a child text span. Stamp the copy **not** under a `[class*=Measuring]`
  ancestor, `elementFromPoint` before every click, and expect to click twice on Add Backend.
  ✅ Opening a project from the launcher needs no such care —
  `div[class*='LauncherProjectCard-module__Info']` works first time.
- 🔴 **`const` leaks between `cdp eval` calls** — wrap every eval in an IIFE.
- 🔴 **Editing a backend's `security.json` is blocked by the permission classifier.** Use the
  editor's Access panel or ask Richard; do not route around it.
- 🔴 **The artefact and the component sets are two populations.** Edit a component set and
  **regenerate** (`npm run template:site-builder`) or `sb007Template.test.ts` reddens.
  ⚠️ `site-builder.security.json` is **NOT** generated — hand-edited, deliberately.
- 🔴 **`Run` is purely ADDITIVE**, and a **refused** query publishes an empty `items`
  indistinguishably from an empty one — take refusal from `error`, never from emptiness.
- 🔴 **jest here is `testEnvironment: 'node'`** — no jsdom; a panel cannot be mounted.
- 🔴 **There is no browser node library artefact on disk.** `cloud-node-library.json` has no
  twin, and `tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json` records built-in
  entries **by name only** (`ports: []`). So the browser half cannot be measured through the
  real `exportComponent` the way the cloud half is — the runtime modules are the instrument.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch **and teardown**; `test:ci` **alone**.

## Gates, s18

- ✅ **`test:ci` — `2863 specs, 4 failures`, seed 64894, HEAD `e78f35fb`, 65 s.** The documented
  AIX-006 floor, all four **by name**, fresh `test-results.json` (mtime checked).
- ✅ **`nodegx-backend` full suite — 109 suites / 1245 tests, 0 failures** (10 skipped).
- ✅ **`noodl-editor` `test:main` — 359 suites / 5913 tests, 0 failures.**
- ✅ **`typecheck:backend-tests` clean (exit 0).**
- ✅ **5 mutants graded and killed** — 3 on the browser census (drop `editorImportComplete`;
  widen the census by a family the viewer announces; miss the read side), 2 on the helper
  (drop a connection; **re-point** one, which the counts alone forgave).
- ✅ **No editor stack launched, no peer coordination needed.** Every suite run alone.
