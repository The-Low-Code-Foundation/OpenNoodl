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

**Card grid: Query Records into a Repeater, in a Columns node that reflows on its own**

The canonical data grid, and the layout decision most often got wrong. Use a Columns node with sizing "autoFit" and a minWidth of 260-320px: it fits as many columns as the CONTAINER holds and reflows by itself, with no breakpoints to maintain. Columns handles a Repeater child correctly — the Repeater draws nothing and adds its items as siblings, so Columns skips it and gives each real item a column box. The card component is width 100% and lets the column size it, which is what makes the SAME card work in this grid, in a 2-up related row, and in a sidebar. Do NOT reach for a Group with flexWrap: a wrapped flex row does not shrink its children, so each item needs a hardcoded percentage track, and — the part that matters — no Group anywhere in the runtime has a breakpoint, so that layout can never collapse on a narrow screen. Record fields reach the item through Component Inputs whose names match the record properties, and wiring a field straight into a Group's visible port is conditional rendering with no logic node.

**One size port, three sizes: a variant selector wired into States**

The component a page places three times at three sizes, without three components. `size` is a `Component Inputs` port wired straight into `States.currentState` — 🔴 that port is TWO ports sharing one name: a static string **output** that reports the current state, and, once `states` is set, a generated **enum input** that selects one by name. The input is the wire that makes a variant port work, and a chain of `Condition` nodes each setting one property is the same idea written badly. The `values` parameter (`padX,padY,labelSize`) mints one input per state per value (`value-small-padX`) and one output per value, so each state assigns the whole set at once and the graph carries no branch. `showDot` is the other half of a real interface: chrome chosen at the instance, not by making a second component. And the badge publishes `clicked`, so the page can act on a press — a component that only draws is a component the page has to work around.

**The controlled value: the same name goes in, comes out, and says when it moved**

The most common shape on the shelf, and the one an authored component usually forgets. `value` arrives on `Component Inputs`, the same name leaves on `Component Outputs`, and a `valueChanged` signal leaves beside it — a parent that can only set a value and never read it back has to keep its own copy and hope. `Counter` holds the number: `startValue` seeds it from the instance, `increase`/`decrease` are signals from the two buttons, and `limitsEnabled` with `limitsMin`/`limitsMax` means the clamp lives in one node instead of in two Function nodes that will disagree. 🔴 The `disabled` flag is wired through an `Inverter` into BOTH buttons' `enabled`, not just onto the label's colour: a flag that changes how a component looks but not what it accepts is a component that can be told one thing and do another. ⚠️ `logic-quantity-stepper` builds the same buttons around the same `Counter` and is about the value-shaping nodes between the count and the screen — `String Format`, `String Mapper`, `Number Remapper`; it has no interface at all, and the two are worth reading together. The page here shows the other half of the contract — it reads `value` back into a readout and acts on `valueChanged` — which is what makes this different from a component that merely renders a number.

**A slot component that is still a component: Component Children plus a real interface**

`Component Children` marks where the consumer's own children land, which is what lets one panel hold a form on one page and a table on the next — the alternative is a panel per kind of content, and nobody writes the third one. But a slot is not a substitute for an interface, and that is the mistake this example exists to correct: the panel still takes `title` and `mounted`, still lets the instance decide whether the close button exists (`showClose`), and still publishes `closed` so the page can act on the request rather than guess. Note what `closed` is: the panel does NOT hide itself when the button is pressed — it says the user asked, and the page decides, which is the same contract a controlled value has. A component that unmounts itself is a component whose parent can be surprised. The page places the same panel twice with different children inside it and different chrome, and the two instances share every line of the panel's graph.

**The placement contract: a component that says how it sits in its parent**

Almost every component in the shipped prefab library exposes the same block — `alignX`, `alignY`, the four margins, `position`, a size and `mounted` — and an authored component almost never does. The consequence is visible in any page built without it: every instance sits inside a single-child `Group` that exists for nothing but pushing it around, and the page keeps that wrapper forever. Here the avatar's own `Component Inputs` carry the box, wired into the root Group's matching inputs, so the page below places the same component at two sizes, in two alignments, with two margins, and holds **no wrapper Groups at all**. ⚠️ The honest limit: ports nobody sets are cost, and this is a component used everywhere earning them — a leaf used once does not earn a long interface by imitation. Expose what a parent would otherwise have to work around, and stop. `clicked` is on the interface for the same reason: a photograph the page cannot respond to is a decoration.

**One button component that drives any editor command**

A toolbar has a dozen buttons that differ only in a label, an icon and the name of the command they run — so this makes them one component with those three as inputs. A `States` node turns the button's type into its label, a `JavaScriptFunction` calls the matching command on the editor instance, and `Component Outputs` reports back whether the mark is currently active so the button can render as pressed. The lesson is not about Tiptap: it is that 'twelve buttons' and 'one button placed twelve times' are the same screen, and only one of them is editable later. 🔴 A component parameter arrives ONLY through a `Component Inputs` node whose ports are plugged `output` — that inversion is what makes this work, and it is the single most common thing to get backwards.

## Related nodes

[Component Outputs](./component-outputs.md), [Repeater](../visual/for-each.md), [Component Object](./net-noodl-component-object.md), [Receive Event](../events/event-receiver.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
