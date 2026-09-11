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

**One size port, three sizes: a variant selector wired into States**

The component a page places three times at three sizes, without three components. `size` is a `Component Inputs` port wired straight into `States.currentState` — 🔴 that port is TWO ports sharing one name: a static string **output** that reports the current state, and, once `states` is set, a generated **enum input** that selects one by name. The input is the wire that makes a variant port work, and a chain of `Condition` nodes each setting one property is the same idea written badly. The `values` parameter (`padX,padY,labelSize`) mints one input per state per value (`value-small-padX`) and one output per value, so each state assigns the whole set at once and the graph carries no branch. `showDot` is the other half of a real interface: chrome chosen at the instance, not by making a second component. And the badge publishes `clicked`, so the page can act on a press — a component that only draws is a component the page has to work around.

**The controlled value: the same name goes in, comes out, and says when it moved**

The most common shape on the shelf, and the one an authored component usually forgets. `value` arrives on `Component Inputs`, the same name leaves on `Component Outputs`, and a `valueChanged` signal leaves beside it — a parent that can only set a value and never read it back has to keep its own copy and hope. `Counter` holds the number: `startValue` seeds it from the instance, `increase`/`decrease` are signals from the two buttons, and `limitsEnabled` with `limitsMin`/`limitsMax` means the clamp lives in one node instead of in two Function nodes that will disagree. 🔴 The `disabled` flag is wired through an `Inverter` into BOTH buttons' `enabled`, not just onto the label's colour: a flag that changes how a component looks but not what it accepts is a component that can be told one thing and do another. ⚠️ `logic-quantity-stepper` builds the same buttons around the same `Counter` and is about the value-shaping nodes between the count and the screen — `String Format`, `String Mapper`, `Number Remapper`; it has no interface at all, and the two are worth reading together. The page here shows the other half of the contract — it reads `value` back into a readout and acts on `valueChanged` — which is what makes this different from a component that merely renders a number.

**A slot component that is still a component: Component Children plus a real interface**

`Component Children` marks where the consumer's own children land, which is what lets one panel hold a form on one page and a table on the next — the alternative is a panel per kind of content, and nobody writes the third one. But a slot is not a substitute for an interface, and that is the mistake this example exists to correct: the panel still takes `title` and `mounted`, still lets the instance decide whether the close button exists (`showClose`), and still publishes `closed` so the page can act on the request rather than guess. Note what `closed` is: the panel does NOT hide itself when the button is pressed — it says the user asked, and the page decides, which is the same contract a controlled value has. A component that unmounts itself is a component whose parent can be surprised. The page places the same panel twice with different children inside it and different chrome, and the two instances share every line of the panel's graph.

**The placement contract: a component that says how it sits in its parent**

Almost every component in the shipped prefab library exposes the same block — `alignX`, `alignY`, the four margins, `position`, a size and `mounted` — and an authored component almost never does. The consequence is visible in any page built without it: every instance sits inside a single-child `Group` that exists for nothing but pushing it around, and the page keeps that wrapper forever. Here the avatar's own `Component Inputs` carry the box, wired into the root Group's matching inputs, so the page below places the same component at two sizes, in two alignments, with two margins, and holds **no wrapper Groups at all**. ⚠️ The honest limit: ports nobody sets are cost, and this is a component used everywhere earning them — a leaf used once does not earn a long interface by imitation. Expose what a parent would otherwise have to work around, and stop. `clicked` is on the interface for the same reason: a photograph the page cannot respond to is a decoration.

## Related nodes

[Component Inputs](./component-inputs.md), [Send Event](../events/event-sender.md), [Repeater](../visual/for-each.md), [Run Tasks](../data/run-tasks.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
