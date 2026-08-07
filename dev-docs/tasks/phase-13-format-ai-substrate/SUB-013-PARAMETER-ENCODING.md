# SUB-013: The catalog must decode `parameters`, not just describe it

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-013 |
| **Phase** | Phase 13 — Format & AI Substrate (follow-on; not part of the eight-task spine) |
| **Priority** | 🔴 Critical for authoring — an AI cannot author 89 of 155 node types' parameters today |
| **Difficulty** | 🟠 Medium — the extraction is mechanical, the coverage decision is not |
| **Estimated Time** | 1.5–2 weeks |
| **Prerequisites** | SUB-004 (catalog), SUB-005 (enrichment). Both complete |
| **Found by** | Rise salvage assessment, 2026-07-30 ([docs/research/rise-assessment.md](../../../docs/research/rise-assessment.md)) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for §1 and §2 (the observation harness is the catalog generator's own idiom), 🟢 **Sonnet 5** for §4 |

## Objective

Make a node's `parameters` object authorable by a model that has read the catalog and nothing else.

## The gap

[`docs/node-catalog/SCHEMA.md`](../../../docs/node-catalog/SCHEMA.md) opens by promising:

> This document is written for a reader — human or AI — with **no other context**. If you are authoring
> or validating project files, this file plus the catalog and the v2 project schemas are intended to be
> sufficient.

For static ports it delivers. For dynamic ports it does not, and dynamic ports are the majority case.

Take `States`, from a real shipped file — [`library/prefabs/toggle-switch/project/project.json`](../../../library/prefabs/toggle-switch/project/project.json):

```json
"parameters": {
  "states": "true,false",
  "values": "pos",
  "type-pos": "number",
  "value-true-pos": 100,
  "value-false-pos": 0,
  "value-true-bg color": "Primary",
  "type-bg color": "color",
  "transitiondef-on": { "curve": [0, 0, 0.58, 1], "dur": 200, "delay": 0 }
}
```

Four distinct key formulas — `type-<value>`, `value-<state>-<value>`, `transitiondef-<state>`, plus the
plain `states`/`values` seeds. What the catalog says about all of it
(`node-catalog.json`, `States.dynamicPorts.description`):

> "Ports are generated from the `states` and `values` parameters: each value gets per-state value inputs
> and a current-value output, each state gets an activation signal input and reached/left signal outputs."

That is a true sentence and a useless one. It tells a model that ports exist without telling it what they
are called. No amount of care lets an author derive `value-true-bg color` from that prose — note in
particular that the value name is interpolated raw, **spaces and all**, which nobody would guess.

### Size of it

Measured against the committed `packages/noodl-types/src/node-catalog.json`:

| Measure | Count |
|---|---|
| Node types in catalog | 155 |
| With a `dynamicPorts` block | **89** |
| Whose description carries *any* formula-ish notation (backticks, `<x>`, `{x}`) | **9** |
| `mechanisms: runtime-discovered` | 61 |
| `mechanisms: declared-port-groups` | 31 |

So ~80 dynamic-port node types currently give an authoring model prose and nothing else. Several
descriptions are pure boilerplate — `Component State` reads "Some ports are discovered at runtime from
user code, parameters or connected components…", which is a restatement of the field name.

The 9 that *do* carry notation (`String Format`, `Signal To Index`, `Color Blend`, `And`, `Or`, …) prove
the format is workable — they were simply written by hand, one at a time, and stopped.

### Why the validator does not cover for this

SUB-006 deliberately emits `DynamicPortSkipped` (info) rather than checking these ports —
[`diagnostics.ts:57`](../../../packages/noodl-editor/src/editor/src/validation/diagnostics.ts#L57) —
and that decision is correct: the catalog cannot enumerate the ports, so erroring would cry wolf. But the
consequence is that a misspelled `value-true-pos` is **neither prevented at authoring time nor caught at
validation time**. It reaches the runtime, where it silently does nothing. This is the widest hole in the
"the graph is a legible, checkable artifact" premise that phase 13 rests on.

## Why this is worth doing now, and for whom

The immediate trigger is Richard's constraint: **people should be able to drive this with a local
open-weight model.** That reframes the whole problem. A frontier model given three example projects in
context may well induce `value-<state>-<value>` from the pattern. A 7B model will not — it will produce
plausible-looking keys such as `pos-true` or `values.pos.true` that fail silently. Ambient
pattern-induction is precisely the capability that shrinks first when the model does.

Documented encodings are the leveller: they convert an inference problem into a lookup. This is the one
genuine schema lesson from the Rise assessment, adapted. Rise's manifest wrapped every property as
`{ type: 'static', value: 'Click me', dataType: 'string' }` — self-describing, at the cost of verbosity
and of only ever describing a static component tree. **We are not adopting that shape.** Noodl's flat
`parameters` bag is more compact and, given the fresh-start decision, could in principle be changed — but
changing it would break every shipped project, prefab and module for a benefit the catalog can deliver
without touching a single file. Keep the terse format; ship the decoder ring beside it.

## §1 — Extract encodings by observation, not by parsing

The catalog's founding principle (SCHEMA.md, and SUB-004) is that it is generated by loading the real
registries headlessly, **never** by parsing node source files, so it cannot drift. Hold that line here.

The formulas are not hidden — they are constructed literally in the port-generation functions. In
[`states.ts`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts) the names are built at
[`:716`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L716) (`'type-' + p`),
[`:730`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L730)
(`'value-' + state + '-' + value`) and
[`:744`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L744)
(`'transitiondef-' + state`), and the file's own TSDoc already states two of the three at
[`:19`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L19) and
[`:38-40`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L38-L40).

So the proposed mechanism is: **drive the node's dynamic-port function with seed parameters and record the
port names it emits.** For `States`, feed `{states: "S1,S2", values: "V1"}` and observe
`type-V1`, `value-S1-V1`, `value-S2-V1`, `transitiondef-S1`, `transitiondef-S2`. Two seeds with different
arities are enough to distinguish "constant name" from "interpolates the state" from "interpolates
both" — the formula falls out of the diff. This stays true to generation-by-observation and inherits the
existing CI staleness gate for free.

Work out early how far this generalises. `declared-port-groups` (31 nodes) should be near-mechanical.
`runtime-discovered` (61) will not all cooperate — some need a live component, a connected node, or user
code before they emit anything. **Expect a residue that cannot be observed, and plan for §3 rather than
forcing it.**

## §2 — The catalog field

Add a `parameterEncoding` block to node entries that have one. Strawman, to be settled in review:

```jsonc
"parameterEncoding": {
  "patterns": [
    {
      "pattern": "value-<state>-<value>",
      "describes": "The value of <value> while <state> is active",
      "variables": {
        "state": "one of the comma-separated entries in the `states` parameter",
        "value": "one of the comma-separated entries in the `values` parameter"
      },
      "valueType": "follows the matching `type-<value>` parameter; number when absent",
      "example": "value-true-bg color"
    }
  ],
  "seededBy": ["states", "values"],
  "notes": "Value and state names are interpolated verbatim, including spaces."
}
```

Three properties matter more than the exact shape:

1. **`seededBy` is explicit.** The single most useful fact is that these keys are not free-form — they are
   derived from *other named parameters* the author also controls. A model that knows to write `values`
   first and derive from it will get the rest right.
2. **Every pattern carries a real `example`**, lifted from an observed emission, not hand-written. The
   `bg color` case earns its place by being the one that breaks naive guessing.
3. **`valueType` may reference another parameter**, because for `States` it genuinely does.

Update [`docs/node-catalog/SCHEMA.md`](../../../docs/node-catalog/SCHEMA.md) in the same change — it is the
document that made the no-other-context promise, and it currently has no section on parameter keys at all.
Extend `node-catalog.d.ts` and bump `catalogFormatVersion` (minor: additive).

## §3 — Be honest about the residue

Some nodes will resist observation — `Component State`, `For Each` (needs a template component), `Function`
and `Expression` (ports follow user code). For these, **do not** emit a fabricated pattern. Emit the
existing prose description and mark the entry so consumers can tell "no encoding known" apart from "no
encoding needed":

```jsonc
"parameterEncoding": { "known": false, "reason": "Ports follow the user code in the `functionScript` parameter." }
```

This mirrors SUB-006's `DynamicPortSkipped` reasoning — surfacing that a check was deliberately not
performed beats silent absence. It also gives §4 an honest denominator.

## §4 — Prove it with the audience that needs it

The success criterion is behavioural, and it must be tested against a small local model, because that is
the constraint that motivated the task.

Build a fixture set of ~12 authoring prompts over dynamic-port nodes (`States` is the hardest; include
`String Format`, `Component Inputs`, `For Each`, `Set Variable`). For each, ask a model to emit the node's
`parameters` **given only the catalog entry**, then check the emitted keys against the ports the runtime
actually generates.

Run it three ways: a frontier model with encodings, a small local model without them, and a small local
model with them. The result to look for is the third condition approaching the first. If small-with-
encodings does not clearly beat small-without, the field is not carrying its weight and the design in §2
is wrong — say so and stop, rather than shipping a schema addition nobody reads.

**Note the harness cost honestly:** per
[LIVE-PROVIDER-PASS.md](../phase-15-ai-collaboration/LIVE-PROVIDER-PASS.md), the Anthropic key is out of
credit, and no local-model runner exists in this repo. Budget for standing one up, or descope §4 to the
mechanical check alone (do the documented patterns reproduce the observed port names?) and record
explicitly that the behavioural claim is untested rather than letting it read as proven.

## Success criteria

1. Every catalog entry with `dynamicPorts` also has `parameterEncoding`, either with patterns or with an
   explicit `known: false` and a reason. No silent gaps.
2. For every documented pattern, the pattern reproduces the port names the runtime emits for at least two
   distinct seed parameterisations. This is a CI check, not a review judgment.
3. `SCHEMA.md` has a parameter-keys section, and a reader following it alone can author a valid `States`
   node — including `value-true-bg color`.
4. The §4 comparison is run and its result recorded, **including if the result is negative**.
5. `catalogFormatVersion` bumped; `catalog:check` still gates staleness.

## Out of scope

- **Changing the project format.** Explicitly rejected above.
- **Making SUB-006 validate dynamic ports.** Tempting once encodings exist, and probably the right
  follow-on, but it changes `DynamicPortSkipped` from info to a real check and deserves its own task with
  its own cry-wolf analysis.
- **Enrichment prose.** SUB-005 owns semantic descriptions; this task owns key syntax only.
