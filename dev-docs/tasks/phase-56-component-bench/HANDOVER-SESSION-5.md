# Phase 56 — handover after session 5 (2026-08-09)

**What ran:** **BEN-005**, built and **driven**, every acceptance criterion closed with a measured
number. The task file demanded two checks *before* any code — "confirm the runtime ignores an
unknown metadata key" and "check the autosave allowlist before assuming a `setMetaData` write
behaves the way you expect" — and unusually for this phase, both answers were the reassuring one:
**the persistence mechanism already existed and needed nothing new** (register B22).

What the drive found instead was in the code this task *reused*. Selecting a scenario is the same
operation as Reset — "make the component hold exactly these inputs" — so it inherited B13's remount
fallback, and the scenario case is the first one where that fallback's other half is visible: a
remount restores the **export's** inputs, and once a scenario is being applied the export is not the
empty one it was built as. **B21.**

Read [HANDOVER-SESSION-4.md](HANDOVER-SESSION-4.md) and
[HANDOVER-SESSION-3.md](HANDOVER-SESSION-3.md) first; B10/B13/B16 still govern, and B24 is a new
member of B10's family.

✅ **No second session was live at any point.** `git log --since="6 hours ago"` was empty at the
start, at the mid-point and before the commit, and every file in `git status` was this session's.
Every `git add` was pathspec-scoped anyway — **check again next session rather than inheriting
this**, because session 4's answer changed from false to true mid-session.

## What is on the branch

| Commit | What |
|---|---|
| (this one) | **BEN-005** — the scenario rules module, the bar, the one write, the save-trigger case, 34 specs, register rows B21–B24 and this file |

## The two questions, answered before building — and both benign (B22)

**Does a metadata write reload the preview?** It cannot. `componentMetadataChanged` reaches the
runtime's `ComponentModel.setMetadata`, whose entire body is `this.metadata[key] = data`. No reload,
no re-import, no export comparison. Confirmed live: a marker planted in the app preview window
survived every save, with `location.href` unchanged.

**How does the autosave allowlist treat it?** `Model.metadataChanged` **is already a member of
`projectSaveTriggers`**, and the ownership gate passes because the component's `owner` chain reaches
`ProjectModel.instance`. One `setMetaData` call arms the 1s debounce and the write lands.

⚠️ **That one allowlist entry is the feature's entire persistence story, and an allowlist can only
fail by omission** — the failure mode being a silently dropped user edit. So the case that would
notice lives beside the others watching that listener, in `projectsavetriggers.js`, and it reads
`project.json` back to check the scenario is in the bytes rather than trusting that *something* was
written.

## The defect the scenario switch exposed (B21)

B13 established that clearing a defaultless port needs a window reload, because a value set through
a targeted `modelUpdate` never entered the export — so rebuilding the export produces identical
bytes and `_exportToClient` drops it. True, and it left the opposite half unsaid: **a reload
re-imports whatever export the client is given**, and that export was built from an older input set.

While the export is always built empty — the only case B13 could reach — a bare `remountKey` looks
correct. Applying a scenario is the first time it is not: you would land on the values the export
was built with instead of the ones you just picked.

`applyValueSet` now bumps **both**, and they fail in opposite directions:

- `revision` rebuilds the export from `inputsRef.current`, which is already the new set;
- `remountKey` reloads the window, which is what makes the runtime accept it at all.

