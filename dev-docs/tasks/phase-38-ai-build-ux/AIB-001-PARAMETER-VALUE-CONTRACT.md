# AIB-001 — The parameter-value contract

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🔴 Critical — alpha blocker |
| **Difficulty** | 🟠 Medium-hard (the fix is clear; the surface is 24 port types) |
| **Recommended executor** | 🟠 Opus — the repair is specified, but deciding the coercion-vs-reject policy per type is judgement |
| **Prerequisites** | none |
| **Status** | ✅ **COMPLETE 2026-08-03** — all four slices, all six criteria. Criterion 6 replayed against a real provider: a real model wrote `pathParams: "chatId"` and the plan applied clean. |

> ## ⚠️ Two wire formats in this task were wrong
> **`dimension` is not `"100px"` and a units-typed `number` is not a bare number.** Both are
> `{ value, unit }` objects — in all 3,589 occurrences across the 35 `project.json` in this repo, with
> `value` sometimes a string (`{"value":"8","unit":"px"}`) and sometimes a number. A `"16px"` string is
> not merely wrong, it is *dropped silently*: `defineRegularInputProp` reads `.value` off it, finds
> `undefined` and deletes the property.
>
> A validator written from the table below would have rejected 3,589 legitimate values and made every
> visual component in the corpus unrevisable. The shipped rules were derived from the corpus instead,
> and the corpus is pinned as a test (`tests-unit/aib-001/parameterValuesCorpus.test.ts`).
>
> Also corrected: there are **six** `.split(',')` sites, not five — `CloudFunctionAdapter` has two.
>
> **A third defect, found while deciding what the validator should ACCEPT.** The authoring prompt
> instructs the model to write `paddingTop: "var(--space-4)"` for on-system spacing. The runtime could
> not consume it: the `inputCss` path fitted the token with the port's default unit and emitted
> `var(--space-4)px` (invalid CSS, dropped by the browser); the prop path deleted the property. So
> every on-system spacing, radius and font-size value the AI produced for a units port did nothing at
> all — silently, in both instruments. Fixed in slice 3, and provably inert for existing projects: no
> units-typed parameter anywhere in the corpus is a `var(` string.

## Objective

Make it impossible for a validated AI candidate to carry a parameter value the editor cannot
consume — and make the failure, if one still gets through, name the parameter instead of throwing a
`TypeError` from inside an adapter.

## What happened

Richard's plan authored three pages. On apply:

```
The plan could not be applied: node.parameters.pathParams.split is not a function
Everything it had already changed was rolled back.
```

44 nodes, 9 wires, three components and four documents — all discarded.

## The mechanism, verified

Three things line up to produce it.

