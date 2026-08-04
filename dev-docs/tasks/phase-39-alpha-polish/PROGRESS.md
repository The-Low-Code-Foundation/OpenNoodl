# Phase 39 — Progress

**Status:** **16 of 16 done.** POL-001 … POL-016 are all done, each verified in the running editor
with a committed driver. **One loose end** remains, listed under *"Open — the tail"* below —
POL-004's diff modal. It is not alpha-blocking.

> **The sixth session first reported this phase as "16 of 16, nothing open", and both halves of that
> were wrong.** There are **15** numbered tasks, not 16 — a miscount. And "nothing open" was only
> true of the table: POL-005 filed **three** findings, one became POL-014 and the other two were
> recorded as prose in a done task's notes cell, where nothing tracked them again. Richard caught it.
> They now have a task file. **Anything filed-not-fixed gets a row**, or it is invisible in the
> status line, in the count, and in every handover after it.

**Last updated:** 2026-08-04 (seventh session)

POL-006 also has a head start nobody had noticed: **`library/modules/lucide-icons/` already ships the
full Lucide set as a bundled ISC webfont** (1998 glyphs, `lucide.woff2` + a `type: "iconset"`
manifest), imported 2026-07-25. POL-006's premise — "no project ships one" — is true of the project
*templates*, not of the repo. The curated starter set and Richard's "let users add their own" are
both a matter of wiring that module in, not of sourcing an icon set.

## Tasks