**Driven, with the harder half proved.** `BenchProbe` gained an unwired `Ghost` port — the corpus's
first genuinely defaultless input, which is why B13 had no live case (a port wired to anything
inherits that port's default). Set `Ghost`, select `Narrow`:

```
bench marker  uyvllj  →  null          the window reloaded, as it must
bench renders "Narrow state"           NOT the "(no title)" the export was built with
app   marker  iymnd0  →  iymnd0        the reload is confined to the bench client
```

## What the drive proved

Every number came out of the running editor, on *Puppy test 3* / `/Components/BenchProbe`.

| Claim | Evidence |
|---|---|
| Nothing saved yet → one button | The bar's entire text on first mount is `Save as scenario` |
| **Typing does not save** | 50 project files, mtimes before and after setting three inputs: **not one changed** |
| Save writes, and only that component | 4 files touched of 50 — the component's three, plus `_registry.json` |
| The scenario is in the bytes | `{name:"Loaded", inputs:{Title,Start:7,Big:true}, frame:{width:768}, stretch:false}` |
| **Three survive a restart** | Stack stopped, relaunched, reopened: `["Loaded","Empty","Narrow"]`, and `Loaded` applies with the bench marker intact |
| The frame travels with the scenario | `Loaded` → `Narrow`: read-out **768 × 150 → 360 × 150** |
| The dot follows the frame too | Stretch on → `●` with no input touched; off → gone |
| **R5 in full** | select + frame change + typing, 5s past the debounce: 50 files, **zero writes** |
| A stale scenario applies what resolves | `Title` applied and rendered; *"Subtitle, Colour are no longer an input of this component, so they were skipped."*; nothing thrown. Save then rewrote it without the dead keys |
| Rename refuses a collision rather than merging | *"Could not rename to “Loaded” — that name is already taken."*, list unchanged |
| Delete removes the scenario, not the state | Chip → `Unsaved`, Title field still holds `still here` |
| Deleting the **last** one leaves no trace | `metadata` **absent from the file entirely**, bar back to one button |

## ⚠️ Traps, for whoever drives next

- **A measure-then-click on this surface presses the control underneath (B24).**
  `cdp click '[data-test=bench-scenario-overflow]'` reported *clicked at 1007,97* while the button's
  own rect was `(1298,150)` — the layout had moved (a Save had just removed the notice line above
  the bar) between the measure and the click. What it pressed was the chrome strip's **Stretch**
  chip, and the resulting frame change was diagnosed as a scenario bug for three commands. Drive the
  bar with `element.click()` from one `eval`; the menus are plain absolutely-positioned DOM, not
  portalled, so a DOM click reaches React's handler.
- ⚠️ **One click per `eval`.** Two `eval`s that each click a toggle leave it exactly where it
  started. That reads as *"the menu will not open"* and cost several commands before the arithmetic
  was obvious.
- **A `.click()` result cannot be read in the same `eval`.** React has not re-rendered yet, so the
  DOM you read back is the pre-click one. Click in one call, read in the next.
- **`cdp type` appends, it does not replace.** `focus()` + `select()` first, or the field ends up
  holding `StaleRepaired`. One fixture value in this project now reads
  `Rex the beagleRex the beagle II` for exactly that reason.
- **A v2 editor save deletes `description`, `created` and `modifiedBy` (B23).** Not this task's
  defect — `ProjectImporter` never reads `description` and `ProjectExporter` never writes it, which
  is phase 58's AWP-002 — but the bench is now a surface where a *non-graph* action rewrites a
  component, so it is a new way to trigger it. Measured: one scenario save deleted MCP's
  218-character description from `BenchProbe/component.json`. The fixture's descriptions were
  restored by hand; the next editor save will strip them again.
- **`GUEST_VIEW_MANAGER_CALL: UnknownVizError` appears ~6 times per session in `.logs/dev.log`**,
  starting at project open before the bench is ever mounted. Pre-existing, unhandled promise
  rejection around `<webview>` teardown, no observed consequence — noted so the next driver does not
  attribute it to their change, as this one nearly did.

## Fixtures

`/Components/BenchProbe` in *Puppy test 3* gained an **unwired `Ghost` port** on its
`Component Inputs` node. That is deliberate and worth keeping: it is the only defaultless input in
the corpus, so it is the only way to reach the remount branch, and B13 spent a session establishing
that one could not be built any other way. It renders as an `untyped` row with placeholder
`Default`, which is what "no derived default" looks like.

It also carries three saved scenarios — `Loaded`, `Empty`, `Narrow` — which BEN-007 can use
directly.

## Gates

- `npm run test:ci`: **`Jasmine: 2572 specs, 6 failures`** against session 4's `2538 / 6`. **34 new
  specs, all mine, all passing**, and the **same 6 inherited failures** — 4 `AIX-006 style
  vocabulary`, 2 `AI model registry`, neither file in this diff. Compare the count, not the summary
  (B18).
- `typecheck:editor`, `typecheck:editor-tests`: clean.
- `eslint` clean on every new file; the 2 remaining errors in `VisualCanvas.tsx` are the
  pre-existing `react/no-unknown-property` pair on the webview attributes, at the same lines as at
  the base commit.

## What to do next, in order

1. **BEN-006's Live criteria** — §1–§6 are built and specced from session 1 and **every Live
   criterion is still open**. It is the half Richard named, and it is the only task left that has
   never been driven.
2. **BEN-007**, last and live. Note that it now has three saved scenarios and a defaultless port
   waiting for it in the fixture project, and that B24 is the first thing to read before driving
   the scenario bar.
3. **Loose ends**, none blocking:
   - `SiteHeader`'s six literal `Text` placeholders on the bench are still unexplained (session 4);
   - B19 still cannot tell a genuine string `"undefined"` from an unset port;
   - **§4 of BEN-005 stays out of scope and should stay there.** BEN-003's read-out gives a scenario
     something it *could* assert against, which is exactly the "run scenarios as tests" follow-up
     the task file says to file rather than build — it needs an assertion language, and inventing
     one inside a preview surface is how the bench stops being a bench.
