---
title: "Component Inputs"
---
Declares the component's own input ports; what the parent wires into an instance arrives on this node's outputs.

Component Inputs defines the receiving half of a component's port surface. Every port added on this node becomes an input of the component itself: a parent graph wires values or signals into the component instance, and they emerge inside the component as this node's outputs. Inside a Repeater item component the same mechanism delivers item data — each property of the item object feeds the identically-named Component Input.

## When to use it

Whenever a component needs data or triggers from its parent: item templates, reusable controls, page components. Use events (Send/Receive Event) only when sender and receiver are unrelated; parent→child always goes through Component Inputs.

## At a glance

| | |
|---|---|
| Category | Component Utilities |
| Type name | `Component Inputs` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Dynamic ports

_This node's port list changes at runtime (component-ports, runtime-discovered); the tables above may be incomplete for a given instance._

Output ports mirror the port names listed in this node's "ports" parameter; each becomes an input of the containing component and an output of this node.

## Ports at runtime

All ports are author-declared on the node instance (component-ports mechanism): the catalog lists none because each component defines its own. The instance's ports also define the component's external inputs — tools should read them from the node instance's `ports`, never from the catalog.

## Patterns

- Repeater item: declare inputs named after the item object's properties and bind them straight to visuals.
- Signal inputs ('Show', 'Reset') let a parent drive behaviour without exposing internals.

## Watch out for

- Reaching for global Variables to pass parent data into a child; that hides the dependency the port surface would document.

## Examples

**List page: Repeater fed by Query Records**

The canonical data-list shape. Query Records (DbCollection2) fetches a database class and exposes the result on its `items` array output; the Repeater (For Each) consumes that array and instantiates its `template` component once per record. Each record's properties are delivered to the item component through Component Inputs whose names match the record's property names — the item component reads them like any other input. The Repeater and its item template component are separate components by design.

**Run Tasks: batch-process an array with a worker component**

Run Tasks executes its `taskTemplate` component once per element of `items`, up to `maxRunningTasks` at a time, and fires `completed` when the whole batch has finished, whatever the outcome — `done` is the narrower signal that the run finished having done its work. The worker is a plain component: it receives the item's properties through Component Inputs and reports completion through Component Outputs signals (success/failure), which Run Tasks consumes to schedule the next task. Here a fresh array is assembled with New Array and processed on click.

**Add and remove a relation between records; delete a record**

Relations link records without embedding them: Add Record Relation points `modelId` (the owner) at `targetId` (the related record) on a named relation field, Remove Record Relation severs the same pair, and Delete Record removes a record entirely. All three act on ids delivered by wires — here from the enclosing component's inputs — and fire `done` on success or `failure` with `error`, with `completed` after either.

## Related nodes

[Component Outputs](./component-outputs.md), [Repeater](../visual/for-each.md), [Component Object](./net-noodl-component-object.md), [Receive Event](../events/event-receiver.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
