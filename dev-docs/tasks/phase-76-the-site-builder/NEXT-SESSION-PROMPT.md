# Phase 76 — next session

Read `TASKS.md` here first. **s16 settled the ruling s15 asked for and wrote the test whose
absence let the template ship broken.** The test is red, on purpose, and the fix is not
written. Read **SB-017 §6 and §8** before anything else — §6 is now an answer, not a question,
and §8 is Richard's ruling.

Before authoring any *cloud* component, read `dev-docs/reference/BACKEND-AUTHORING-MODEL.md`
§**"Five things a deployed graph does not do the way the canvas does"**. Before any *browser*
component, **SB-005 §7** and **SB-006 §7**. Before touching the template, **SB-007 §3/§4**.

## Where s16 left it (2026-08-27)

✅ **SB-017 §6 is RESOLVED, and the answer moved the fix off the authoring door.** s15 left one
reading to do; four files answered all three of §6's questions.

- **The node is not "written incomplete" — incompleteness is the norm.** Every
  `JavaScriptFunction` persists a short `ports` array on **both** runtimes, and the browser side
  is *shorter*: **69 undeclared script-port connections raising 0 warnings**, against the cloud's
  **44 and 44**. `/Site/SectionView`'s `unpack` declares **zero** ports and SB-008 drove it fine.
  Same disk shape, one runtime breaks ⇒ the shape is not the cause.
- **The runtime never needed the ports.** `NodeScope.createConnection` calls
  `registerInputIfNeeded`/`registerOutputIfNeeded` on the wire's own ports
  (`nodescope.ts:149-150`). **The wire is the declaration** — which is why `authored-bundle.ts`,
  which drops nothing, produces working functions.
- 🔴 **One cause, five families.** Dynamic ports reach the editor only from a connected runtime
  client calling `sendDynamicPorts`. **WF-007 deleted the cloud-runtime window** and
  `NodeLibraryImporter.ts:285` says so in as many words; WFA-001 replaced it with a **static**
  library, which carries declared ports and nothing a node computes. `pm-` is the one family that
  works, **because WFA-009 already built the editor-side generator this task needs** — for one
  family.

✅ **Richard's ruling (SB-017 §8): derive the ports in the editor for cloud components**, i.e.
replace the client WF-007 deleted. Not the door, not the exporter, not "stop dropping". **Where
the code goes is already prescribed** by `dynamicPortRules.ts`'s own header: a `NodeTypeAdapters`
class per family, *not* a new `namedports/list` rule. The script parser already exists and is
shared (`JavascriptNodeParser.parseAndAddPortsFromScript`), so the adapter is a caller.

🔴 **The thing most likely to waste your session: a script-port-only fix does not work.**
**51 dropped = 32 script-only + 19 schema-family.** `claimSite`'s schema one is
`secret.done -> DbCollection2.storageFetch` — **the wire that starts the function**. Restore all
44 script ports and the collection still never fetches, `fetched` never fires, the gate never
runs, and it still times out at 30 s. `submitContactForm` would run and store a `ContactMessage`
with **no name, email, message or page**. Scope the work to **dynamic ports as a family**. This
is the third pass at the same half-fix: SB-004 F10 did the signal outputs, SB-010 did the script
ports, and both were "the half that had been noticed".

✅ **SB-018 §2 was wrong and is corrected.** It had excluded `storageFetch` as a cause of SB-017
and filed it as one of three small things. It is the same mechanism and it is on `claimSite`'s
critical path. Moved to SB-017; the SB-013 question it raised is still open and inherited.

## Next work, in order

1. ⬜ **Write the fix.** Acceptance 1 is already red and waiting —
   `noodl-editor/tests/cloud/sb017-deploy-connection-parity.test.ts`, registered in
   `tests/cloud/index.ts`. It reproduces s15's **real deployed bundle exactly** (4, 4, 5, 5, 8, 9,
   14 = **49 of 100**) — the bundle itself is now vendored at `tests/cloud/fixtures/` — so what
   fails there fails in production. Make it 100.
   🔴 **Four of its six cases are green and must STAY green**: the port warnings really fire (a
   spec that skipped `evaluateHealth` would pass on the defect); **a wire whose port is genuinely
   wrong is still dropped**, so the fix cannot be "delete the health check"; the deployed bundle
   is a strict subset of the template; and the export **never loses a wire production already
   had** — which is what catches a fix that reaches 100 by re-pointing rather than restoring.
   ⚠️ The spec drives `NamedPortsAdapter` directly rather than importing `registeradapters`, which
   would register every adapter on a shared EventDispatcher for the whole bundle. Without that one
   line it under-reports by exactly one connection and could never reach parity.
2. ⬜ **Then acceptance 2 and 3 (SB-017 §9) — the drive.** A green suite is not the claim;
   `claimSite` answering from the template's own Setup page is. #3 now requires the stored
   `ContactMessage` to **carry the four submitted values**.
