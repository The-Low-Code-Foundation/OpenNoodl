# BEN-005 — Scenarios: a named set of inputs, saved

**Status:** ✅ **built** (session 5, 2026-08-09) · depends on **BEN-002**

## The two questions this file said to answer first, answered

Both were "check before assuming", both are answered in source below, and both were then
confirmed live — see the acceptance table.

**1. Does a metadata write reload the preview?** No, and there is nothing in the path that could.
`ComponentModel.setMetaData` raises `Model.metadataChanged`, `ViewerConnection` forwards it as a
`componentMetadataChanged` modelUpdate
([:1068](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L1068)), and the runtime's
handler ([editormodeleventshandler.ts:309](../../../packages/noodl-runtime/src/editormodeleventshandler.ts#L309))
looks the component up and calls `setMetadata`, whose whole body is
`this.metadata[key] = data` ([componentmodel.ts:458](../../../packages/noodl-runtime/src/models/componentmodel.ts#L458)).
No reload, no re-import, no export comparison. An unknown key is stored and ignored, which is
exactly what §1 asked for.

**2. How does the autosave allowlist treat it?** `Model.metadataChanged` **is a member of
`projectSaveTriggers`** ([projectmodel.ts:1516](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts#L1516)),
and the ownership gate passes because the component's `owner` chain reaches `ProjectModel.instance`.
So one `setMetaData` call arms the 1s debounce and the write lands with no save call of its own.

⚠️ **That one allowlist entry is the feature's entire persistence story, and an allowlist can only
fail by omission.** So the case that would notice lives beside the others that watch it:
*"saving a bench scenario on a component DOES rewrite the project, with the scenario in it"* in
[projectsavetriggers.js](../../../packages/noodl-editor/tests/project/projectsavetriggers.js), which
plants a disk-only sentinel, saves a scenario, and then reads `project.json` back to check the
scenario is in the bytes rather than merely that *something* was written.

## Why this earns its place on disk

Everything else in this phase is ephemeral by rule (R5). Scenarios are the one deliberate exception,
and the argument for them is that **a set of input values is authored intent, not preview state.**

The payoff is the thing storybook-style tools are actually used for: a builder clicks
`Empty → Loaded → Long name → Error` and sees four states in four seconds. That is a review that
would otherwise require building four pages. It is also the cheapest possible regression check a
component can carry — the states it is *supposed* to survive, written down next to it.

And it composes with the AI build panel: a component mode build can ship **with** its scenarios, so
"here is what I made" becomes "here is what I made, in its four states, look at them". That is a
better accept/reject decision than a single render.

## Build

### 1. Storage

`ComponentModel.setMetaData(key, data)` / `getMetaData(key)`
([componentmodel.ts:344-357](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L344-L357)),
round-tripped through `toJSON` at [:364](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L364).
One key, holding an ordered list:

```ts
{ scenarios: Array<{ name: string; inputs: Record<string, unknown>; frame?: {...}; stretch?: boolean }> }
```

Frame and stretch belong in the scenario: "renders correctly at 320" is part of what the state is
claiming.

⚠️ `setMetaData` notifies `ComponentModel.metadataChanged`, which `ViewerConnection` forwards as a
`componentMetadataChanged` modelUpdate ([:1037](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L1037)).
Confirm the runtime ignores an unknown metadata key rather than reloading on it — if saving a
scenario reloads the app preview, that is a defect this task introduced.

### 2. The UI

A single row above the inputs rail:

```
Scenario:  [ Loaded ▾ ]   [ Save ]  [ ⋯ ]
```

- selecting a scenario applies its inputs to the rail and re-renders;
- editing any input marks the scenario **modified** (an unsaved-changes dot, not a dialog);
- **Save** overwrites; **Save as…** names a new one; the overflow renames, reorders and deletes.
- No scenarios yet → the row is a single **Save as scenario** button. It should not look like a
  feature you have to configure before the bench works.

### 3. The rule that must not bend

**Typing does not save.** Selecting a component does not save. Closing the bench does not save.
Only Save saves, and only Save marks the project dirty. R5 exists because a preview that silently
edits `project.json` is a preview you stop trusting — and because an autosave allowlist already
governs what is allowed to write (`autosave-allowlist-f46`); check the interaction before assuming a
`setMetaData` write behaves the way you expect.

### 4. Not in scope

- Running scenarios as automated tests. Tempting, and a real follow-up, but it needs an assertion
  language this task does not have. If it comes up, file it as a row, not a scope creep.
- Scenarios for backend data — that is BEN-006's dataset, saved separately if at all.

## Acceptance — all closed, every number from a running editor

Driven 2026-08-09 on *Puppy test 3*, `/Components/BenchProbe`. ⚠️ **That project is v2 format**
(`nodegx.project.json` + `components/**`), so the round trip is not through `project.json`'s
`toJSON` at all — it is through `ProjectExporter.buildComponentV2Files`, which writes
`componentFile.metadata` and `ProjectImporter` reads back. Both directions verified on disk.

- [x] **Spec:** scenarios survive a project save/load round trip. 34 specs, and the round trip is
      asserted **on disk** rather than through `toJSON`, in `projectsavetriggers.js`.
- [x] **Spec:** no code path in the bench writes metadata except the explicit save. One
      `setMetaData` call exists in the whole surface (`ComponentBench.persistScenarios`), reached
      only from Save / Save as… / Rename / Move / Delete.
- [x] **Live:** save three, restart, reopen, all three apply.
- [x] **Live:** saving a scenario does not reload or disturb the app preview.
- [x] **Live:** switching scenarios re-renders without a full reload.
- [x] Editing an input after selecting shows the modified state and does not persist.

| Claim | Evidence |
|---|---|
| Nothing saved yet → one button, not a control panel | The bar's entire text on first mount is `Save as scenario` |
| **Typing does not save** | 50 project files, mtimes before and after setting three inputs: **not one changed** |
| Save writes, and writes **only** that component | 4 files touched — `BenchProbe/{component,nodes,connections}.json` and `_registry.json`. The other 46 untouched |
| The scenario is *in* the bytes | `metadata["bench.scenarios"].scenarios[0]` = `{name:"Loaded", inputs:{Title,Start:7,Big:true}, frame:{width:768}, stretch:false}` |
| The app preview is not disturbed | Marker planted in the app preview window before the save, still there after; `location.href` unchanged |
| **Three survive a restart** | Stack stopped, relaunched, project reopened, bench remounted: `["Loaded","Empty","Narrow"]` |
| …and apply | `Loaded` → rail shows `Rex the beagle…`/`7`/`on`, bench renders it, **bench marker survives** — no reload |
| The frame travels with the scenario | `Loaded` → `Narrow`: read-out **768 × 150 → 360 × 150**, Title becomes `Narrow state`, Start and Big back to defaults, marker still alive |
| The dot follows the frame too | Stretch on → `●` appears with no input touched; stretch off → `●` goes. The frame is part of what a scenario claims, and the dot agrees |
| **R5 in full** | select + frame change + typing, then 5s past the debounce: 50 files, **zero writes** |
| A stale scenario applies what resolves | Hand-planted `Stale` naming `Subtitle` and `Colour`: `Title` applied and rendered, notice reads *"Subtitle, Colour are no longer an input of this component, so they were skipped."*, nothing thrown |
| …and Save cleans it up | Overwriting `Stale` rewrote it to `inputs:{Title}` — the two dead keys dropped |
| Rename keeps its place, and refuses a collision | `Stale` → `StaleRepaired` stayed 3rd of 4 on disk; renaming onto `Loaded` left the list untouched and said *"Could not rename to “Loaded” — that name is already taken."* |
| Reorder | `Move up`: `[Loaded, Empty, Narrow, Stale]` → `[Loaded, Empty, Stale, Narrow]` |
| Delete removes the scenario, not the state | After deleting the selected scenario the chip reads `Unsaved` and the Title field still holds `still here` |
| Deleting the **last** one leaves no trace | On `/Components/BenchLogicProbe`: save → `metadata` present; delete → `metadata` **absent from the file entirely**, and the bar back to one button |
| **B13's remount branch, exercised at last** | See below |

### The remount branch has a live case now, and it needed the harder half proving

B13 recorded that Reset's remount fallback was *"code without a live case"*: a defaultless port is
one wired to nothing, and no component in the corpus had one. Adding an unwired `Ghost` port to
`BenchProbe`'s `Component Inputs` node makes one — the rail types it `untyped` with placeholder
`Default`, which is exactly "no derived default".

Set `Ghost`, then select `Narrow` (which does not set it):

- the bench window's marker went **`uyvllj` → null** — it reloaded, which is the only thing that
  clears a value the runtime was handed by a targeted update;
- the reloaded window renders **`Narrow state`**, not the `(no title)` the export was built with.
  That is the half that matters: a bare `remountKey` would have restored the *export's* inputs;
- the app preview's marker survived, so the reload is confined to the bench client.

## Where this deviates from the plan above, and why

1. **§1's frame needed a setter that did not exist.** `frame` is `VisualCanvas` state and
   `ComponentBench` could only read it, so applying a scenario's width was impossible until
   `onFrameChange` was added. It has exactly one caller.
2. **Reset, Reset all and "select a scenario" are one operation, not three.** All three mean *make
   the component hold exactly these inputs*, and all three have to know B13's two routes. They now
   share `applyValueSet`, which is also the only place the remount fallback lives.
3. **The dot compares against what a *save* would produce, not against raw state.** Comparing raw
   state would show the dot for an `undefined` that saving drops — Save would be offered for a
   change saving cannot record, and pressing it would leave the dot where it was.
4. **§4 stays out of scope, and the outputs read-out does not change that.** BEN-003 gives a
   scenario something it *could* assert against, which is tempting and is still the follow-up §4
   describes: it needs an assertion language this task does not have. Filed, not built.

## Risks

| Risk | Mitigation |
|---|---|
| A scenario references an input that was later renamed or deleted | Apply what still resolves, list what did not in the summary, never throw. The same rule BEN-001 §2 uses for unknown keys |
| Scenario values contain something unserialisable | Constrain to JSON-serialisable values at save time and reject with a message |
| Metadata write triggers a preview reload | Checked explicitly above — this is the first thing to verify, not the last |
