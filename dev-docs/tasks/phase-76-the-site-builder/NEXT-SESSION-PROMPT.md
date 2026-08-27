# Phase 76 — next session

Read `TASKS.md` here first. **s17 wrote the fix, and drove it: both endpoints answer.**
SB-017 is closed except for three named remainders. Read **SB-017 §10** — it is the whole of
what s17 did, and §10.2 is the one decision a reviewer should push on.

Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Five things a deployed graph does not do the way the canvas does"**. Before any *browser*
component, **SB-005 §7** and **SB-006 §7**. Before touching the template, **SB-007 §3/§4**.

## Where s17 left it (2026-08-27)

✅ **SB-017 is FIXED (`0236a696`) and DRIVEN.** The editor now derives a cloud node's dynamic
ports itself — the client WF-007 deleted, replaced where `dynamicPortRules.ts`'s header says
it belongs: three `NodeTypeAdapters` classes over an import-free
`models/nodelibrary/cloudDynamicPorts.ts`.

- **The deployed bundle went 49 → 100 connections**, on the same preserved backend s15 used.
- **`submitContactForm`: 200 in 0.055 s** (was 504 in 30.017 s), and the stored
  `ContactMessage` carries all four submitted values.
- **`claimSite`: `{"claimed": true}` in 26 ms** (was `status = error`, 30005 ms) — minting
  `_Role` 1, the join row, `SiteSettings` **1** and `Theme` 1. 🔴 **SB-013's singleton fix
  holds on the real deploy path**, which nothing had ever measured there.
- 🔴 **Two known-firing controls**: a second claim with the **correct** token is refused, a
  wrong token is refused, and **neither wrote a row**.
- ✅ **84 warnings → 23.**

