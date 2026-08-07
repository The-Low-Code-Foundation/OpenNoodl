---
title: Node, port, wire
---

*Describes NodeGX 0.1.0.*

NodeGX projects are built as visual graphs, not written as code (though you can drop into
code where you need to). Three words carry almost all of that idea.

## Node

A **node** is one unit of behavior or appearance, dragged onto the canvas from the node
picker. Some nodes are visual — a Button, a Text, a Group — and appear as elements in your
running app. Others are invisible at runtime and do data or logic work — a Variable, an
HTTP Request, a Function. Every node has a type (what it is), and an instance (the one you
placed) — you can place the same node type many times, each with its own settings and its
own wires.

## Port

A node exposes **ports** — named connection points on its edges. Ports come in two
directions:

- **Input ports** — on the left/top of the node — are things the node needs: settings you
  type in directly, or values fed in from elsewhere in the graph.
- **Output ports** — on the right/bottom of the node — are things the node produces or
  announces, that other nodes can react to.

Every port also has one of two *kinds* — value or signal — which changes what connecting it
actually does. That distinction is important enough to have its own page: see
[Signal vs value](./signal-vs-value.md).

## Wire

A **wire** is a connection you draw between an output port and an input port. Drawing a wire
is how you build behavior without writing code: instead of a Button's click handler calling
a function, you draw a wire from the Button's *Click* output to whatever should happen next.
A node can have many wires in and out; the graph you see on the canvas *is* your program's
logic, laid out spatially instead of listed as statements.

Wires only connect compatible port types. Where NodeGX can losslessly turn one type into
another at the wire — for example, an object arriving at a text input — it does so
automatically so the connection isn't blocked on a technicality; where there's no sensible
conversion, the picker won't offer the connection at all.
