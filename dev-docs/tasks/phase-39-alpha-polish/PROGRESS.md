# Phase 39 — Progress

**Status:** 11 done, 1 diagnosed-not-fixed (POL-008 Part A), 3 not started (POL-011, POL-012,
POL-013).

**POL-008 Part B is no longer gated.** It was waiting on POL-006 ("re-judge after POL-006"); the font
has landed, so Part B can be judged whenever someone picks it up.
**Last updated:** 2026-08-04 (fourth session)

POL-006 also has a head start nobody had noticed: **`library/modules/lucide-icons/` already ships the
full Lucide set as a bundled ISC webfont** (1998 glyphs, `lucide.woff2` + a `type: "iconset"`
manifest), imported 2026-07-25. POL-006's premise — "no project ships one" — is true of the project
*templates*, not of the repo. The curated starter set and Richard's "let users add their own" are
both a matter of wiring that module in, not of sourcing an icon set.

## Tasks

| Task | Reported items | Status | Notes |
|---|---|---|---|
| [POL-001](POL-001-SETTINGS-PANEL-CRASH.md) — settings panel crash | 15 | ✅ **done** | All 5 criteria. Slice 2 answered: the key is not lost — v2 elides an empty `settings: {}` by design on both sides. Verified live on "AIB38 Live Chat", the project that actually crashed. `c6d5f9f8` |
| [POL-002](POL-002-LINKS-AND-THE-LEARN-TAB.md) — links + Learn tab | 1, 2, 5 | ✅ **done** (1 residual) | Removing `react-instantsearch` broke 18 unrelated files: it was the only thing in the tree still declaring a **global `JSX` namespace**, typed for *Preact's* VNode. All 22 annotations moved to `React.JSX`. Criterion 6 (packaged build) not run — human-gated. `d9c0f37c` |
| [POL-003](POL-003-THE-LEFT-RAIL.md) — the left rail | 3, 4, 6 | ✅ **done** (slice 2 deferred) | Contrast now 8.26:1 dark / 7.49:1 light, measured live. 5 Lucide glyphs in. `IconSize` sweep deferred per Richard → [POL-013](POL-013-ICONSIZE-SWEEP.md). `d32b3d13`, `fc10449a` |
| [POL-013](POL-013-ICONSIZE-SWEEP.md) — make `IconSize` real | — | ☐ filed, not started | Split out of POL-003 slice 2 on Richard's call. ~130 call sites. |
| [POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md) — token misuse | 9b, 12a | ✅ **done** (2 residuals) | The check found **25** undefined tokens, not 6 — writing it first, per its own trap, is what caught that. `DialogBackground.Secondary` deleted; it was also miscolouring **every tooltip arrow** in the editor, which nobody reported. Gate: `npm run tokens:css`. Residual: the diff modal and a populated walk are unverified live — both need a longer drive, POL-010 owns the walk. `4382cb24` |
| [POL-005](POL-005-BACKEND-SURFACES-OPEN-DOCKED.md) — backend surfaces | 7 | ✅ **done** (1 open question) | Verified live against a running backend: all seven open at **859px** with **zero** detached-bar elements, close returns to Backend Services, WFA-005's route lands identically. Slice 3's layout pass done in both themes. **Criterion 5's premise was wrong** — a surface has no float/full route at all (1 header button vs Backend Services' 6), so this change removed the only path to full mode. Richard's call whether that matters. Three findings filed, none width-caused: [POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md), the invisible "Save policy" button, Schema's bespoke header. |
| [POL-009](POL-009-A-PIN-BELONGS-TO-ONE-CANVAS.md) — pinned run | 11 | ✅ **done** | All six criteria verified live. The identity the fix compares **does** exist for a workflow canvas (`/#__workflow__/wf_pol009`) — that was the open risk. Step index survives navigation at a *non-default* value (`Step 2 / 3`), a second pin replaces the first, unpin is permanent. The pin even outlives the workflow document being closed and rebuilt. |
| [POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md) — `record.id` vs `objectId` | — | ✅ **done** | Option (b): `objectId` is the one name. A **sixth** consequence decided it — the search clause sent `{ id: { contains } }`, which the adapter turns into `"id" LIKE ?` against a table with no such column, so every search failed at the database. The drive found two more defects: **Enter in a cell editor saved the value the cell started with** (a `useCallback` closure captured at mount), and a failed delete was on screen for ~300ms because the realtime refresh clears `error`. All 7 criteria verified live. `5c8c43cf`, `0064d520` |
| [POL-015](POL-015-THE-FIRST-WORKFLOW-CANNOT-BE-CREATED.md) — first workflow | — | ✅ **done** | Backend list now comes from `listWorkflowDefinitions()` — the call the panel already makes, already scoped to *running* backends with `error` on the unreachable. Better than the spec's `useLocalBackends`, which lists stopped ones. All 5 criteria verified live on a backend with `workflowCount: 0`. `480ade46` |
| [POL-006](POL-006-A-FONT-AND-AN-ICON-SET.md) — font + icon set | 8 | ✅ **done** | All 7 criteria measured live and in a real deploy build. **The font half of the spec was stale** — `--font-sans` was never dangling (REV-009 stamps `:root` into both surfaces), so criterion 5 was met before the task started. The real defect was one nothing predicted: with the token right and all four Inter faces loaded, a Text node still rendered in **Times**, because a declared `default` never runs its setter and both viewer templates style `body` without a font. Fixed in `TokenResolver.generateCss` — the one artifact preview, deploy and SSR all come through. Inter (4 weights, TTF) + Lucide (212 curated of 1998, woff2) as `noodl_modules/`. New gate: `starter-iconset:check`. |
| [POL-007](POL-007-THE-BUILD-PANEL-FITS.md) — Build panel layout | 9a | ✅ **done** | All 6 criteria measured live, both themes. The driver was written **before** the fix and caught it: `Drop from plan` laid out at `[461..576]` against a panel ending at `451`. The scrollbar's own source was not in the spec — `ScrollArea` sets `overflow-y: auto` and leaves `overflow-x` at `visible`, **which CSS computes to `auto`**. Slice 4 answered: one two-line layout at 400/750/1315, not two. Found on the way: the scope tabs' `isGrowing` (flex-basis 0) split the row into equal thirds at any width, wrapping "This component" onto a second line. |
| [POL-008](POL-008-SAMPLE-DATA-AND-A-THIN-BUILD.md) — sample data + thin build | 10 | ◐ **Part A diagnosed, not fixed** | **It is none of the three candidates.** The export always ships a complete signed-in user — `username`, `email` and a `sessionToken`, measured live with `sampleData: undefined` — and its summary is verbatim the string in Richard's screenshot. `installSandbox` intercepts the network and only the network; `UserService` requests `/users/me` only if a session already exists; nothing writes one. **The sandbox serves a signed-in user nobody asks for.** The fix that implies: seed the session where `installSandbox` runs. Part B still gated on POL-006. |
| [POL-010](POL-010-THE-WALK-DOESNT-WALK.md) — provenance walk | 12b | ✅ **done** (slice 2 deferred, as decided) | All 6 criteria. The driver was written **before** the fix and run against `HEAD`: **5/14**, and the baseline is worse than the spec said — four situations, **two** sentences, differing only by a row count. Now 15/15, four sentences, verified live on Richard's chat project. `WalkResult.foundation` (`no-graph`/`node-absent`/`port-unwired`/`walkable`) lives in the engine so OBS-004 gets it too. Two things the spec did not have: state A needed the **"no viewer"** half to be reachable at all (a held topology outlives its viewer, which is 2b's lie one scope smaller), and the in-editor preview **cannot be closed on its own** — it is a `<webview>` guest and killing it white-screens the editor. Slice 2b in. |
| [POL-011](POL-011-FX-ON-MULTILINE-STRINGS.md) — `fx` on multiline | 13 | ☐ not started | Mechanism confirmed: `multiline: true` routes to `TextAreaType`, which has no expression support. |
| [POL-012](POL-012-SET-ALL-FOUR-SIDES-AT-ONCE.md) — link padding/margin | 14 | ☐ not started | Includes the four-undo-entries defect, worth fixing independently. |