| Task | Reported items | Status | Notes |
|---|---|---|---|
| [POL-001](POL-001-SETTINGS-PANEL-CRASH.md) — settings panel crash | 15 | ✅ **done** | All 5 criteria. Slice 2 answered: the key is not lost — v2 elides an empty `settings: {}` by design on both sides. Verified live on "AIB38 Live Chat", the project that actually crashed. `c6d5f9f8` |
| [POL-002](POL-002-LINKS-AND-THE-LEARN-TAB.md) — links + Learn tab | 1, 2, 5 | ✅ **done** (1 residual) | Removing `react-instantsearch` broke 18 unrelated files: it was the only thing in the tree still declaring a **global `JSX` namespace**, typed for *Preact's* VNode. All 22 annotations moved to `React.JSX`. **Criterion 6 run in the seventh session and it was never human-gated** — signing/notarisation/publishing need a human, a *build* does not, and `build.ts` has a `DISABLE_SIGNING` path that exists for exactly that. Both production bundles compiled clean (renderer 14.3 MB / 200s — the half the removal could break), `electron-builder --mac --arm64` exited 0 with a 182 MB dmg + zip, and **the packaged app starts**: `reactMounted: true`, launcher rendered. The alarming `duplicate dependency references` list of `@algolia/*` in the builder log is stale hoisted `node_modules` that nothing declares — the packaged app ships **none** of it. Found and fixed on the way: `autoupdater.js` wrapped a **promise-returning** `checkForUpdates()` in a `try/catch`, so every failure rejected past it and the packaged app printed an `UnhandledPromiseRejectionWarning` on **every launch** (the v0.1.0 release has no `latest-mac.yml`, so the first check always 404s). The `.catch` deliberately does not retry — the `error` listener already owns that, and doing both would spawn two checks per failure, compounding. Verified by repackaging: **2 → 0**. `d9c0f37c` |
| [POL-003](POL-003-THE-LEFT-RAIL.md) — the left rail | 3, 4, 6 | ✅ **done** (slice 2 deferred) | Contrast now 8.26:1 dark / 7.49:1 light, measured live. 5 Lucide glyphs in. `IconSize` sweep deferred per Richard → [POL-013](POL-013-ICONSIZE-SWEEP.md). `d32b3d13`, `fc10449a` |
| [POL-016](POL-016-THE-TWO-FINDINGS-POL-005-FILED.md) — POL-005's other two findings | — | ✅ **done** | All 4 criteria, both themes, against a backend the driver creates and starts. **The (a)/(b) question this task was written around was the wrong question, and counting the call sites first is what showed it.** "Add provider", "Add role" and "Issue key" — the siblings cited as evidence that `Save policy` was special — are the *identical* `Muted` variant. A muted button paints a background token off the same elevation ladder its surfaces use, so its fill measures **1.00–1.24:1 against every panel it can land on, in both themes**; on a bg-2 panel it is the same token, exactly **1.00:1**. Only the *labels* ever had contrast. So `muted` was wrong **everywhere**, at 143 call sites, and `MutedOnLowBg` fails the same way. Richard's answer 9: give the variant a border. **None of the three `border-*` tokens could carry it** (1.01–1.73:1 — divider tones, against WCAG 1.4.11's 3:1 for a control boundary), so a purpose-named `--theme-color-border-control` does, at 3.16:1 worst. An **inset ring, not `border`**: nothing sets a global `box-sizing`, so a real border would have grown all 143 by 2px — `BasePanel`'s own recorded trap. Restated on `:disabled`, which would otherwise have taken the ring off `Save policy` for exactly as long as it reads "Saving…". Schema is on the shared header, actions moved to a `.Toolbar` like `DataBrowser`'s. Census, both themes: at the matched scope (launcher, editor, 7 backend surfaces) **12 of 12 muted below 3:1 before → 0 after**; widened to 27 surfaces / 61 buttons afterwards, **0 of 20**. The widened scope was never run against `HEAD`, so that 20 is an after-only figure and is reported as one. Eleven invisible buttons beyond `Save policy`, none ever reported. `pol016-button-contrast.js` |
| [POL-013](POL-013-ICONSIZE-SWEEP.md) — make `IconSize` real | — | ✅ **done** | All 4 criteria, both themes, measured. The scale is **12/14/16/20**, defined by this task because nothing had numbers attached to these names. Three things the spec did not have: the call-site count is **441, not ~130, and 319 declare nothing**; **47 visible glyphs were not the wrong size but destroyed** (0.48–8px — `Icon`'s span is an ordinary flex item and an overflowing row crushed it, so `.Root` now carries `flex: 0 0 auto`); and criterion 5's 169-file SVG rewrite is **unnecessary**, because `svg { width: 100% }` already outranks a presentation attribute — the attributes only mattered while the span had no size. `flex: 0 0 auto` then broke three hosts that had been holding a glyph in by shrinking it; the diff caught all three and each declares a size now. **0 of 894** icons off-scale afterwards. `51beed24` |
| [POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md) — token misuse | 9b, 12a | ✅ **done** (2 residuals) | The check found **25** undefined tokens, not 6 — writing it first, per its own trap, is what caught that. `DialogBackground.Secondary` deleted; it was also miscolouring **every tooltip arrow** in the editor, which nobody reported. Gate: `npm run tokens:css`. Residual: the diff modal and a populated walk are unverified live — both need a longer drive, POL-010 owns the walk. `4382cb24` |
| [POL-005](POL-005-BACKEND-SURFACES-OPEN-DOCKED.md) — backend surfaces | 7 | ✅ **done** (1 open question) | Verified live against a running backend: all seven open at **859px** with **zero** detached-bar elements, close returns to Backend Services, WFA-005's route lands identically. Slice 3's layout pass done in both themes. **Criterion 5's premise was wrong** — a surface has no float/full route at all (1 header button vs Backend Services' 6), so this change removed the only path to full mode. Richard's call whether that matters. Three findings filed, none width-caused: [POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md) (done), and the invisible "Save policy" button + Schema's bespoke header — **which lived only in this cell for three sessions and are now [POL-016](POL-016-THE-TWO-FINDINGS-POL-005-FILED.md)**. |
| [POL-009](POL-009-A-PIN-BELONGS-TO-ONE-CANVAS.md) — pinned run | 11 | ✅ **done** | All six criteria verified live. The identity the fix compares **does** exist for a workflow canvas (`/#__workflow__/wf_pol009`) — that was the open risk. Step index survives navigation at a *non-default* value (`Step 2 / 3`), a second pin replaces the first, unpin is permanent. The pin even outlives the workflow document being closed and rebuilt. |
| [POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md) — `record.id` vs `objectId` | — | ✅ **done** | Option (b): `objectId` is the one name. A **sixth** consequence decided it — the search clause sent `{ id: { contains } }`, which the adapter turns into `"id" LIKE ?` against a table with no such column, so every search failed at the database. The drive found two more defects: **Enter in a cell editor saved the value the cell started with** (a `useCallback` closure captured at mount), and a failed delete was on screen for ~300ms because the realtime refresh clears `error`. All 7 criteria verified live. `5c8c43cf`, `0064d520` |
| [POL-015](POL-015-THE-FIRST-WORKFLOW-CANNOT-BE-CREATED.md) — first workflow | — | ✅ **done** | Backend list now comes from `listWorkflowDefinitions()` — the call the panel already makes, already scoped to *running* backends with `error` on the unreachable. Better than the spec's `useLocalBackends`, which lists stopped ones. All 5 criteria verified live on a backend with `workflowCount: 0`. `480ade46` |
| [POL-006](POL-006-A-FONT-AND-AN-ICON-SET.md) — font + icon set | 8 | ✅ **done** | All 7 criteria measured live and in a real deploy build. **The font half of the spec was stale** — `--font-sans` was never dangling (REV-009 stamps `:root` into both surfaces), so criterion 5 was met before the task started. The real defect was one nothing predicted: with the token right and all four Inter faces loaded, a Text node still rendered in **Times**, because a declared `default` never runs its setter and both viewer templates style `body` without a font. Fixed in `TokenResolver.generateCss` — the one artifact preview, deploy and SSR all come through. Inter (4 weights, TTF) + Lucide (212 curated of 1998, woff2) as `noodl_modules/`. New gate: `starter-iconset:check`. |
| [POL-007](POL-007-THE-BUILD-PANEL-FITS.md) — Build panel layout | 9a | ✅ **done** | All 6 criteria measured live, both themes. The driver was written **before** the fix and caught it: `Drop from plan` laid out at `[461..576]` against a panel ending at `451`. The scrollbar's own source was not in the spec — `ScrollArea` sets `overflow-y: auto` and leaves `overflow-x` at `visible`, **which CSS computes to `auto`**. Slice 4 answered: one two-line layout at 400/750/1315, not two. Found on the way: the scope tabs' `isGrowing` (flex-basis 0) split the row into equal thirds at any width, wrapping "This component" onto a second line. |
| [POL-008](POL-008-SAMPLE-DATA-AND-A-THIN-BUILD.md) — sample data + thin build | 10 | ✅ **done** (Part B closed, residual filed as [AIB-010](../phase-38-ai-build-ux/AIB-010-NAMED-REFERENCES-RESOLVE.md)) | Part A verified live, **9/9**, on Richard's own graph: signed in renders `sample.user@example.com`, signed out renders `Text Email placeholder` — the strings from his screenshot, now reachable only when he asks for them and under a strip that says *"signed out"*. The seam is a new `sandbox/session.ts` hung off `metadataChanged`, because the session key comes from the *export's* metadata and the shim installs before the runtime exists. It writes **every** candidate key rather than mirroring `_handle()`'s resolution rule — a drifting copy of that would fail silently, straight back into placeholders. **Part B re-judged against the real provider and its premise moved**: the agent now produces 7 styled nodes with a spacing scale, a card and a type hierarchy, rendering in Inter. What is still poor is two *invented names* — a `textStyle` and an image `src` the project does not have, both passed by the gate in silence — **filed as [AIB-010](../phase-38-ai-build-ux/AIB-010-NAMED-REFERENCES-RESOLVE.md)** and closed here (answer 8 below). |
| [POL-010](POL-010-THE-WALK-DOESNT-WALK.md) — provenance walk | 12b | ✅ **done** (slice 2 deferred, as decided) | All 6 criteria. The driver was written **before** the fix and run against `HEAD`: **5/14**, and the baseline is worse than the spec said — four situations, **two** sentences, differing only by a row count. Now 15/15, four sentences, verified live on Richard's chat project. `WalkResult.foundation` (`no-graph`/`node-absent`/`port-unwired`/`walkable`) lives in the engine so OBS-004 gets it too. Two things the spec did not have: state A needed the **"no viewer"** half to be reachable at all (a held topology outlives its viewer, which is 2b's lie one scope smaller), and the in-editor preview **cannot be closed on its own** — it is a `<webview>` guest and killing it white-screens the editor. Slice 2b in. |
| [POL-011](POL-011-FX-ON-MULTILINE-STRINGS.md) — `fx` on multiline | 13 | ✅ **done** | All 6 criteria, **8/8 in both themes**. The check that matters is the one the panel cannot answer: with the expression set to `Noodl.Variables.pol011Greeting`, the **running preview rendered `Hello from a variable`**. `TextAreaType` now renders the same row every other string does (new `PropertyPanelInputType.TextArea`) rather than a bare `PropertyPanelRow` — which was the whole defect — and the value↔expression conversion moved into `expressionProps.ts` so there is one copy. Slice 3 decided in `Ports.ts` as a table: `codeeditor` and `identifierOf` get **no**, and structurally cannot offer it, so a flag would be dead code. Two harness facts worth keeping: `node.parameters[name]` vs `getParameter(name)` (three false failures), and `data-identifier` **disappears in expression mode** — the row needed a `data-property` that survives the switch. |
| [POL-012](POL-012-SET-ALL-FOUR-SIDES-AT-ONCE.md) — link padding/margin | 14 | ✅ **done** | All 7 criteria, **12/12 in both themes** on a real node, values read off `NodeGraphNode.parameters` rather than the screen. One undo step (`change padding`), and one undo press restores all four including the side that was on `%`. Slice 4's survey: corner radius already has "all four at once" (a single `borderRadius` plus per-corner overrides) so it needs nothing. Two lessons: *"link on only if all four agree"* means it starts **on** (four untouched sides agree), which cost the driver five false failures; and **12/12 said nothing about where the control sits** — the first placement covered the group tags and the padding-top field, and only a screenshot caught it. The overlap is a measurement now. |

