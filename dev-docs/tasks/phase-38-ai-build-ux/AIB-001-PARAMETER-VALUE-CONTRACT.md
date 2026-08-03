# AIB-001 — The parameter-value contract

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🔴 Critical — alpha blocker |
| **Difficulty** | 🟠 Medium-hard (the fix is clear; the surface is 24 port types) |
| **Recommended executor** | 🟠 Opus — the repair is specified, but deciding the coercion-vs-reject policy per type is judgement |
| **Prerequisites** | none |

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
