# DEF-039 — a `connections.json` the editor cannot read is one it destroys

**Status: ✅ BUILT AND GATED — 2026-09-03, session 43.** Promoted from
[UNOWNED-ROWS-TO-MEASURE.md §7](UNOWNED-ROWS-TO-MEASURE.md), owner `NONE` since 2026-08-31, where
it carried three bullets marked *"measure before ranking the row"*. **All three are now measured,
and the third one flipped.**

## Who it bites, and in what words

> *"I opened the project my agent wrote, the editor drew it, and eight wires were gone from the
> file on disk. Nothing said anything."*

Anyone whose v2 project was written by something other than this editor — an agent, a generator, a
script, a hand-edit, a merge tool. The row was found by DEF-029's own drive (session 36) doing
exactly that.

## The three faults, and they are independent

1. the loader **accepts fields it does not understand** rather than refusing;
2. the failure surfaces as a bare `TypeError` deep in export, **naming neither the file, the
   component, nor the connection** — the preview simply never appears;
3. the malformed input is **normalised and persisted**, so the round trip destroys the file.

## The measurement

Three arms through the editor's **own** load and save code —
[`reconstructLegacyComponent`](../../../packages/noodl-editor/src/editor/src/io/ProjectImporter.ts)
(what `ComponentLoader` calls) and
[`buildComponentV2Files`](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts)
(what `ComponentSaver` calls) — bundled with esbuild, **no Electron, no editor**. Two wires per arm.

| arm | schema says | load throws | in memory after load | written back | round trip |
| --- | --- | --- | --- | --- | --- |
| **A** — the reported input (`sourceId`/`sourcePort`/…) | ❌ **8 errors**, the exact four fields × 2 | no | `[{},{}]` | `[{},{}]` | 🔴 **DESTROYED** |
| **B** — control, correct field names | ✅ valid | no | both wires intact | both wires intact | ✅ preserved |
| **C** — correct names, **id that resolves to no node** | ✅ valid | no | both wires intact | both wires intact | ✅ preserved |

✅ **The control is not inert.** Arm B round-trips byte-identically through the same two functions
in the same run, so arm A's `[{},{}]` is a fact about the input, not about the harness.

### Bullet 1 — does `validator.ts` run on load? **No. One call site in the entire editor.**

`SchemaValidator` / `validateSchema` / `SCHEMA_IDS` appear in exactly one non-schema module:
`models/AiAssistant/authoring/validate.ts` — the **AI-assistant authoring** path. The project load
path (`projectmodel.editor.ts:104` → `projectStructureService.loadProject` →
`ComponentLoader.load` → `reconstructLegacyComponent`) never touches it.

🔴 **So this is a missing call site, not a coverage hole** — and the schema that is already in the
tree already produces exactly the right eight messages for arm A
(`connections.schema.json` requires all four fields with `minLength: 1`). The check was written
and never wired to the door.

### Bullet 2 — is the empty-object write a normalisation, or a save of the model? **A save.**

The data is gone **at load**, before anything is written: `reconstructLegacyComponent` builds
`{fromId: undefined, fromProperty: undefined, toId: undefined, toProperty: undefined}`, which is
`{}` the moment it is stringified. The exporter then faithfully saves what the model holds.

⚠️ **The importer already shape-checks `route` on this exact argument** — its own comment says
*"this is the door a project written by something else comes through"* — and does not shape-check
the four fields that are required.

### Bullet 3 — does an unresolvable id take the same crash? **NO — it takes a different one, earlier, in a worse place.**

The row guessed this might be *"the same crash… reachable without hand-editing anything"*. Both
halves are wrong, and the second is wrong in the more serious direction.