## What is confirmed vs. what is not

**Nothing in this phase is undiagnosed any more.** POL-008 Part A and POL-010 were the two whose
first slice was diagnosis rather than repair; both now have a named mechanism written into their own
spec, and in both cases the answer was **not** on the candidate list:

- **POL-008 Part A** — not "never emitted", not "wrong shape", not "the sandbox drops it". The export
  is complete and correct; the sandbox intercepts the network and nothing ever signs in, so the one
  route that would serve the sample user is never requested.
- **POL-010** — not a broken edge lookup. The topology describes what the *preview instantiated*, not
  what the graph contains.

Both were fixed in the fifth session and verified live; the paragraphs above are kept because the
diagnoses are the reusable part.

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

POL-013 is the pattern at its most useful, and it added a step: **the instrument has to be shown
trustworthy before its output is evidence.** Two runs of the *same build* disagreed by 47 icons,
because the side panel keeps whatever width the previous run left it and a flex-shrunk glyph is a
correct measurement of a different layout. Pinning the viewport and adding a 0.5px floor took
same-build churn to zero, and only then did a 307-icon diff mean anything. The other half of the
same lesson: the first before/after diff reported `1354 appeared / 1355 vanished / 0 unchanged`,
because the census keyed each icon by a DOM path containing its class list — and the change adds a
class. **A key must not contain the thing the change changes**; total churn is that bug's signature,
not a big result.