🔴 **The one decision worth re-reading: `prop-*` is derived partly from the wires.**
Everything else comes from parameters. The runtime builds `prop-` from the introspected
columns of the class, and the real drive project's `dbCollections` metadata — written by a
live, bound, started backend — is `columns: []` on every class. **That is permanent**: on this
backend a column exists once something has written it, and the graph that writes it is the
graph whose ports are missing. The runtime registers `prop-<anything>` from the wire, so the
derivation is accurate; **the cost is that a mistyped `prop-titel` no longer warns**, and that
is stated in SB-017 §10.2 rather than buried. (This also answers §6.5's old open question —
s15's live-backend control had no schema to find.)

## Next work, in order

1. 🔴 **The browser half, now bounded rather than unbounded.** All 23 remaining warnings are
   browser-side and **confined to the admin panel**: `/Pages/PageEditor` 14, `/Pages/Admin` 3,
   `/Pages/ThemeEditor` 3, `/Admin/SectionRow` 1. **The public site and the Setup page are
   clean**, so what SB-008 drove is unaffected. `build/deployer.ts` exports through the *same*
   `exportComponent`, so those 23 are wires the browser deploy drops — and **nothing has ever
   clicked the admin panel**, so what they cost is unknown. Measure before 0.2.1.
   ⚠️ The fix's scope is cloud components **by ruling**. Extending it needs a decision, not an
   edit: a browser Function node already gets its ports from the viewer, so only `prop-` and
   `storageFetch` are candidates, and they would need the same wire-derived answer §10.2 gives
   — on a surface where a schema *can* eventually exist.
2. ⬜ **The Setup-page half of acceptance 2.** s17 drove `claimSite` over REST with a fresh
   signup; "from the template's own Setup page" is the browser deploy again.
   ⚠️ **The preserved backend is now CLAIMED** by `sb017-owner@example.com` — clear
   `_Role` / `_Join_users__Role` / `SiteSettings` / `Theme` before driving it, or the Setup
   page correctly refuses and it reads as a broken fix. (`_User` also still holds s15's
   `owner@example.com`; use a third address.)
3. ⬜ **The backend-side half of acceptance 1**: that `authored-bundle.ts` is lossless on
   connections, so "editor == helper" is closed from both ends rather than asserted of one.
   Both compare to the same third thing — the shipped template — because they cannot run in
   one process (`exportComponent` needs a live `NodeLibrary`; that is *why* the helper exists).
4. ⬜ **SB-018 is now three**, and the third is new: `submitContactForm` answers
   `{"received": false}` about a message it stored, because `compose`'s `Outputs.built()` is a
   **signal** wired into the Response's **value** port `pm-received`. The cast is allowed, so
   nothing warns. Plus the two from s15: `For Each.Changed` wired twice and dead (bounded — a
   valid wire sits beside each), and the public `<h1>` rendering the literal word `Text`.
5. 🧭 **Richard's, still open**: F8 (does a contact message reach anyone — s17 proved it is
   *stored*, not that it is *delivered*), `Section.kind`'s fifth value with no destination,
   D3 (does SB-003's boundary fix ride 0.2.1).
6. ⬜ **`securityPolicy` is on `ProjectTemplate`**, so `PlatformTemplateProvider`'s
   `community://` shelf still has no channel for one.

## Traps that will bite here specifically

- 🔴 **A `test:ci` build failure has NO summary line**, so the run is *not measured* rather
  than red. **Floor: `2863 specs, 4 failures`**, all four `AIX-006 style vocabulary` **by
  name**. (2863, not 2862 — s17 added one case. Quote the tree: seed 57907, HEAD `f23946bf`.)
- 🔴 **`.webpack-cache` can poison that build** with ~47 unresolved-alias errors in files
  nobody touched, and it reads as your own regression. `rm -rf packages/noodl-editor/.webpack-cache`
  first; gitignored, only `test`/`test-ci` use it.
- 🔴 **`typecheck:editor` does NOT cover `tests/`** — use **`typecheck:editor-tests`**, and
  neither covers `tests-unit/` (ts-jest does that at run time). Confirm your file is in the
  population (`tsc -p … --listFiles | grep`) before believing a clean pass.
- ✅ **`tests-unit/` can `require` another package's source.** s17's agreement spec loads the
  **real** runtime node modules (`dbcollectionnode2`, `simplejavascript`, the two Record write
  nodes) and drives their `setup()` with a fake editor connection. This is the only runner in
  `noodl-editor` that can — the renderer bundle cannot reach `@noodl/runtime`.
  ⚠️ **Fire `editorImportComplete` on the fake graph model**, or those modules announce nothing
  and every comparison passes on two empty lists.
  ⚠️ **Compare the port TYPE, not just name and plug** — a mutant deleting the parser's
  `Outputs.Done()` signal rule survived a `name:plug` comparison, because the general rule
  still finds the name and only the type changes.
- 🔴 **`setDynamicPorts` REPLACES a node's dynamic port list.** Two adapters writing to one
  node erase each other silently. That is why s17's three adapters are partitioned by node
  type and `prop-`/`acl-` share one.
- 🔴 **The warnings list in the DOM is virtualised AND doubled by the ghost.** s17 read 42
  rendered lines for 21 unique, against a chip saying 23 — so the list under-reports *and*
  over-reports at once. De-duplicate, and trust the chip for the total.
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
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch **and teardown**; `test:ci` **alone**.

## Gates, s17

- ✅ **`test:ci` — `2863 specs, 4 failures`, seed 57907, HEAD `f23946bf`.** The documented
  AIX-006 floor, by name. Three runs this session, same 4 every time; a fourth run under a
  deliberate mutant read `2863/6`, the two extra being the parity spec's own cases.
- ✅ **`typecheck:editor` and `typecheck:editor-tests` clean (exit 0)**, both new source files
  confirmed in the checked population with `tsc --listFiles`.
- ✅ **`tests-unit/sb-017` 6/6** under `test:main`'s jest.
- ✅ **4 mutants graded and killed** — the parser's signal rule, the `acl-` role/userid branch,
  `storageFetch`, and the wire-derived `prop-` names (that last through the full suite, losing
  **exactly the 13 connections across four components** §6.4 predicted).
- ⚠️ An editor stack was launched for the drive and **torn down** (`dev:stop`, 27 processes,
  nothing left); the peer holding the P75 lane was told before and after. The sb015 backend on
  8588 went down with it.
