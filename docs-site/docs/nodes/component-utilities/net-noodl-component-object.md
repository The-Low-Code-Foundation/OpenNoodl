---
title: "Component Object"
---
Component Object: per-component-instance shared state — every node in the same instance reads and writes the same object, no wires needed.

Component Object exposes an object that belongs to the component *instance* it sits in: each instance of the component gets its own backing object, created on first use, and all Component Object nodes inside that instance — plus Parent Component Object nodes in child components — see the same data. Property names are declared in the `properties` parameter; each becomes a connection-only port that is both readable and writable, together with a per-property changed signal. Outputs are push-style: whenever the object changes (from this node, another Component Object node, a Set Component Object Properties node, or a child's Parent Component Object), the value outputs update and the changed signals fire. `fetch` is additive — it republishes every property now, then fires `fetched` and `done` — and untick Object properties under Run On Value Change to stop the push half.

## When to use it

Use it for state shared across nodes within one component — form drafts, wizard step, selection — especially state a child component must also see via Parent Component Object. It is per-instance by design: two instances of the component never share data. For app-global state use a Variable (Variable2) or Object (Model2); for a fixed set of visual modes prefer States.

## At a glance

| | |
|---|---|
| Category | Component Utilities |
| Type name | `net.noodl.ComponentObject` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `properties` | Stringlist | — | Names of the values this component keeps, each becoming a matching input and output |
| `runOnChange-object` | Boolean | `true` | Whether a new value on Object properties re-runs this node. On by default; untick to make this input passive so only the control signal runs it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Republishes every property now. This is additional to the outputs updating on their own; untick Object properties under Run On Value Change to stop that |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when any property is written, unless Object properties is unticked under Run On Value Change |
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once Fetch has republished every property, after Fetched |
| `fetched` | Signal | — | Fires once Fetch has republished every property |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property ports are created from the "properties" parameter (the schema of the component object).

## Ports at runtime

Ports are runtime-discovered from the `properties` parameter: each declared name p produces `value-<p>` — a connection-only, any-type port usable both as input (writing stores the value into the instance's object) and as output (reading the current value) — and a `changed-<p>` signal output that fires when that property changes. The ports do not exist until `properties` is set; an authoring tool must write the `properties` stringlist and may then connect `value-<p>`/`changed-<p>` by those exact names.

## Patterns

- Component Object in the parent + Parent Component Object in children: parent↔child shared state without threading Component Inputs/Outputs through every level.
- Inside a Repeater item component: per-row UI state (expanded, editing) — each item instance automatically gets its own object.

## Watch out for

- Using it as global app state — every instance has a separate object, so two sibling components' Component Objects never see each other. Use Variables or Objects instead.
- Writing a property and expecting the paired output on the same node to be a different value — input and output are two faces of the same stored property.

## Examples

**Wizard step state shared via Component Object**

Component Object is per-component-instance shared state: every node in the same component instance — and, via the Parent variants, in its child components — reads and writes the same object without wires between them. The wizard holds `step` in its Component Object; the embedded controls component advances it with Set Parent Component Object Properties and reads it with Parent Component Object. Two wizard instances on one page would each have their own independent `step`, which is exactly what plain shared Objects would not give you.

## Related nodes

[Parent Component Object](./net-noodl-parent-component-object.md), [Set Component Object Properties](./net-noodl-set-component-object-properties.md), [Component Inputs](./component-inputs.md), [Object](../data/model2.md), [Variable](../data/variable2.md), [States](../animation/states.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