## Found on the way, and fixed — 2026-08-04 (sixth session)

**Closing a project with the Settings panel open white-screened the editor.** `3462ee00`. Found
because POL-013's census has to leave a project to census the launcher, and the exit killed the app
every time.

`router.tsx` nulls `ProjectModel.instance` from a `setTimeout(…, 0)` — a deliberate HACK, commented
as such, meant to let React unmount everything first. `ProjectSettingsTab` loses that race: its
cleanup called `ProjectModel.instance.off(group)` on an undefined singleton, which threw *inside a
cleanup*, uncaught, and tore the tree down.

Isolated rather than inferred: with the Settings panel open, `exitProject()` left `rootChildren: 0`
and zero body text every time; with only the Components panel open it did not, because the component
was not mounted. The other two call sites of the same shape — `nodegrapheditor.ts` and
`useComponentsPanel.ts` — already guard, so the guarded form is the house pattern and this was the
one site that missed it.

Worth noticing for the alpha: this is the **third** defect in this phase whose whole mechanism is
"the Settings surface throws" ([POL-001](POL-001-SETTINGS-PANEL-CRASH.md), POL-004's tooltip token,
this). It is the surface a user reaches for first when something looks wrong.

## Found on the way, and not this phase's

- **`nodegx-backend`'s jest suite is not green at baseline.** `tests/email-flows.test.ts` fails two
  specs — both 30s timeouts in *"Send Email node (WorkflowRunner integration)"*. Confirmed
  pre-existing by running that suite against `HEAD`'s copy of the only backend file this session
  touched: it fails identically. 69 of 70 suites and 743 of 755 specs pass. Nobody owns this; it is
  recorded here so the next person does not spend the fifteen minutes proving it is not theirs.

