# Phase 40 — AI authoring quality: the handover prompt

Rewritten 2026-08-05 at the end of the **AAQ-002 criteria 1–3 drive**, which closed Layer 1. The
previous version's headline instruction was "F4/F5 are Richard's calls, then slice 4, then the engine";
F4, F5 and slice 4 all landed, criteria 1–3 were driven, and the drive found finding #7's **fourth**
mechanism — the one that had been underneath the other three all along. Everything the earlier versions
knew and is still true has been folded in below, including their six corrections, all of which survived.

Paste the block below into a fresh session.

---

You are continuing **Phase 40 — AI authoring quality**. Read
`dev-docs/tasks/phase-40-ai-authoring-quality/README.md` and this file before doing anything, then the
task file for whatever you pick up. The phase's own rule applies to its documents as well as to the code:
**read the mechanism in source before trusting a stated fact, including the README's and this file's.**
**Seven** premises written by people who opened or built this phase have now failed that check, plus an
eighth still standing in the review path (AAQ-011 F8). They are listed below. Finding them has been most
of the value of the last three sessions, and the seventh — a defect that had been sitting *underneath*
three correct fixes to the same report — is the reason to assume a ninth exists.

## Where the phase stands

**Layer 1 is COMPLETE — built, driven live, and closed.** Commits `4a0fdd4f`, `83647de9`, `c0bf8b5b`
(build), `3ef42833` (Layer-1 live pass), `36ce5669`, `437ec919` (F4/F5 + slice 4) and this session's
(criteria 1–3 + the fourth `prop-*` mechanism) on `cline-dev`. Editor suite **2198 specs, 0 failures**;
runtime suite **2144 passed**; `typecheck:editor` and `typecheck:editor-tests` clean.

| Task | State |
|---|---|
| AAQ-001 — a created page is reachable | **Criteria 1, 3, 4, 5 closed live.** Criterion 2 closed by construction. One thing owed: promote `PageWithoutPageNode` to blocking (AAQ-011 F7). |
| AAQ-002 — the backend is first-class | ✅ **CLOSED.** All four slices built, **all five criteria driven live**. Finding #7 needed a fourth mechanism — correction 7 below, and it is the important one in this file. |
| AAQ-003 — authored apps scroll | **Criterion 1 closed live** (scrolls in a real preview; `body-scroll` on the viewer's `<body>`). Criterion 3 under test. Criterion 2 (a dashboard brief's regions scrolling independently) needs a second brief — take it with the engine work. |
| AAQ-004 — the conversation is kept | Mechanism A built, under test, **and confirmed live**. Mechanism B stays with AAQ-006. |
| AAQ-005 → 007 (the engine) | Not started. **This is the next substantial work.** Read the perf warning below before you design it. |
| AAQ-008/009/010 (doctrine) | Not started. Prompt-encodable parts can land early; acceptance runs against the new engine. |
| AAQ-011 | Register. F4/F5 closed; **F9–F11 added** this session. F9 and F10 both affect every wizard-built app. |

## The corrections. Do not re-derive these the hard way

The first three are from the Layer-1 build session, the next three from the Layer-1 live pass, and the
last — number 7, and the one most likely to cost you a day — from the AAQ-002 criteria drive. All still
hold.

1. **`prop-age` / `prop-bio` was never a timing problem, and AAQ-002 said it was.**
   `SchemaHandler._fetch()` (`utils/schemahandler.ts`) had been a **stub since WF-007**: it set
   `dbCollections = []`, `haveCloudServices = false`, and `_store()` then wrote `undefined` — on *every*
   `window-focused` and *every* `cloudServicesChanged`. Fixed by introspecting over `backend:list` →
   `backend:status` → `backend:getSchema`. The chain, for anyone debugging a missing data port:
   `record-ports.ts` → `resolveSchemaPortContext` (`schema-ports.ts:477`) →
   `selectedBackend?.schema?.collections` → `dbCollections` fallback → `schemahandler.ts`.
   ⚠️ This fix is real and works — and the ports **still do not appear**. See correction 4.

