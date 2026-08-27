# Phase 76 — next session

Read `TASKS.md` here first. **s15 ran the drive nobody had run — a project made from the real
template, in the real editor, with a real backend — and it found that the template does not
work.** Every cloud endpoint times out. The cause is measured and written up in **SB-017**;
what it needs now is a ruling on where the fix goes, not more measuring.

Before touching the template, read **SB-007 §3** (why the content is generated) and **§4** (F22).
Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Five things a deployed graph does not do the way the canvas does"** and §**"The endpoint
gate has no defaults tier"**. Before authoring any *browser* component, read **SB-005 §7** and
**SB-006 §7**.

## Where s15 left it (2026-08-27)

✅ **SB-015 is CLOSED and its claims hold on the real path.** This is what the drive was for and
it delivered: shipped `site-builder.security.json` → project `nodegx.security.json` → backend
`security.json`, **all three md5 `7b007097c3259d92177db4c592055e50`**. `/health` reads
**`devOpen: false, enforced: true`**. The backend is spawned with **`--project-dir`** (s13's
work, exercised for the first time). Four endpoints deploy; the three helpers read *"in the
project, not on this backend"* — SB-003, visible in the UI.

✅ **The Secrets panel passes its first drive.** `SITE_SETUP_TOKEN` written through it, *Generate
a value* producing 43 chars (32 bytes base64url, in the renderer), form cleared, and the row
naming the environment's second door. Empty state and copy both read correctly. **Nothing was
found wrong with it** — s14 built it right.

✅ **F27's screen is right on a real project**: an unclaimed site draws *"This site has not been
set up yet."*, the correct one of `diagnoseNotFound`'s three sentences.

🔴 **SB-017 — every cloud endpoint times out, and the template is not shippable until it is
fixed.** `claimSite`, from the template's own Setup page with a real signup and the real
generated token: **30005 ms**, `status = error`. `submitContactForm`, policy `public`, curl, no
credential: **504 in 30.017 s**. `execution_steps` is **empty for a 30-second execution** — the
graph never ran and denied; it never ran.

🔴 **The mechanism is measured, not inferred: the editor's deploy silently drops every connection
whose port the target node does not declare — 51 of 100 cloud connections.** `claimSite`'s JS
node is wired four `in-*` on disk and declares only `out-ok`/`out-denied`; in the deployed
bundle **all four `in-*` and `out-claimed` are gone**, so `if (Inputs.rows === undefined) return;`
returns every time and no `Response` is ever reached.

🔴 **This is SB-010 and SB-010 understated it.** It filed the consequence as dead signal
*outputs*. The **inputs** go too, and that is fatal rather than subtle. SB-004 F10 declared
`out-ok`/`out-denied` by hand — **exactly the two ports that survive**. The fix was applied to
the half that had been noticed.

🔴 **Why 29 green specs could not see it.** `sb004-publication-invariant.test.ts` builds its
bundle with `tests/helpers/authored-bundle.ts`, **not the editor's deploy path**, so it measures
a bundle the product never builds. **This is the second instance of that shape in this phase** —
SB-015 §6.5 was the same for `SITE_SECURITY` and was fixed by importing the shipped artefact.
The same question was never asked of the bundle, which is the larger half.

🆕 **The editor had been saying so all along: 84 `port doesn't exist` warnings on open**, 44 of
them these exact script ports. 🔴 **Re-measured after creating, binding and starting a real
backend with a live schema: the same 84** — the obvious "no backend, so no dynamic ports"
reading refuted by a control that varied exactly one thing. **The warnings are a preview of what
the deploy deletes.** ⚠️ Saving prunes nothing: 255 connections shipped, 255 on disk after
install, 255 after the editor's own save. The project file is faithful; only the bundle is lossy.

⬜ **SB-018** — three smaller things from the same drive: `For Each` has no `Changed` output and
the template wires one twice (bounded — a valid wire sits beside each); `DbCollection2.storageFetch`
is flagged in cloud components but not browser ones; and the public site's `<h1>` renders the
literal word **`Text`** on an unclaimed site.

## Next work, in order

1. 🧭 **SB-017 needs Richard's ruling: door, converter, or both.** The one thing that decides it
   is in **SB-017 §6** and is a single file's reading — the node's `ports` array is *already*
   short on disk, so the converter may simply be honest about a node written incomplete. Settle
   that before writing any code; it is the difference between fixing the authoring door and
   fixing the deploy.
2. ⬜ **The test whose absence let this ship** (SB-017 §7 acceptance 1): the editor's deploy path
   and `authored-bundle.ts` must produce the same connection count for the same components.
   Write this *before* the fix, so it goes red first.
3. ⬜ **SB-018's three**, all small, all cheap once someone is in the template.
4. **SB-009 / SB-010 / SB-011 / SB-012** — SB-010 is no longer "measured, worked around": it is
   the cause of SB-017 and should be re-read in that light. The other three still want a corpus
   sweep or a ruling.
