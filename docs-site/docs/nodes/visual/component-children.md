---
title: "Component Children"
---
Placeholder inside a component's visual tree marking where children given to an instance of that component are inserted.

Component Children is how a component becomes a wrapper. Placed somewhere in the component's own visual tree (typically inside a Group), it marks the insertion point: when a parent graph adds visual children to an *instance* of the component, those children render at exactly this position, surrounded by whatever chrome the component defines. The node has no inputs or outputs and renders nothing by itself — it is purely a structural marker. A component that contains one accepts children in the node picker; a component without one does not. A component has a single insertion point: adding more than one Component Children does not create multiple slots.

## When to use it

Whenever you build a reusable container whose content varies per use — cards, page sections, modals, styled panels: define padding, borders, headers once in the wrapper component and drop Component Children where the caller's content goes. Not for repeating data-driven content (use For Each with a template component) and not for passing values into a component (use Component Inputs).

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Component Children` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-editor` |

## Patterns

- Wrapper component: Group root with the shared styling, a Text header bound from Component Inputs, and Component Children below it — instances then supply arbitrary content children.
- Combine with Component Inputs: chrome configuration (title, variant) flows through inputs while free-form content flows through children.

## Watch out for

- Placing several Component Children to try to create multiple named slots — only one insertion point exists per component; split into smaller wrapper components instead.

## Examples

**Wrapper component: Component Children marks the insertion point**

Component Children is a placeholder with no ports: whatever children are given to an *instance* of the component are rendered where the placeholder sits. Here '/Media Frame' is a reusable framed panel — title bar on top, content slot below — and the consumer drops a Video inside its instance. The video's play/pause wiring lives at the consumer level; the frame knows nothing about its content.

## Related nodes

[Group](./group.md), [Component Inputs](../component-utilities/component-inputs.md), [Component Outputs](../component-utilities/component-outputs.md), [Repeater](./for-each.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