3. ⬜ **The backend-side half of acceptance 1**, not yet written: that `authored-bundle.ts` is
   lossless on connections, so "editor == helper" is closed from both ends rather than asserted
   of one. Both compare to the same third thing — the shipped template — because they cannot run
   in one process (`exportComponent` needs a live `NodeLibrary`; that is *why* the helper exists).
4. ⬜ **SB-018's remaining two**: `For Each.Changed` wired twice and dead (bounded — a valid wire
   sits beside each), and the public `<h1>` rendering the literal word `Text`.
5. 🔴 **Measure the browser half before 0.2.1.** `build/deployer.ts` exports through the **same**
   `exportComponent`, so the same drop applies wherever a browser connection carries a warning.
   Browser script ports are safe (the viewer derives them), but **32 of the 40 browser warnings
   are `prop-`**. SB-008 drove the public site; **nothing has ever clicked the admin panel.**
6. 🧭 **Richard's, still open**: F8 (does a contact message reach anyone), `Section.kind`'s fifth
   value with no destination, D3 (does SB-003's boundary fix ride 0.2.1).
7. ⬜ **`securityPolicy` is on `ProjectTemplate`**, so `PlatformTemplateProvider`'s `community://`
   shelf still has no channel for one.

## Traps that will bite here specifically

- 🔴 **A green cloud-function suite still does not mean the function works.** Until the fix lands,
  the suite's bundle and the editor's are two artefacts disagreeing by 51 connections. **Read the
  deployed bundle**: `~/.noodl/backends/<id>/workflows/<project>.workflow.json`. s15's survives at
  `backend_mtbxrca3axpbc` and is what s16 checked the new spec against — keep it until the fix lands.
- 🔴 **A `test:ci` build failure has NO summary line**, so the run is *not measured* rather than
  red. **Floor: `2856 specs, 4 failures`, all four `AIX-006 style vocabulary` by name.** s16 read
  **2860/6** twice (seeds 83318 and 65707) — 4 floor + the 2 new SB-017 reds, the other 2 green.
- 🔴 **`.webpack-cache` can poison that build** with ~47 unresolved-alias errors in files nobody
  touched, and it reads as your own regression. `rm -rf packages/noodl-editor/.webpack-cache`
  first; gitignored, only `test`/`test-ci` use it. Two peers lost time to this on 08-27.
- 🔴 **`typecheck:editor` does NOT cover `tests/`** — `tsconfig.json`'s `include` is
  `src/editor`, `src/shared`, `src/main`. Use **`typecheck:editor-tests`**, and confirm your file
  is in the population (`tsc --listFiles | grep`) before believing a clean pass.
- 🔴 **A spec not imported in its directory barrel NEVER RUNS**, and a suite that never ran it
  looks exactly like one where it passed.
- 🔴 **`test-results.json` is not written by this runner** — the summary line and the log are the
  readout. Do not go looking for a results file to confirm a run.
- 🔴 **Driving the wizard: the modal renders TWICE**, and `cdp click` hits an element's centre,
  which on these cards is a child text span. Stamp the copy **not** under a `[class*=Measuring]`
  ancestor, `elementFromPoint` before every click, and expect to click twice on Add Backend.
- 🔴 **The warnings list in the DOM is virtualised AND doubled by the ghost** (168 for 84 real).
  Read `WarningsModel.instance.warnings` instead.
- 🔴 **`const` leaks between `cdp eval` calls** — wrap every eval in an IIFE.
- 🔴 **A repeat submit on the Setup page never reaches the backend** — the signup fails first, so
  a "wrong token" control arm measures nothing.
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

## Gates, s16

- ✅ **`test:ci` — `2862 specs, 6 failures`, seed 57878** (and `2860/6` at seeds 83318 and 65707
  before the fixture cases were added). 4 = the documented AIX-006 floor, by name. 2 = the new
  SB-017 spec's defect assertions, **red by design**; its **four** other cases pass.
  ⚠️ **One run (seed 10943) also failed `projectsaveflush.js` — "re-arms a held save".** Not
  reproduced in three other runs. I had left the **cloud node library installed globally** (a
  real leak, now restored in `afterEach` — the documented "inherited whichever ran last" hazard),
  but **that leak was present in two runs where the save spec passed**, so it is *not* shown to
  be the cause. The spec waits 1500 ms and polls disk for 8 s; treat it as load-sensitive, and
  **if you see it again, do not assume it is yours.**
- ✅ **`typecheck:editor-tests` clean (exit 0)**, and the new file was proven to be in the checked
  population by a deliberate mutant that reddened it.
- ⚠️ **No repository source changed** — one new spec, its barrel line, and four task documents.
  The fix itself is not written.
- ⚠️ A peer's dev stack was stopped by its owner before the runs and the machine was verified
  quiet; s16 launched **no** editor stack of its own.
