---
title: "Parent Component Object"
---
Parent Component Object: reads the enclosing parent component's instance-scoped object from inside a child component.

Parent Component Object opens the same per-instance store as the parent's Component Object, from within a child. Properties declared on the node become value outputs that update reactively as anything writes the parent's object; `changed` fires per write. This is how reusable child components (controls, toolbars, wizard steps) participate in their host's state without dedicated ports for every value.

## When to use it

Child components that are conceptually part of their parent and share its state — wizard controls, list toolbars. For unrelated components use Objects by id or events; for one-off values a Component Input is more explicit.

## At a glance

| | |
|---|---|
| Category | Component Utilities |
| Type name | `net.noodl.ParentComponentObject` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `properties` | Stringlist | — | Names of the parent values to expose, each becoming a matching input and output |
| `runOnChange-object` | Boolean | `true` | Whether a new value on Parent object re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `targetComponent` | Component | — | Which ancestor to read from; leave blank for the nearest one that has a Component Object |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Republishes every property from the parent now. This is additional to the outputs updating on their own; untick Parent object under Run On Value Change to stop that |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when a property on the resolved parent is written, unless Fetch is connected |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a Fetch you triggered has republished every property, after Fetched |
| `fetched` | Signal | — | Fires whenever every property is republished, whether by Fetch or by the parent being re-resolved |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Which ancestor was looked for and why it was not found |
| `failure` | Signal | — | Fires when no parent Component Object could be found, so there is nothing to read |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property ports mirror the parent component object's property schema.

## Ports at runtime

Property ports are generated from the per-instance `properties` list (runtime-discovered). Resolution walks up to the nearest ancestor component instance — the node is inert at the app root.

## Examples

**Wizard step state shared via Component Object**

Component Object is per-component-instance shared state: every node in the same component instance — and, via the Parent variants, in its child components — reads and writes the same object without wires between them. The wizard holds `step` in its Component Object; the embedded controls component advances it with Set Parent Component Object Properties and reads it with Parent Component Object. Two wizard instances on one page would each have their own independent `step`, which is exactly what plain shared Objects would not give you.

## Related nodes

[Component Object](./net-noodl-component-object.md), [Set Parent Component Object Properties](./net-noodl-set-parent-component-object-properties.md), [Component Inputs](./component-inputs.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