2. **`RouterNavigate.target` and `Page.urlPath` are not in the node catalog.** Both are
   runtime-discovered ports, and `checkParameterValues` **skips dynamic-port nodes entirely** — so any
   string passes. This is very likely *why* the model reached for "navigate to path":
   `PageStackNavigateToPath.path` is the only navigation target the catalog declares statically.
   If you need to know whether a parameter is checked, write the four-line probe; do not reason about it.

3. **`buildBackendList` has no production caller.** The Backend Services panel composes three separate
   card components. A right model seam is not a right panel — check which one a user actually looks at
   before fixing either.

4. **⚠️ A component listed in a Router's `pages.routes` is NOT a page.** The runtime's page index is
   built **exclusively from `Page` nodes** (`utils/exporter/router.ts::_getPageInfo`);
   `getPagesForRouter` drops every route it cannot resolve to one, and the Router then mounts nothing.
   The result is a **blank screen, no error, and a panel truthfully reporting "The app opens on
   Puppies"**. `stagedComponentIsPage` accepts the `/Pages/…` *name* — correct for deciding what to
   register, never a claim about what renders. Now `DiagnosticCode.PageWithoutPageNode` plus an explicit
   authoring-prompt contract; the diagnostic is a **warning, not blocking** (AAQ-011 F7 carries the bill).

5. **⚠️ `prop-*` has a third mechanism, and it is not the cache.** After "timing" (wrong) and "the cache
   was never written" (right, fixed), the live cause is: `findReusableBackend` matches on **name alone**
   and `provisionFromScope` always names it *"App backend"*, so **every AI-created project on a machine
   binds to the first backend ever provisioned there**. And `backend:createTable` returns
   `created: false` for an existing table **without reconciling its columns**. A reused collection
   therefore has no columns, so `recordFieldPorts` emits no ports, forever. Proven both ways in one
   session: a *new* table created with columns comes back with them; the reused `Puppy` came back
   `columns: []`. Two unrelated apps silently share one datastore. **Both halves are product decisions —
   AAQ-011 F4/F5 — not bugs to quietly patch.**

6. **⚠️ The Record family reads `collectionName`, not `collection`.** It passes
   `collectionParam: 'collectionName'` to `resolveSchemaPortContext`, **whose own default is
   `'collection'`** — so reading the resolver instead of the caller gets it wrong, which is exactly how
   the live-pass fixture got it wrong. Setting `collection` is completely inert and nothing diagnoses it.
   Same family: `RouterNavigate.target` is the **full legacy component name** (`/Pages/Puppies`), matched
   against the router's own `pages.routes` — not a display name and not a URL.

7. **⚠️⚠️ `prop-*` had a FOURTH mechanism, and it was never about backends.** Read this before you
   trust any port-generation claim in this repo. `dbmodelcrudbase._addBaseInfo` defaulted its port
   flag with `opts === undefined || opts.includeInputProperties` — right only while no other option
   exists. **ERG-001 §4 added a `done` sentence to the same options object** (`67d2c339`), which made
   `opts` defined and the whole expression falsy, and **Create Record and Update Record stopped
   emitting a single `prop-<field>` port, on every backend, in every project, for a year.** The three
   earlier mechanisms were all real and all fixed; none of them could ever have made the ports appear.
   ⚠️ **It presents as a schema bug** because `recordClassPorts` kept working — the node knows the
   collection and offers no way to write to it. The one-minute probe that settles it: add a `DbModel2`
   (Record) node on the same collection; it gates on `selectedCollection` alone, so if *its* ports
   appear the schema chain is fine and the fault is in the mixin assembly. Fixed by **deriving** both
   flags from the mixins that build what they gate, not by correcting the default — see the docblock.
   The gate is `record-property-ports.test.ts`, which drives the **assembled node modules** rather
   than the pure generators, because two suites of the latter stayed green throughout.

## What the live pass fixed

All three were invisible to 2165 green specs, and each sat under code that was individually correct.

