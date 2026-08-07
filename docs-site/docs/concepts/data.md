---
title: "Data: arrays, objects, variables and records"
sidebar_position: 6
---

*Describes NodeGX 0.1.0.*

NodeGX gives you a small set of data building blocks. They cover two different situations —
data that lives only in the running app, and data that's stored on a backend — and it's worth
knowing which is which before you reach for one.

## In the app: Array, Object, Variable

These three hold state **in the running app only** — in the visitor's browser, for as long as
that page is open. Nothing here is saved anywhere unless you explicitly send it somewhere
(a Record, an HTTP request, and so on).

- **Object** — a single bundle of named properties: think "one thing," with fields on it.
  You declare which properties it carries, and each becomes its own port. Bind values into
  it, wire its properties out to whatever should display or use them.
- **Array** — an ordered list. Feed it items (often Objects), and wire it to something that
  repeats over a list — a Repeater component, most commonly — to render one visual instance
  per item. Arrays have companion action nodes for the common list operations: creating one,
  inserting or removing an item, filtering it down, mapping it to a new shape.
- **Variable** — a single named value, declared once and referenced from anywhere in your
  project by that name — the mechanism for sharing a piece of state between components that
  aren't directly wired to each other (an Object or Array declared as a Variable works the
  same way: named and globally reachable, rather than local to one canvas).

All three follow the same reactivity guarantee described in
[Signal vs value](./signal-vs-value.md): change one, and everything wired to read it updates,
in the same synchronous step — you never need to manually "refresh" something downstream.

## On the backend: Records

A **Record** is a row of data that actually persists — stored on your backend, present the
next time anyone opens the app, and shared across every visitor rather than private to one
browser tab. Records live in named collections (the backend's schema), and NodeGX gives you
dedicated nodes for them: **Query Records** and **Record** to read, **Create Record**,
**Update Record** and **Delete Record** to write, and **Filter Records** to narrow a query.
A query's results come back as an Array of Objects — which is why the two halves of this
page aren't really separate systems: a Record is how an Array of Objects gets in and out of
permanent storage.

## Choosing between them

- Need to hold a value only while this page is open, or pass data between a few nodes on one
  canvas? **Object**, **Array**, or a local **Variable**.
- Need a value visible to unrelated components across your whole app, still only for the
  current visitor's session? A **Variable**.
- Need it to still be there tomorrow, or visible to other users? A **Record**.