## What is confirmed vs. what is not

**Nothing in this phase is undiagnosed any more.** POL-008 Part A and POL-010 were the two whose
first slice was diagnosis rather than repair; both now have a named mechanism written into their own
spec, and in both cases the answer was **not** on the candidate list:

- **POL-008 Part A** — not "never emitted", not "wrong shape", not "the sandbox drops it". The export
  is complete and correct; the sandbox intercepts the network and nothing ever signs in, so the one
  route that would serve the sample user is never requested.
- **POL-010** — not a broken edge lookup. The topology describes what the *preview instantiated*, not
  what the graph contains.

Both are diagnosed and unfixed. Neither fix has been started.

### The pattern worth carrying

Both diagnoses died the same way a session earlier died on POL-010: **a candidate built on an
assumption about what a value looks like.** POL-010 assumed node ids are UUIDs; POL-008's three
candidates all assumed the sample data was missing. In both cases printing the actual value took two
minutes and killed the whole branch. Print it before theorising about it.

POL-007 is the same pattern applied *before* the fix rather than after. Its driver was written and
run against `HEAD` first, so the mechanism was a measurement (`Drop from plan` at `[461..576]`,
panel ending at `451`) rather than an inference — and the measurement immediately found something
the spec's own arithmetic had not: the scrollbar came from `ScrollArea` leaving `overflow-x` at
`visible`, which **CSS computes to `auto`**. Nothing had to opt into a horizontal scrollbar.