1. **A plan whose FIRST page linked to its second was unappliable.** The apply's pre-check
   (`ProjectAuthoringView.applyPlan`) builds its component list **forward**, so `/Pages/Puppies` was
   refused for navigating to `/Pages/Admin` — staged in the same transaction, about to be applied
   alongside it. `plannedComponents` had been threaded into every authoring *session* and not into the
   apply. ⚠️ **The bug class is the lesson: one fact existing in two places and present in one.** Fixed by
   making both call `plannedComponentNames`, not by adding the second copy.
2. **Every wizard-built app opened on "Hello World!".** `isPlaceholderPage` measured "empty" as the root
   having *no children*, on the stated belief that the template's Home is one `Page` node.
   `hello-world.template.ts` gives it a **Text child**. The one case the whole start-page mechanism
   existed for could never match.
3. **Correction 4 above**, which is the headline.

Plus: `checkNavigation`'s repair message offered the same component twice and called `App` a page. It now
dedupes, says "component names", and states when the list is truncated.

**Proven live afterwards:** the router lists all three pages, `startPage` is `/Pages/Puppies`, the app
opens on it (`document.title` = "Puppies"), both navigations resolve, the viewer's `<body>` carries
`body-scroll`, and the listing page scrolls — 1832px of content in a 343px viewport, `scrollTo(0, 900)`
lands at 900, scrollbar visible in the screenshot.

## What the AAQ-002 criteria drive found

Correction 7 is the headline. Beyond it, three defects were **filed, not fixed** (AAQ-011 F9–F11), and
two of them are on the path of every app the wizard builds:

- **F9 — every wizard-built app carries a permanent, false `⚠ 1`.** *"This Router has no Pages
  configured"*, on a router whose `pages.routes` lists all three pages and whose app renders correctly.
  `router.tsx::resetAsync` raises `router/no-pages` on the mount that precedes its `pages` parameter and
  **never calls `clearWarning`** — the successful reset that follows says nothing. `dbmodelcrudbase`'s
  `clearWarnings` is the shape the fix wants.
- **F10 — nothing starts a project's backend when the project opens.** `backend:start` has exactly two
  callers: the provision (once) and the panel's button. Reopen a wizard-built app tomorrow and its
  Record nodes fail until the user finds Backend Services. Part product decision, which is why it is
  filed.
- **F11 — the Data Browser's first open says "Failed to load tables"** when no backend has been
  selected yet: `backend:getSchema(undefined)` rejects and the catch reports it as a broken backend.

Also confirmed by accident, and worth keeping: **the schema cache survives a stopped backend.** After a
restart the process was down and the `prop-*` ports were still there — `fetchBuiltInSchema` returning
`undefined` rather than `[]` for a sleeping backend is what preserves the saved cache, exactly as its
docblock claims.

## The driver — use it, do not rebuild it

`packages/noodl-editor/scripts/aaq40-live/` drives the **whole launcher path** with **no AI provider**:
scoping conversation → project creation → plan review → authoring fan-out → apply. It has its own README.

```bash
npm run dev:debug -- --quiet
node packages/noodl-editor/scripts/aaq40-live/wizard-replay.js \
  --drive --fast --name=aaq40-pass --location=/some/scratch/dir
```

The seam is `AiClient.chatStream` / `isConfigured`, and the responder is **request-aware** — it dispatches
on which tools the caller offered, so one patch serves the scoping turn *and* both authoring sessions.
There is no API key on this machine and none is needed for Layer-1 work: registration, `bodyScroll`, the
schema cache and the apply pre-check are all performed by the **apply transaction, downstream of the
provider boundary**. What it cannot test is authoring *quality* — that needs a real model, and it is what
AAQ-005..007 are for.

`--fast` streams one partial payload per submission instead of eight. Use the default when the partial
path is what you are testing; use `--fast` when it is not, because of this:

## ⚠️ Read this before designing the engine