**Not the same crash.** `getConnectionHealth`
([`NodeGraphModel.ts:723`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphModel.ts#L723))
reads `c.sourceId ? c.sourceId : c.sourceNode.id`. `exportComponent`
([`utils/exporter/util.ts:115`](../../../packages/noodl-editor/src/editor/src/utils/exporter/util.ts#L115))
hands it `sourceId: c.fromId`. Arm A leaves `fromId` **undefined** → falsy → `c.sourceNode.id` on
`undefined` → the reported `TypeError`. Arm C's `fromId` is the string `GONE-9999` → **truthy** →
no throw. Measured in the harness, both arms.

🔴 **But there is a second caller with the opposite shape, and it is the canvas.**
`NodeGraphEditorConnection.getHealth()`
([`:672`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L672))
passes `sourceNode`/`targetNode` and **no ids at all**, `undefined` when the node did not resolve.
So on the canvas the guard is inverted: it is arm **C** that lands on `c.sourceNode.id`.

🔴 **And it does not even get that far.** `createFromModel` (`:197`) sets
`con.fromNode = owner.findNodeWithId(model.fromId)` — `undefined` for arm C — then calls
`connect()`, whose first act is `resolvePorts()`: `this.fromNode.model.getPort(…)`. **TypeError on
`undefined`, one line into building the wire's view.** `ModelBindings.ts:89` builds the canvas in a
bare `for` loop with no filter and no try, so **the throw stops every later wire in the component
from being created at all**.

⚠️ **Source-derived, NOT driven.** The call path is exact and each hop was read, but a running
editor has not been observed taking it. **That drive is what this row owes before the canvas half
is called closed** — and an editor drive serves a BUILT bundle, so rebuild first. What is fully
measured is arm C's *load and save* behaviour (lossless) and the arithmetic of line 723 in both
caller shapes.

## What this does to the row's rank — it goes up, not down

The original row worried it was only reachable by hand-editing, since *"the product's own doors
would not produce these field names"*. That is still true of **arm A**. But arm C — a
well-formed `connections.json` naming a node that is not in the component — is produced by a bad
merge, a partial copy, or any generator that writes nodes and wires separately, and it reaches a
**worse** failure on the path every person uses: opening the component.

## The fix that is NOT available, and why it was checked before it was written

**"Refuse the component and warn"** — the shape the existing warnings channel invites, since
`ProjectImporter.import` already wraps each component in a try/catch and collects
`Failed to reconstruct component "X"`. 🔴 **It would delete the component from disk.** A component
absent from the in-memory project lands in `ComponentSaver`'s `changeSet.removed`
(`ComponentSaver.ts:196-201`), and `index.ts:198` → `removeComponent` →
**`removeDirRecursive(componentDir)`**. The rescue is worse than the defect: today the person
loses eight wires, under that fix they lose the whole component.

⚠️ Refusing to open the **project** is the other obvious shape, and it is 🧭 **a decision with a
person attached** — it turns "open, lose wires" into "cannot open at all" for a project with one
bad wire in two hundred components. Not taken here; see *Bounds*.

## What was built

1. **`getConnectionHealth` stops assuming an end exists.** Neither id nor node ⇒ an unhealthy
   verdict naming the missing end, not a `TypeError`. One guard, both caller shapes.
2. **`createFromModel` returns `null` when an end does not resolve**, and `ModelBindings` skips it,
   so one broken wire no longer stops the canvas building the rest.
3. **`reconstructLegacyComponent` shape-checks the four fields**, exactly as it already
   shape-checks `route`, keeps the original object **verbatim** so the round trip preserves it, and
   reports a warning naming the component, the connection index and the keys actually present.
4. **`buildComponentV2Files` writes such a connection back verbatim** — the other half of 3, since
   a round trip is only lossless if both ends agree.
5. **The load warnings reach the person.** `projectmodel.editor.ts:112` has them in hand and
   `console.warn`s them.

🔴 **1 and 2 are load-bearing for 3.** Preserving a malformed connection in memory is only safe
once nothing downstream dereferences an end it did not resolve — which is the same guard arm C
needs anyway.

## Bounds — stated so this is not over-read

- **The canvas half (bullet 3's second finding) is source-derived, not driven.** Owed: an editor
  drive on a component carrying a wire to a deleted node.
- **Arm A remains unreachable through the product's own doors.** Its population is projects
  written by something else.
- **Refusing to open a project that fails validation is not built and not ruled on.** 🧭 Richard's,
  if anyone wants it — the measurement above is what the decision would rest on.
- The harness measures `reconstructLegacyComponent` + `buildComponentV2Files`. It does **not**
  exercise `ComponentSaver`'s hashing or the debounce, so "written back" here means what the
  serializer produces, not a file observed on disk. The `{}`×8 on disk was observed in DEF-029's
  session-36 drive; this harness explains it.

## The gate — `tests-unit/def-039/connectionRoundTrip.test.ts`

Eight tests, in **`tests-unit/`** rather than the jasmine suite, because these modules are pure.
The three arms are the measurement's, and **arm B is in the gate, not just the write-up**: it
round-trips byte-identically in the same run, so a red arm A is a fact about the input.

🔴 **The guard was extracted to `connectionEnds.ts` so that it could be graded at all.**
`NodeGraphModel` reads `platform.getUserDataPath()` at module scope and cannot be imported outside
Electron — the first attempt to grade the real function died on exactly that line. A guard written
inside `NodeGraphModel` can only ever be checked by a copy of itself, which is not a gate.
**The extraction is part of the fix**, and the same constraint is why
`tests/io/component-description-roundtrip.test.ts` cannot run under jest.

### Mutants — three, each killed by its own arm

| mutant | what it reverts | killed by |
| --- | --- | --- |
| 1 | the importer stops preserving (back to picking four fields) | *arm A survives the round trip* |
| 2 | the **exporter** stops preserving, importer half kept | *arm A survives the round trip* |
| 3 | the end guard back to `c.sourceNode.id` | *arm A via the export shape* **and** *arm C via the canvas shape* |

Restored green afterwards, and the importer's md5 matched its pre-mutation snapshot.

⚠️ Mutant 2 exists because the round trip has **two** ends and either alone would have read as
fixed from one side.

## Gates run

| gate | result |
| --- | --- |
| `tests-unit/def-039` | **8 passed**, exit 0 |
| `jest --findRelatedTests` over all 7 changed files | **37 suites / 517 tests passed**, exit 0 |
| `tests/io/*` under jest (round-trip family) | **190 passed**; `roundtrip-fidelity`, `ProjectImporter`, `ProjectExporter` all green |
| full `npx jest` (tests-unit + tests-main) | 401/407 suites. **The 5 reds are outside this change's dependency graph** — `execution-history` ×2 (`node:sqlite` missing on this Node build), `sb-018` ×2, `aib-007/backendRequirement`. Confirmed by `--listTests --findRelatedTests`: none of the five imports anything changed here. |

✅ **`test:ci` RUN — 2938 specs, 4 failures, seed 60967, HEAD `da055635`.** All four are the known
`AIX-006 style vocabulary` floor, checked **by name**; no new red. So the canvas skip in
`NodeGraphEditorConnection` — renderer code jest cannot reach — is exercised by the suite and
breaks nothing.

⚠️ **The suite covers this change; it does not DRIVE it.** No spec deletes a node and reopens the
component, so the canvas half of bullet 3 is still owed the editor drive named above.

⚠️ `tests/io/component-description-roundtrip.test.ts` fails **to run** under jest —
`platform.getUserDataPath()` at module scope, not a verdict on this change. It belongs to `test:ci`.

## `test:ci` — RUN, and it is at the floor

**2938 specs, 4 failures, seed 60967, HEAD `da055635`** (2026-09-03 12:35). ✅ **All four are the
known `AIX-006 style vocabulary` floor, verified BY NAME and not by count** — no new red. Exit 1
is what the floor exits; the readout mtime is fresh, and `.webpack-cache` was cleared first.
