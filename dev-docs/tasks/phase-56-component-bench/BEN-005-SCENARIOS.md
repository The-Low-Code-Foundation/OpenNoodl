# BEN-005 — Scenarios: a named set of inputs, saved

**Status:** 📋 not started · depends on **BEN-002**

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

## Acceptance

- [ ] Spec: scenarios survive a project save/load round trip through `toJSON`.
- [ ] Spec: no code path in the bench writes metadata except the explicit save.
- [ ] **Live:** save three scenarios on a card, restart the editor, reopen the bench, and all three
      apply correctly.
- [ ] **Live:** saving a scenario does not reload or disturb the app preview.
- [ ] **Live:** switching between scenarios re-renders without a full reload (the BEN-002 path).
- [ ] Editing an input after selecting a scenario shows the modified state and does not persist.

## Risks

| Risk | Mitigation |
|---|---|
| A scenario references an input that was later renamed or deleted | Apply what still resolves, list what did not in the summary, never throw. The same rule BEN-001 §2 uses for unknown keys |
| Scenario values contain something unserialisable | Constrain to JSON-serialisable values at save time and reject with a message |
| Metadata write triggers a preview reload | Checked explicitly above — this is the first thing to verify, not the last |
