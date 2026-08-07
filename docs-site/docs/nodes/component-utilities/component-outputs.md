---
title: "Component Outputs"
---
Declares the component's own output ports; what the graph wires into this node is exposed on the component's instances.

Component Outputs is the sending half of a component's port surface: every port added here becomes an output of the component itself, readable (values) or receivable (signals) wherever an instance of the component is placed. A Repeater additionally surfaces item components' output signals as ports on itself, so list events bubble up without extra plumbing.

## When to use it

Expose results and events to the parent: a form component's 'Submitted' signal, a card's 'Selected' with the wired value, a wizard's completion. If several unrelated components must react, send an event instead.

## At a glance

| | |
|---|---|
| Category | Component Utilities |
| Type name | `Component Outputs` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Dynamic ports

_This node's port list changes at runtime (component-ports, runtime-discovered); the tables above may be incomplete for a given instance._

Input ports mirror the port names listed in this node's "ports" parameter; each becomes an output of the containing component and an input of this node.

## Ports at runtime

All ports are author-declared on the node instance (component-ports mechanism); the catalog lists none. The instance's ports define the component's external outputs — read them from the node instance, never the catalog.

## Patterns

- Worker/task components report 'success'/'failure' signals through Component Outputs; Run Tasks consumes exactly that surface.

## Examples

**Run Tasks: batch-process an array with a worker component**

Run Tasks executes its `taskTemplate` component once per element of `items`, up to `maxRunningTasks` at a time, and fires `completed` when the whole batch has finished, whatever the outcome — `done` is the narrower signal that the run finished having done its work. The worker is a plain component: it receives the item's properties through Component Inputs and reports completion through Component Outputs signals (success/failure), which Run Tasks consumes to schedule the next task. Here a fresh array is assembled with New Array and processed on click.

## Related nodes

[Component Inputs](./component-inputs.md), [Send Event](../events/event-sender.md), [Repeater](../visual/for-each.md), [Run Tasks](../data/run-tasks.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