## Open — the tail

**One loose end.** Not alpha-blocking. POL-016 and POL-002's criterion 6 both closed in the seventh
session — the latter was **not** human-gated after all, and re-testing the inherited assumption is
what showed it (see POL-002's notes, and the auto-updater defect that fell out of actually running
the packaged app).

1. **POL-004 criterion 1 — the doc-review diff modal is still unverified live.** The other half of
   that residual (a populated provenance walk) was closed by POL-010. The modal was fixed by the
   token work and screenshotted in neither theme. It needs a drive that opens a doc review with a
   real diff in it.

## Answered by Richard — 2026-08-04

These close the three questions the third session left open. **Do not re-ask them**, and do not
re-derive the options — each is written into its own spec with the alternatives that were rejected.

8. **POL-008 Part B — file (a) as its own task and close Part B.** Not alpha-blocking: an invented
   style name is ugly output, not a crash. Filed as
   [AIB-010 — A named reference must resolve](../phase-38-ai-build-ux/AIB-010-NAMED-REFERENCES-RESOLVE.md),
   next to AIB-001 whose table it extends. The mechanism was traced before filing and it is two
   halves, neither of them a styling problem: `nameTypeFormat` checks `typeof value === 'string'` and
   stops (deliberately — that module is pure and has no project to look a name up in), and **nothing
   in the agent's context carries the names** (the AIX-006 style vocabulary renders design *tokens*,
   not `styles.text`, which is exactly why `var(--surface)` resolved and `heading-3` did not; and
   the three read tools list no project styles or assets, so it cannot even ask). Option (b) stays
   rejected on the evidence.

9. **POL-016 — give `muted` a border.** Asked with the call-site survey in hand, which had already
   moved the question: the three siblings the task cited as working counter-examples are the *same*
   variant, and a muted button's fill measures 1.00–1.24:1 against every surface it can land on, so
   the choice was not "wrong here or wrong generally" but "wrong everywhere, 143 call sites". Richard
   picked the one-rule fix over re-pointing the single call site, knowing it changes all 143 —
   *toward* looking like buttons. Implemented as an inset ring in a new `--theme-color-border-control`,
   because the existing `border-*` tokens are divider tones that cannot clear 3:1 and a real `border`
   would have resized every one of them.

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
