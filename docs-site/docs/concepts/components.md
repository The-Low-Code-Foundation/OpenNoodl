---
title: Components, and why a component is also a node
sidebar_position: 3
---

*Describes NodeGX 0.1.0.*

A **component** is a named, reusable graph of nodes — your own building block, made out of
NodeGX's built-in nodes and wires, that you can then use just like any built-in node.

## A component is a node

This is the idea that makes NodeGX scale past a single canvas. Once you've built a
component, it appears in the node picker like anything else, and you can drop **instances**
of it anywhere — including inside other components. Each instance is independent: change one
instance's inputs and only that instance is affected; edit the component's own graph and
every instance updates, because they're all the same underlying definition.

A component declares its own ports the same way a built-in node does — with dedicated nodes
inside its graph (an inputs node and an outputs node) that define what shows up on the
outside of the component when you drop it elsewhere. Wire something to one of those inside
the component, and it becomes an input or output port on the component itself.

This is also why "component" and "node" aren't two separate systems to learn — everything
you place on a canvas, whether it shipped with NodeGX or you built it yourself, is a node.

## Kinds of component

Every component is, underneath, the same thing (a name plus a graph), but a few kinds are
special-cased by the editor because of what's rooted in their graph:

- **Home component** — the project's entry point. There's exactly one.
- **Page** — a component rooted in a `Page` node, meaning it corresponds to a route/URL in
  your app.
- **Popup** — a component that's shown as an overlay (referenced by a Show Popup node
  elsewhere) rather than routed to directly.
- **Cloud function** — a component rooted in a cloud request/response pair. It doesn't run in
  the browser; see [What runs in the browser, and what runs on the backend](./frontend-vs-backend.md).
- **Visual component** — an ordinary reusable piece of UI, like a card or a form.
- **Component** (generic) — anything else, typically pure logic with no visual root.

## Nesting: the tree inside the tree

Visual nodes can also nest **inside** each other directly on the canvas — a Group containing
a Button containing a Text, for instance — which mirrors the structure the app will actually
render (its DOM). This nesting is a separate relationship from a wire: wires carry data and
signals between nodes; nesting says "this node renders inside that one." A component's
visual structure is this nesting tree; its behavior is the wires layered over it.