The counterexample is in the same task, and it is worth as much: the first attempt at the scope-tab
fix compiled, passed the token gate, and **changed nothing on screen**, because `.is-growing` is a
second class on the same element and outranked it. Only the screenshot caught that. A measurement
proves what it measures; it does not prove the CSS you wrote is the CSS that won.

## Found on the way, and not this phase's

- **`nodegx-backend`'s jest suite is not green at baseline.** `tests/email-flows.test.ts` fails two
  specs — both 30s timeouts in *"Send Email node (WorkflowRunner integration)"*. Confirmed
  pre-existing by running that suite against `HEAD`'s copy of the only backend file this session
  touched: it fails identically. 69 of 70 suites and 743 of 755 specs pass. Nobody owns this; it is
  recorded here so the next person does not spend the fifteen minutes proving it is not theirs.

## Answered by Richard — 2026-08-04

These close the three questions the third session left open. **Do not re-ask them**, and do not
re-derive the options — each is written into its own spec with the alternatives that were rejected.

5. **POL-005 — a backend surface stays at 860, with no route to full.** *"Leave it for now, 860 is
   enough and we can launch and survey users about it."* POL-005 is closed. If feedback after launch
   says a surface needs room, the cheap move is a larger `defaultWidth` on that one surface — the
   model already supports per-panel widths.
6. **POL-010 — build slice 3 and slice 2b. Slice 2 is deferred.** *"I like option B."* The panel
   keeps its preview-sourced topology and stops presenting one row as a result; the four states
   become distinguishable, and `TraceSession` stops serving the previous project's graph. Sourcing
   the topology from `ProjectModel` is the right destination and its own task — it carries component
   scoping and a decision about component instances.
7. **POL-008 Part A — the sandbox is signed in by default, with a toggle to sign out.** *"I think C
   is the only one that makes sense."* Seeding the session makes the `User` node's `authenticated`
   output true in every preview, so the other branch has to stay reachable. The toggle is preview
   state, never project state.

## Answered by Richard — 2026-08-03

1. **Font: Inter.**
2. **Icon set: we pick the list** — *"but make sure a user can expand the number easily, adding their
   own icons to the project from the Lucide library (dunno how you would do that, maybe add a help
   tip somewhere on the icon node?)"*. So POL-006 owns two deliverables, not one: a curated starter
   set **and** a documented, discoverable path to add any other Lucide glyph to a project. The
   affordance goes where a user meets the limit — the Icon node's property panel.
3. **`IconSize`: scope to the hide-panel button, file the rest.** POL-003 slice 2 (the four
   `is-size-*` rules, a ~130-call-site change in effect) is **out of this phase**. The hide-panel
   glyph is sized from its own container instead. `IconSize` stays inert everywhere else and the
   sweep becomes its own task — say so in the notes rather than claiming the size prop was fixed.
4. **POL-008 Part B: styling floor in CONVENTIONS, re-judged after the font lands.** As specified.

## Not in this phase

- Rebuilding the lessons. POL-002 hides the Learn tab and leaves `LearningCenter` compiling; the
  rebuild is a later learn phase.
- Model output quality beyond POL-008's styling floor.
- Anything in `index.bundle.js` — it is a committed build artifact and is not a source file.