**Authoring a 55-node component cost 6m51s of editor main-thread time against a ZERO-latency provider.**
A 9-node component in the same run took 0s. The `PartialPayloadScanner` is *not* the cost — 0–1ms for the
whole component, measured directly by calling `update()` in the renderer. The cost is per `publish()`,
and it is superlinear in node count. A real provider streams far more partials than the eight this pass
used, so a live run is **worse, not better**.

Phase 40 aims at components far larger than 55 nodes. Measure this and fix it before building an
iteration loop (AAQ-007) that republishes a candidate many times per build. Filed as AAQ-011 F6; the
prime suspect is `AuthoringSession.publish` → the Build panel's re-render, not the scanner.

## What to do next

**Layer 1 is done, so the engine is the work.** In order:

1. **The engine: AAQ-005 (substrate) → AAQ-006 (harness) → AAQ-007 (self-review)**, in that order.
   AAQ-005 is the risk-bearing task. Read the perf warning above first — it is a prerequisite for
   AAQ-007, not a footnote.
2. **AAQ-011 F9 and F10**, if you want the Layer-1 apps to be defensible before the engine lands. F9 is
   a false warning on *every* app the wizard builds and the fix has an established shape one file away;
   F10 decides whether a wizard-built app works the second time it is opened, and is partly a product
   question worth putting to Richard with F9's answer.
3. **AAQ-011 F7** — promote `PageWithoutPageNode` to `BLOCKING_WARNINGS`. It needs 57 fixture sites across
   15 AI spec files corrected (every one builds a `/Pages/…` component out of a bare Group). Mechanical,
   but it changes what a large part of the suite asserts, so it wants its own read.
4. **AAQ-011 F8** — the review path still calls the built-in backend's collections "unknown, not absent"
   on a premise Layer 1 made stale. The reader it needs (`projectSchemaCollections`) now exists, so this
   is wiring; three specs assert the current four-outcome shape.

Richard's bar has not moved: *"legendary creations rivaling the best Opus landing page artifacts."* A page
that validates is not the goal, and the exit criteria are three briefs judged side by side against Claude
artifacts — see the README.

## Traps that will bite you in this specific work

Standing:

- **The seams lie before the model fails.** When something looks wrong in the render, the first question
  is *"did this reach the runtime?"*, never *"why did the model not do this?"* Every defect in the last
  two sessions was on that side of the line.
- **A declared `default` never runs its setter.** The most repeated trap in this repo.
- **A saved project applies a parameter before the port exists.** Jest never reproduces it; only a real
  load does.
- **The editor test suite lies three ways. Only the `Jasmine:` line counts.**
- **Launching the dev editor rewrites the example project.** Check `git status` after killing it.
- **`--target=editor` is correct now**, but closing a webview CDP target white-screens the editor, and
  `cdp reload` on the editor page is unrecoverable. Reloading the *viewer* webview is safe and is the fix
  for a stale-looking preview.

From the Layer-1 build session:

- ⚠️ **Run jest from `packages/noodl-editor`, never from the repo root.** The root config is babel-based
  and fails on TypeScript `import { type X }` with what looks like a syntax error in your spec.
- ⚠️ **Editor specs under `tests/` are registered by hand** (`tests/index.ts` → `tests/ai/index.ts`). A
  *new* spec file nobody adds to the barrel compiles, typechecks and **silently never runs**. Adding
  cases to an existing file avoids it.
- `tsconfig.tests-main.json` is **not** a gate; `typecheck:editor` and `typecheck:editor-tests` are.
- Corpus calibration is cheap: `git ls-files '*project.json'` is 96 real projects.

From the live pass:

- ⚠️ **A rule calibrated on the project corpus is not calibrated on the authored one.**
  `PageWithoutPageNode` fires 6 times over 96 real projects and **57 times across 15 AI spec files**.
  Before you make a new diagnostic blocking, run the editor suite — that is the population that flows
  through the authored gate.
- ⚠️ **A button below a panel's fold has a NON-ZERO bounding box.** The documented "zero-sized box" guard
  does not fire, `dispatchClick` reports success, and the click lands on whatever is at those
  coordinates. Twenty minutes went to a plan that simply never started. Use the driver's `clickVisible`.
