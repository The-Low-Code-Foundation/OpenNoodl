# Phase 39 — Progress

**Status:** **18 numbered tasks — POL-001 … POL-018, and 18 `POL-*.md` files on disk, no gaps.
16 are done with a committed driver each; 2 are open.** The three loose ends carried across sessions
(POL-002's packaged build, POL-004's diff modal, POL-016's two findings) were all closed in the
seventh session, so **every criterion of every done task is verified live**.

The two that are open, and neither is alpha-blocking:

- **[POL-017](POL-017-CODE-GUTTER-LINE-NUMBERS.md)** — filed, not fixed. Found by POL-004's own drive.
- **[POL-018](POL-018-A-PROJECT-SOURCED-TOPOLOGY.md)** — **deferred by Richard's decision 6**, not
  done and not abandoned. POL-010 slice 2.

**Where the 18 come from, since this line has been miscounted twice.** Richard reported **15 items**
(the [README](README.md) table). Those became **12** tasks, POL-001 … POL-012 — three tasks each
cover more than one item. The other **six** were found or spun off during the phase and were never
reported by anyone: POL-013 (POL-003's deferred `IconSize` sweep), POL-014 and POL-016 (POL-005's
layout pass), POL-015 (POL-009's fixture setup), POL-017 (POL-004's contrast measurement) and
POL-018 (POL-010's deferred slice 2). **Reported items are not tasks and the two counts must never
be added together** — that is what produced "16" in the first place.

> **The sixth session first reported this phase as "16 of 16, nothing open", and both halves of that
> were wrong.** The count was wrong: **15** files existed at that moment (POL-001 … POL-015), not 16.
> And "nothing open" was only true of the table: POL-005 filed **three** findings, one became POL-014
> and the other two were recorded as prose in a done task's notes cell, where nothing tracked them
> again. Richard caught it. They now have a task file. **Anything filed-not-fixed gets a row**, or it
> is invisible in the status line, in the count, and in every handover after it.
>
> **The same rule was then broken again inside the phase that adopted it.** POL-010's slice 2 was
> *deferred by a Richard decision recorded in this file* and given no row and no file for two days —
> deferred-by-decision is a state, not an absence, and a state with no row is invisible exactly as a
> filed-not-fixed finding is. It is [POL-018](POL-018-A-PROJECT-SOURCED-TOPOLOGY.md) now.

**Last updated:** 2026-08-06 (register hygiene pass: three stale status tags corrected, the count
reconciled, POL-018 given the row Richard's decision 6 always implied)

POL-006 also has a head start nobody had noticed: **`library/modules/lucide-icons/` already ships the
full Lucide set as a bundled ISC webfont** (1998 glyphs, `lucide.woff2` + a `type: "iconset"`
manifest), imported 2026-07-25. POL-006's premise — "no project ships one" — is true of the project
*templates*, not of the repo. The curated starter set and Richard's "let users add their own" are
both a matter of wiring that module in, not of sourcing an icon set.

## Tasks

| Task | Reported items | Status | Notes |
|---|---|---|---|
| [POL-017](POL-017-CODE-GUTTER-LINE-NUMBERS.md) — code gutter line numbers | — | ☐ **filed, not fixed** | Found 2026-08-04 by POL-004's criterion-1 drive, in the same modal but **not** POL-004's defect. `codemirror-theme.ts:60` styles every CodeMirror gutter with `fg-muted` — **3.17:1 dark / 3.16:1 light** against the gutter, against WCAG 1.4.3's 4.5:1 for text. `colors.css` documents that token as *"large/secondary text only"*, so it is the right token at the wrong size, not the token misuse POL-004 was about. Neat coincidence not to misread: `fg-muted` is exactly what POL-016 chose for `--theme-color-border-control`, and that is correct there — **3:1 for a control boundary, 4.5:1 for text**. Replacement already measured: `fg-default-shy` (4.82 / 4.67), the smallest step that clears it. Not alpha-blocking. |
| [POL-018](POL-018-A-PROJECT-SOURCED-TOPOLOGY.md) — a project-sourced topology | — | ⏸ **deferred by decision** | POL-010 slice 2, given the row it should have had on 2026-08-04. **Deferred, not dropped**: Richard's answer 6 below built slices 3 and 2b and said *"Sourcing the topology from `ProjectModel` is the right destination and its own task — it carries component scoping and a decision about component instances."* Until it lands, the provenance walk answers about **what the preview instantiated**, not about the user's graph: walking back from `messagesText.text` to `Query Messages` still needs the Chat page mounted, and POL-010's own fixture shows the runtime dropping **4 of 12** declared edges even *with* it mounted (a `JavaScriptFunction`'s dynamic ports are never registered). Two open questions belong to Richard, not to the builder — both written up in the task. Not alpha-blocking: POL-010 slice 3 means the panel now says why it cannot answer instead of showing one row as a result. |
| [POL-001](POL-001-SETTINGS-PANEL-CRASH.md) — settings panel crash | 15 | ✅ **done** | All 5 criteria. Slice 2 answered: the key is not lost — v2 elides an empty `settings: {}` by design on both sides. Verified live on "AIB38 Live Chat", the project that actually crashed. `c6d5f9f8` |
| [POL-002](POL-002-LINKS-AND-THE-LEARN-TAB.md) — links + Learn tab | 1, 2, 5 | ✅ **done** (all 6 criteria) | Removing `react-instantsearch` broke 18 unrelated files: it was the only thing in the tree still declaring a **global `JSX` namespace**, typed for *Preact's* VNode. All 22 annotations moved to `React.JSX`. **Criterion 6 run in the seventh session and it was never human-gated** — signing/notarisation/publishing need a human, a *build* does not, and `build.ts` has a `DISABLE_SIGNING` path that exists for exactly that. Both production bundles compiled clean (renderer 14.3 MB / 200s — the half the removal could break), `electron-builder --mac --arm64` exited 0 with a 182 MB dmg + zip, and **the packaged app starts**: `reactMounted: true`, launcher rendered. The alarming `duplicate dependency references` list of `@algolia/*` in the builder log is stale hoisted `node_modules` that nothing declares — the packaged app ships **none** of it. Found and fixed on the way: `autoupdater.js` wrapped a **promise-returning** `checkForUpdates()` in a `try/catch`, so every failure rejected past it and the packaged app printed an `UnhandledPromiseRejectionWarning` on **every launch** (the v0.1.0 release has no `latest-mac.yml`, so the first check always 404s). The `.catch` deliberately does not retry — the `error` listener already owns that, and doing both would spawn two checks per failure, compounding. Verified by repackaging: **2 → 0**. `d9c0f37c` |
| [POL-003](POL-003-THE-LEFT-RAIL.md) — the left rail | 3, 4, 6 | ✅ **done** (slice 2 deferred) | Contrast now 8.26:1 dark / 7.49:1 light, measured live. 5 Lucide glyphs in. `IconSize` sweep deferred per Richard → [POL-013](POL-013-ICONSIZE-SWEEP.md). `d32b3d13`, `fc10449a` |
| [POL-016](POL-016-THE-TWO-FINDINGS-POL-005-FILED.md) — POL-005's other two findings | — | ✅ **done** | All 4 criteria, both themes, against a backend the driver creates and starts. **The (a)/(b) question this task was written around was the wrong question, and counting the call sites first is what showed it.** "Add provider", "Add role" and "Issue key" — the siblings cited as evidence that `Save policy` was special — are the *identical* `Muted` variant. A muted button paints a background token off the same elevation ladder its surfaces use, so its fill measures **1.00–1.24:1 against every panel it can land on, in both themes**; on a bg-2 panel it is the same token, exactly **1.00:1**. Only the *labels* ever had contrast. So `muted` was wrong **everywhere**, at 143 call sites, and `MutedOnLowBg` fails the same way. Richard's answer 9: give the variant a border. **None of the three `border-*` tokens could carry it** (1.01–1.73:1 — divider tones, against WCAG 1.4.11's 3:1 for a control boundary), so a purpose-named `--theme-color-border-control` does, at 3.16:1 worst. An **inset ring, not `border`**: nothing sets a global `box-sizing`, so a real border would have grown all 143 by 2px — `BasePanel`'s own recorded trap. Restated on `:disabled`, which would otherwise have taken the ring off `Save policy` for exactly as long as it reads "Saving…". Schema is on the shared header, actions moved to a `.Toolbar` like `DataBrowser`'s. Census, both themes: at the matched scope (launcher, editor, 7 backend surfaces) **12 of 12 muted below 3:1 before → 0 after**; widened to 27 surfaces / 61 buttons afterwards, **0 of 20**. The widened scope was never run against `HEAD`, so that 20 is an after-only figure and is reported as one. Eleven invisible buttons beyond `Save policy`, none ever reported. `pol016-button-contrast.js` |
| [POL-013](POL-013-ICONSIZE-SWEEP.md) — make `IconSize` real | — | ✅ **done** | All 4 criteria, both themes, measured. The scale is **12/14/16/20**, defined by this task because nothing had numbers attached to these names. Three things the spec did not have: the call-site count is **441, not ~130, and 319 declare nothing**; **47 visible glyphs were not the wrong size but destroyed** (0.48–8px — `Icon`'s span is an ordinary flex item and an overflowing row crushed it, so `.Root` now carries `flex: 0 0 auto`); and criterion 5's 169-file SVG rewrite is **unnecessary**, because `svg { width: 100% }` already outranks a presentation attribute — the attributes only mattered while the span had no size. `flex: 0 0 auto` then broke three hosts that had been holding a glyph in by shrinking it; the diff caught all three and each declares a size now. **0 of 894** icons off-scale afterwards. `51beed24` |
| [POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md) — token misuse | 9b, 12a | ✅ **done** (all 5 criteria) | The check found **25** undefined tokens, not 6 — writing it first, per its own trap, is what caught that. `DialogBackground.Secondary` deleted; it was also miscolouring **every tooltip arrow** in the editor, which nobody reported. Gate: `npm run tokens:css`. **Both residuals now closed** — POL-010 did the walk, and criterion 1 (the diff modal) was verified live in the seventh session: the sheet is `bg-1` in both themes (`#12161b` / `#ffffff`) and `secondary` is not used, so the inverted-sheet defect is gone. Driven on a **real diff** by `pol004-doc-diff.js`, which scripts a doc operation against a project it gives a `docs/BRIEF.md` first — a doc op with a null baseline renders as a whole-file creation and would not have shown the defect at its worst. The same measurement found ten text nodes below 4.5:1 (gutter line numbers at 3.17:1) — not this task's defect, filed as [POL-017](POL-017-CODE-GUTTER-LINE-NUMBERS.md). `4382cb24` |
| [POL-005](POL-005-BACKEND-SURFACES-OPEN-DOCKED.md) — backend surfaces | 7 | ✅ **done** (closed by Richard's answer 5) | Verified live against a running backend: all seven open at **859px** with **zero** detached-bar elements, close returns to Backend Services, WFA-005's route lands identically. Slice 3's layout pass done in both themes. **Criterion 5's premise was wrong** — a surface has no float/full route at all (1 header button vs Backend Services' 6), so this change removed the only path to full mode. **Answered 2026-08-04 (answer 5 below): leave it** — *"860 is enough and we can launch and survey users about it."* If feedback says otherwise the cheap move is a larger `defaultWidth` on the one surface that needs it. Three findings filed, none width-caused, **all three now closed**: [POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md) (done), and the invisible "Save policy" button + Schema's bespoke header — **which lived only in this cell for three sessions and are now [POL-016](POL-016-THE-TWO-FINDINGS-POL-005-FILED.md)** (done). |
| [POL-009](POL-009-A-PIN-BELONGS-TO-ONE-CANVAS.md) — pinned run | 11 | ✅ **done** | All six criteria verified live. The identity the fix compares **does** exist for a workflow canvas (`/#__workflow__/wf_pol009`) — that was the open risk. Step index survives navigation at a *non-default* value (`Step 2 / 3`), a second pin replaces the first, unpin is permanent. The pin even outlives the workflow document being closed and rebuilt. |
| [POL-014](POL-014-THE-DATA-BROWSER-READS-A-KEY-NOTHING-SENDS.md) — `record.id` vs `objectId` | — | ✅ **done** | Option (b): `objectId` is the one name. A **sixth** consequence decided it — the search clause sent `{ id: { contains } }`, which the adapter turns into `"id" LIKE ?` against a table with no such column, so every search failed at the database. The drive found two more defects: **Enter in a cell editor saved the value the cell started with** (a `useCallback` closure captured at mount), and a failed delete was on screen for ~300ms because the realtime refresh clears `error`. All 7 criteria verified live. `5c8c43cf`, `0064d520` |
| [POL-015](POL-015-THE-FIRST-WORKFLOW-CANNOT-BE-CREATED.md) — first workflow | — | ✅ **done** | Backend list now comes from `listWorkflowDefinitions()` — the call the panel already makes, already scoped to *running* backends with `error` on the unreachable. Better than the spec's `useLocalBackends`, which lists stopped ones. All 5 criteria verified live on a backend with `workflowCount: 0`. `480ade46` |
| [POL-006](POL-006-A-FONT-AND-AN-ICON-SET.md) — font + icon set | 8 | ✅ **done** | All 7 criteria measured live and in a real deploy build. **The font half of the spec was stale** — `--font-sans` was never dangling (REV-009 stamps `:root` into both surfaces), so criterion 5 was met before the task started. The real defect was one nothing predicted: with the token right and all four Inter faces loaded, a Text node still rendered in **Times**, because a declared `default` never runs its setter and both viewer templates style `body` without a font. Fixed in `TokenResolver.generateCss` — the one artifact preview, deploy and SSR all come through. Inter (4 weights, TTF) + Lucide (212 curated of 1998, woff2) as `noodl_modules/`. New gate: `starter-iconset:check`. |
| [POL-007](POL-007-THE-BUILD-PANEL-FITS.md) — Build panel layout | 9a | ✅ **done** | All 6 criteria measured live, both themes. The driver was written **before** the fix and caught it: `Drop from plan` laid out at `[461..576]` against a panel ending at `451`. The scrollbar's own source was not in the spec — `ScrollArea` sets `overflow-y: auto` and leaves `overflow-x` at `visible`, **which CSS computes to `auto`**. Slice 4 answered: one two-line layout at 400/750/1315, not two. Found on the way: the scope tabs' `isGrowing` (flex-basis 0) split the row into equal thirds at any width, wrapping "This component" onto a second line. |
| [POL-008](POL-008-SAMPLE-DATA-AND-A-THIN-BUILD.md) — sample data + thin build | 10 | ✅ **done** (Part B closed, residual filed as [AIB-010](../phase-38-ai-build-ux/AIB-010-NAMED-REFERENCES-RESOLVE.md)) | Part A verified live, **9/9**, on Richard's own graph: signed in renders `sample.user@example.com`, signed out renders `Text Email placeholder` — the strings from his screenshot, now reachable only when he asks for them and under a strip that says *"signed out"*. The seam is a new `sandbox/session.ts` hung off `metadataChanged`, because the session key comes from the *export's* metadata and the shim installs before the runtime exists. It writes **every** candidate key rather than mirroring `_handle()`'s resolution rule — a drifting copy of that would fail silently, straight back into placeholders. **Part B re-judged against the real provider and its premise moved**: the agent now produces 7 styled nodes with a spacing scale, a card and a type hierarchy, rendering in Inter. What is still poor is two *invented names* — a `textStyle` and an image `src` the project does not have, both passed by the gate in silence — **filed as [AIB-010](../phase-38-ai-build-ux/AIB-010-NAMED-REFERENCES-RESOLVE.md)** and closed here (answer 8 below). |
| [POL-010](POL-010-THE-WALK-DOESNT-WALK.md) — provenance walk | 12b | ✅ **done** (slice 2 deferred → [POL-018](POL-018-A-PROJECT-SOURCED-TOPOLOGY.md)) | All 6 criteria. The driver was written **before** the fix and run against `HEAD`: **5/14**, and the baseline is worse than the spec said — four situations, **two** sentences, differing only by a row count. Now 15/15, four sentences, verified live on Richard's chat project. `WalkResult.foundation` (`no-graph`/`node-absent`/`port-unwired`/`walkable`) lives in the engine so OBS-004 gets it too. Two things the spec did not have: state A needed the **"no viewer"** half to be reachable at all (a held topology outlives its viewer, which is 2b's lie one scope smaller), and the in-editor preview **cannot be closed on its own** — it is a `<webview>` guest and killing it white-screens the editor. Slice 2b in. |
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

**Two open tasks, no loose ends.** The seventh session closed all three items it inherited — POL-016,
POL-002's criterion 6 (which was **not** human-gated after all) and POL-004's criterion 1 — and filed
one new finding on the way. The second open task is not new work: it is POL-010's deferral, which had
been carried as a sentence in answer 6 and nowhere else.

1. **[POL-017](POL-017-CODE-GUTTER-LINE-NUMBERS.md) — every code editor's line numbers are below the
   text contrast floor.** Found by POL-004's drive, in the same modal, but not POL-004's defect:
   `codemirror-theme.ts` styles every CodeMirror gutter with `fg-muted`, which measures **3.17:1 /
   3.16:1** against the gutter against WCAG 1.4.3's 4.5:1. Not alpha-blocking — legible, just under
   the bar. The replacement token is already measured (`fg-default-shy`, 4.82 / 4.67); what the task
   owes is the sweep, because `fg-muted` appears three times in that file on three different
   backgrounds and they are not interchangeable.

2. **[POL-018](POL-018-A-PROJECT-SOURCED-TOPOLOGY.md) — the provenance walk asks the runtime a
   question only the project can answer.** Deferred by answer 6 on 2026-08-04, and it is deferred
   *by decision* rather than open by neglect — but it had no row and no file until 2026-08-06, which
   is the pol-013 failure repeating inside the phase that named it. The work is bounded (one producer
   inside `TraceSession`; `walkEngine.ts` does not change and must stay import-free for OBS-004) and
   it carries two questions that are Richard's, not the builder's: how far a walk may cross component
   boundaries, and what a hop *means* in a component instantiated three times.

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
   scoping and a decision about component instances. **That task is
   [POL-018](POL-018-A-PROJECT-SOURCED-TOPOLOGY.md)**, filed 2026-08-06; it went two days with no row
   and no file, which is precisely the thing the blockquote at the top of this document says never to
   let happen.
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