5. 🧭 **Richard's, still open**: F8 (does a contact message reach anyone), `Section.kind`'s fifth
   value with no destination, D3 (does SB-003's boundary fix ride 0.2.1).
6. ⬜ **`securityPolicy` is on `ProjectTemplate`**, so `PlatformTemplateProvider`'s `community://`
   shelf still has no channel for one. Named so it is not assumed.

## Traps that will bite here specifically

- 🔴 **A green cloud-function suite here does not mean the function works.** The suite's bundle
  and the editor's deployed bundle are **two different artefacts**, and s15 measured them
  disagreeing by 51 connections. Until acceptance 1 exists, **read the deployed bundle**:
  `~/.noodl/backends/<id>/workflows/<project>.workflow.json`.
- 🔴 **`.webpack-cache` can poison a `test:ci` BUILD** with ~47 unresolved-alias errors
  (`@noodl-store/*`, `@noodl-versioning`, `@noodl-viewer-cloud/*`) in files nobody touched —
  relayed by the P75 peer, who nearly read it as their own regression and then nearly blamed my
  stack. `rm -rf packages/noodl-editor/.webpack-cache`; it is gitignored, only `test`/`test-ci`
  use it, and `renderer.dev` is `cache: false` so it cannot touch a live `dev:debug` stack.
- 🔴 **Driving the wizard: the modal is rendered TWICE** and `cdp click` targets an element's
  centre, which on these cards lands on a child text span. Stamp the copy that is **not** inside
  a `[class*=Measuring]` ancestor, and expect to **click twice** on the Add Backend dialog.
  `elementFromPoint` before every click — several cards are only hittable off-centre.
- 🔴 **The warnings list in the DOM is virtualised AND doubled by the measuring ghost** — it read
  168 for 84 real warnings. Read `WarningsModel.instance.warnings` instead; you can reach it with
  `window.webpackChunknoodl_editor.push([['x'],{},r=>{req=r}])` and
  `req('./src/editor/src/models/warningsmodel.ts')`.
- 🔴 **`const` leaks between `cdp eval` calls** — wrap every eval in an IIFE or the second one
  dies with *"Identifier 'b' has already been declared"*.
- 🔴 **A repeat submit on the Setup page never reaches the backend** — the signup fails first, so
  a "wrong token" control arm measures nothing. s15 wasted one arm on this. The arm that works is
  reading the deployed bundle against the project on disk.
- 🔴 **The backend's `typecheck` DOES NOT COVER ITS TESTS** (`include: ["src/**/*"]`). Run the suite.
- 🔴 **`test:ci`'s timeout and its clean floor are the same exit code.** Only the **summary line**
  counts. Floor: `2856 specs, 4 failures`, all four `AIX-006 style vocabulary` by name — read
  again at **seed 57633** by the P75 peer during this session.
- 🔴 **Editing a backend's `security.json` is blocked by the permission classifier**, even on a
  throwaway local backend. Do not try to route around it — use the editor's own Access panel, or
  ask Richard. s15 hit this and took the read-only route instead (which was better anyway).
- 🔴 **The artefact and the component sets are two populations.** Edit a component set and
  **regenerate** (`npm run template:site-builder`) or `sb007Template.test.ts` reddens. ⚠️
  `site-builder.security.json` is **NOT** generated — hand-edited, deliberately.
- 🔴 **An authored node id is a request, not a handle (F9).** Read a written graph by node
  **type** or **label**; resolve a mutant's target **through the wire it asserts about**.
- 🔴 **`Run` is purely ADDITIVE**, and a **refused** query publishes an empty `items`
  indistinguishably from an empty one — take refusal from `error`, never from emptiness.
- 🔴 **jest here is `testEnvironment: 'node'`** — no jsdom. A panel cannot be mounted; extract its
  decisions, as `secretsPanelModel.ts` does.
- Shared checkout: commit by pathspec (untracked ⇒ `add` + `commit` in **one chain**), never
  stage-then-commit; announce before any editor launch **and teardown**; `test:ci` **alone**.

## Gates, s15

**None were run, and none were in scope.** s15 changed **no repository source** — two new task
files (`SB-017`, `SB-018`), `TASKS.md`, and `SB-015` §7. The drive's own project lives at
`/Users/richardosborne/Documents/sb015-editor-drive`, outside the repo, and its backend at
`~/.noodl/backends/backend_mtbxrca3axpbc`; both are disposable and can be deleted.

Relayed measurement, not this session's own: the P75 peer rode a solo `test:ci` in this window
and read **`2856 specs, 4 failures`, seed 57633** — the documented AIX-006 floor.

⚠️ The editor stack was launched and **torn down**; 27 processes stopped, nothing left running,
and all MCP servers survived the sweep. Teardown was announced to all three peers that the
launch was announced to.
