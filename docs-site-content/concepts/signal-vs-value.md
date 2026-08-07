---
title: Signal vs value
---

*Describes NodeGX 0.1.0.*

Every port on every node is one of two fundamentally different things: a **value** or a
**signal**. Nothing else in NodeGX matters more to understand early, because it decides
what a wire actually does when you draw it.

## A value is a fact that holds

A value port carries a piece of data that exists continuously — a number, a string, a
boolean, a color, an object, an array. It has a current state at every moment, whether or
not anything just changed it. When you connect a value output to a value input, you are
saying: *keep this input equal to that output, from now on.* Whenever the source changes,
the change propagates to everything wired to it — that's what makes the graph reactive
instead of a one-shot calculation.

A value input only reacts to *change*. Setting a value to the value it already holds is not
a mutation, and nothing downstream is notified — the graph doesn't do work for a fact that
didn't change.

## A signal is an event that happens

A signal port carries no data of its own. It doesn't have a "current value" you could
inspect — it represents a single moment: *this occurred.* A signal input runs its action
once, at the instant it fires, and then it's over. There's nothing to hold.

Mechanically, a signal input is **edge-triggered**: internally it's driven by a
false→true transition, and it fires only on that transition, never merely because
something is "true". This is why signal inputs use their own handler (`valueChangedToTrue`)
rather than the ordinary value setter — a signal doesn't want to know what changed, only
that the transition just happened. Signal wires are the graph's verbs: *Fetch*, *Success*,
*Failure*, *Done*, *Clicked*. Value wires are its nouns: *Items*, *Text*, *Visible*, *Color*.

## Why this distinction is the highest-value thing to learn

Most confusion a new user hits — "I wired it up and nothing happens" or "why does this fire
twice" or "how do I make this run when the app starts" — traces back to treating a signal
like a value or a value like a signal:

- Wiring a *value* output to a place expecting a *signal* input does nothing, because
  nothing ever transitions false→true — a value output doesn't pulse, it just sits at
  whatever it currently is.
- Expecting a *signal* input to remember anything between firings is a mistake — it has no
  memory. If you need to know what happened, capture it into a value (a Variable, an Object
  property) at the moment the signal fires, and read the value afterward.
- A node that does work — a fetch, a save, a navigation — is driven by a signal input and
  answers with a signal output (commonly *Success* / *Failure*, or a single *Done*), not by
  a value that changes to mean "it's finished."

## The underlying guarantee

Whichever kind a port is, NodeGX's runtime makes one promise about *values* specifically:
**any observable change to a value notifies everything listening to it, exactly once per
change, synchronously** — regardless of which code path made the change. You don't need to
manually "refresh" a downstream node because an upstream value changed three function calls
away; the graph is kept consistent by construction. That guarantee is what makes values safe
to treat as "the current state of the world" rather than "whatever was last pushed to me."

Signals make no equivalent promise about *state*, because they don't hold any — the
guarantee that applies to them is simpler: a signal that fires, fires, and downstream signal
inputs run exactly once per firing.