- ⚠️ **HMR does not reach a mounted panel's callbacks.** A fix to `ProjectAuthoringView.applyPlan` was in
  the module and *not* in the running closure; the apply failed identically until a full Electron
  restart. Verify the running code (`__wr('…').fn.toString()`) before concluding a fix does not work.
- **Match both spellings of a state.** The apply button reads "Apply to project (3)" when everything
  staged and "Apply 1 of 3 to project" when some failed; matching only the second reads a clean run as a
  hang.
- **A cold editor's first scoping turn can take over a minute**, nearly all of it module loading and the
  wizard's first render. The scripted reply is ~100ms. Do not go looking for a stall.
- **Clean up after a live pass.** Scratch projects go in a scratch directory, get deleted, and get
  removed from the launcher's recents. Anything written into a *shared local backend* (a probe table)
  gets dropped — `backend:deleteTable <backendId> <tableName>`, positional, not an object. A backend the
  pass *provisioned* is now the project's own (F4), so delete it whole: `backend:stop` then
  `backend:delete`.

From the AAQ-002 criteria drive:

- ⚠️ **Write the discriminating probe before the third theory.** Three mechanisms were proposed for
  finding #7 and all three were fixed before anyone asked the question that separates them: *does any
  OTHER node get its ports from this same cache?* One `DbModel2` node in the same project answered it in
  a minute. When a chain has N stages and you are on your third fix, find the input that splits the
  chain rather than re-reading it from the top.
- ⚠️ **`npm run cdp -- reload --target=viewer` reloaded the EDITOR**, dropping the webpack-require probe
  and returning to the launcher. It was recoverable, but the documented trap ("`cdp reload` on the
  editor page is unrecoverable") means you should not find out. To get a rebuilt runtime into the
  viewer, restart the stack — which is also the honest way to test anything claiming "at first load".
- ⚠️ **A tag written in one `eval` is gone by the next one.** React re-renders between two CDP calls, so
  `el.id = 'x'` followed by a separate `cdp click #x` fails with "no element matching". Compute the box
  and dispatch the click in **one** connection — `scripts/aaq40-live/wizard-replay.js` exports
  `clickButtonWithText`/`clickVisible` for exactly this; a menu item needs the same treatment.
- **A card's rarely-used actions live behind `⋯`.** Disconnect and Delete are `showContextMenuInPopup`
  items, not buttons — a scan of `button, [role=button]` finds neither and reads as "the feature is
  missing".
- **The Data Browser needs a selected backend.** Reaching it with `SidebarModel.switch('backend-data')`
  before one is chosen shows "Failed to load tables" — that is AAQ-011 F11, and it is also how to fool
  yourself into filing a criterion as failed. Open it from the card's own Data button.

## The shared checkout

Fourteen tracked files were modified and uncommitted before the last three sessions started and are
**still untouched** — `package-lock.json`, `nodegx-observe`, `ProjectImporter.ts`, `projectmodel*.ts`,
`featureFlags.ts`, `LocalProjectsModel.ts`, `analyze.ts`, the whole `VersionControlPanel/` set,
`tests/versioning/index.ts` — plus untracked `tests-unit/erg-005/`, `dev-docs/tasks/phase-37-project-tabs/`
and the phase-17 LEARN docs. They belong to another session. **Do not attribute them, do not commit them,
never `git add -A`, and never `git stash`.** Commit with explicit pathspecs on *both* `git add` and
`git commit`.

⚠️ `npx jest` from `packages/noodl-editor` currently reports **2 failing suites in `tests-unit/erg-005/`**
(3 specs). They are that other session's in-flight work — `GraphComponent.ports` does not exist yet — and
they are **not yours**. The gates that matter are `test:ci` (**2198/0**), the runtime's own `npx jest`
from `packages/noodl-runtime` (**2144 passed**), and the two typechecks.

No second session was live during this drive (checked: no foreign commits, no Electron running, dirty-file
mtimes unchanged). **Check again yourself** — it is a per-session fact, not a standing one.