**1. The catalog tells the model the type name but not the wire format.**
[`node-catalog.json`](../../../packages/noodl-types/src/node-catalog.json) declares `PageInputs.pathParams`
as `type: { name: 'stringlist' }`.
[`ContextBuilder.portLine`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/ContextBuilder.ts#L49-L58)
renders that to the model as:

```
  - pathParams (stringlist): Names of the braced segments in this page's route, one output port each
```

A model reading "stringlist" emits a JSON array. That is the correct reading of the words it was
given. The actual wire format is a **comma-separated string** — a convention 24 files in this
codebase already encode by calling `.split(',')`, and which is written down nowhere the model can
see.

**2. Nothing validates it.**
[`nodes.schema.json`](../../../packages/noodl-editor/src/editor/src/schemas/nodes.schema.json#L74-L78)
declares:

```json
"parameters": { "type": "object", "description": "Node parameter values (property bag)", "additionalProperties": true }
```

A free property bag. The structural gate cannot reject it. And
[`validateCandidateComponent`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/validate.ts#L115)
runs the SUB-006 semantic validator, which checks node types and port connectivity — **never
parameter values**. The candidate passes both gates cleanly.

**3. An adapter then trusts it.**
[`PageInputsAdapter.updatePortsForNode`](../../../packages/noodl-editor/src/editor/src/models/NodeTypeAdapters/PageInputsAdapter.ts#L22-L26):

```ts
if (node.parameters['pathParams'] !== undefined) {
  node.parameters['pathParams'].split(',').forEach((p) => { uniqueNames[p] = true; });
}
```

Fired by `nodeAdded:PageInputs` during `addAuthoredComponentToGroup`, inside the apply transaction.
It throws, [`applyAuthoredPlan`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/planStaging.ts#L214-L226)
catches it, rolls the group back and rethrows as `StagingError`. The transaction behaved exactly as
designed. The design just had nothing to say about a bad value.

## Blast radius

`pathParams` is not special. It is the one that reached an adapter that calls `.split`. Counted
across the catalog — 24 distinct port types, of which these have wire formats a model will not
guess from the type name alone:

| Port type | Ports | What the model must write | Plausible model error |
|---|---:|---|---|
| `number` | 926 | a JSON number | `"100"` |
| `enum` | 249 | one declared option, exact | a synonym, or Title Case |
| `dimension` | 28 | `"100px"`, `"50%"` | `100` |
| `stringlist` | 25 | `"a,b,c"` | `["a","b","c"]` ← **this crash** |
| `proplist` | 7 | `[{label, value}]` | `{a: 1}` |
| `color` | 120 | token name or hex | `"blue"` |

Four other adapters do the same `.split` on the same class of parameter:
[`RouterAdapter.ts:162`](../../../packages/noodl-editor/src/editor/src/models/NodeTypeAdapters/RouterAdapter.ts#L162),
[`RouterNavigateAdapter.ts:78`](../../../packages/noodl-editor/src/editor/src/models/NodeTypeAdapters/RouterNavigateAdapter.ts#L78),
[`pages.ts:104`](../../../packages/noodl-editor/src/editor/src/utils/compilation/context/pages.ts#L104),
and `PageInputsAdapter` twice (`pathParams` and `queryParams`).

Note the compounding: `PageInputsAdapter.nodeAdded` **copies** the bad value to sibling nodes
(lines 55-56) before `updatePortsForNode` throws.

## Scope

### Slice 1 — a parameter-value validator (the gate)

New module beside `validate.ts`. Given a candidate's `nodes.json` and the catalog, check every
`parameters` entry against the declared port type and emit a `Diagnostic` per violation, in the
existing diagnostic shape so it flows through the repair loop unchanged.

Per-type rules derived from the catalog's `type` field. Start with the six in the table above plus
`boolean`, `string`, `signal`; unknown port types and `*` pass. A parameter naming a port that does
not exist on the node type is a **warning**, not an error — dynamic-port nodes legitimately carry
parameters for ports that only exist at runtime (see the `dynamicPorts` block on `PageInputs`
itself, and the SUB-006 precedent of skipping port checks on dynamic nodes).

Wire it into `validateCandidateComponent` after the structural check and before the semantic pass.
Because it produces ordinary diagnostics, the agent's existing repair round picks it up for free —
the model gets *"pathParams expects a comma-separated string, got an array"* and fixes it inside
the session, at no cost to the user.

**Decide and record:** coerce or reject? Recommendation — **reject in the gate, coerce nowhere**.
A gate that silently repairs teaches the model nothing and hides the defect from the next port type.
The exception is slice 3, which is a crash guard, not a repair.

### Slice 2 — tell the model the wire format

`portLine` should render the format, not just the type name:

```
  - pathParams (stringlist — comma-separated string, e.g. "id,slug"): Names of the braced segments…
  - width (dimension — string with units, e.g. "100px")
  - alignX (enum — one of: left, center, right)
```

`enum` options are already in the catalog and are the highest-value addition here: 249 ports where
the model is currently guessing at legal values.

Cheap, and it moves failures out of the repair loop entirely.

### Slice 3 — adapters stop trusting their parameters

The five `.split` sites above, plus a sweep for the same pattern. A defensive read that accepts
string-or-array and normalises, and warns through the existing `sendWarning` channel when it had to.
This is not the fix — slices 1 and 2 are — but a `TypeError` thrown from a model listener during a
transaction is a crash class this codebase should not have at all, and the same three lines
protect against hand-edited `project.json`, imports, and MCP writes.

### Slice 4 — an apply failure is recoverable

Today `applyPlan`'s catch sets a red note and stops. The plan object survives in state but there is
no path forward from it. Add:

- the failing **operation** named in the message, not just the error text (the transaction knows
  which op it was mutating);
- **Retry this operation** — re-run just that operation's `AuthoringSession` with the failure text
  as repair context, restage, leave the rest untouched;
- the parameter and node id in the message when the diagnostic came from slice 1.

This is what turns AIB-001 from "the crash is fixed" into "the class is survivable."

## What was built

| Slice | Where | Note |
|---|---|---|
| 1 — the gate | `validation/parameterValues.ts`, wired into `authoring/validate.ts` | Diagnostics join the semantic report, so they flow through the repair loop, the update baseline exemption and the summary unchanged. Baselined on update, or a component carrying legacy `sizeMode: "childSize"` would be permanently unrevisable. |
| 2 — tell the model | `ContextBuilder.portLine` + `WIRE_FORMAT_LEGEND` | Same table as the gate, so the two cannot drift. Per-port hints carry only what *varies* (a port's units, an enum's options); the rules true of a whole type are stated once per handout — the first draft cost ~3KB per node type against a 120,000-char budget. |
| 3 — adapters | `NodeTypeAdapters/nameListParameter.ts` (+`.warnings.ts`), 6 call sites, `react-component-node.ts` | The rule is pure so it is testable without an editor; the `WarningsModel` wiring is the separate module the adapters import. |
| 4 — recovery | `StagingError.operation`, `PlanRun.retryOperation`, `ProjectAuthoringView` | The transaction stays all-or-nothing. A failed retry restores the previous candidate. |

**Deliberately not done: this is not a `SemanticValidator` rule.** It could be — and then `validate:project`,
the MCP write-gate and the Problems panel would all get it — but the normalized model does not carry
parameters, and turning a new error class loose on every existing project is a separate decision from
fixing the crash. The module is pure and catalog-only, so promoting it later is one import.

## Acceptance criteria

1. A candidate whose `pathParams` is `["id","slug"]` is rejected by the gate with a diagnostic
   naming the node, the port and the expected format — **before** anything reaches a model.
2. The repair loop fixes that candidate without user involvement, in a test that drives a scripted
   provider returning the array on the first attempt and the string on the second.
3. Each of the six port types in the table has a test asserting both a legal and an illegal value.
4. All five `.split` sites survive an array-valued parameter without throwing, and say so in the
   warnings channel.
5. An apply failure names the operation and offers a retry that re-authors only that operation.
6. **Live**: Richard's session replayed — a three-page plan with a `PageInputs` node applies clean.

### Where each landed

1. ✅ `tests-unit/aib-001/parameterValues.test.ts` — "rejects the exact candidate that was thrown away".
2. ✅ `tests/ai/authoring-parameter-values.test.ts` — the scripted provider returns the array, then the
   string, and the second submission stages. Its sibling spec asserts the other half: a model that reads
   `get_node_types` is told the format and needs no repair round at all.
3. ✅ Same file — one legal and one illegal value for each of `stringlist`, `proplist`, `enum`,
   units-`number`, `dimension`, `color` and `boolean`.
4. ✅ `tests-unit/aib-001/nameListParameter.test.ts` over the pure rule; the six call sites are one line
   each.
5. ✅ `tests/ai/authoring-plan.test.ts`, "AIB-001 — retrying one operation of a plan".
6. ✅ **Live, 2026-08-03**, against the user's own configured provider (`claude-sonnet-5`), via
   `scripts/aib38-live/live-plan-pageinputs.js`. Nothing stubbed, $0.46 spent.

   Asked for Richard's app in a user's words — *"a Chat page that reads a chat id from the URL"*,
   never naming `PageInputs` or `pathParams`, because naming the node is telling the model the
   answer. It planned four operations (three pages plus an `/App` update it decided it needed),
   authored all four through the gate, and **applied clean**. `/Pages/Chat` came out of
   `ProjectModel` holding `pathParams: "chatId"` — a `String` — with the `pm-chatId` output port
   live on the node.

   That is the whole of what the phase opened on: a real model, a real path parameter, and no
   `.split is not a function`.

   Two notes worth carrying:

   - **The apply that closed this criterion went through AIB-003 slice 4's recovery path.** Editing
     a source file mid-run hot-swapped `PlanSessionStore` and emptied it with all four operations
     staged; the candidates were on disk, and reopening the project brought them back and applied
     them. Stronger evidence than the run that was planned.
   - **The driver reported an empty project against a project with three of the nodes**, twice, for
     two different reasons: `forEachNode` walks the roots only, and in the live model `node.type` is
     the resolved type *object* — a string only in `project.json`, which is where the name was read
     from. Neither is a defect in the app, and both would have been reported as one.

## Traps

- **The catalog is the source of truth, and it has two files.** `node-catalog.json` and
  `node-catalog-enriched.json`. Check which one `CatalogIndex.portTypeName` actually reads before
  writing rules against the other.
- **`allowEditOnly: true`** appears on both `stringlist` ports. Whatever it means for the editor UI,
  it does not exempt the value from having a format.
- Per the phase-30 memory: **a declared `default` never runs its setter**, so a parameter absent
  from `parameters` is not equivalent to one set to its default. The validator must not "helpfully"
  fill defaults.
- The editor test suite is Jasmine, not Jest, and lies three ways — only the `Jasmine:` line counts.
