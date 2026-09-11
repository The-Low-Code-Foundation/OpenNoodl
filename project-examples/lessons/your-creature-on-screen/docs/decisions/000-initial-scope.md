# 000 — Initial scope

_Recorded 2026-08-28T20:36:41.641Z, from the scoping conversation held before this project was created._

## What was asked for

> Rock out for lesson 1 then please — the first lesson of the NodeGX University spine, "Your creature, on screen". Richard's own curriculum entry: "A blank page becomes a card with a picture, a name and a coloured frame — and a user interface turns out to be a tree of things with properties." Teaches elements, hierarchy, properties. Nodes: Group, Text, Image, Circle. 30 minutes.

## What was decided

**The app.** The solution project for University spine lesson 1. A single home page holding one card: a coloured Group containing a Circle creature and a Text name. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

**Who it is for.** A person who has installed NodeGX, opened it, and never built anything in it. This is the most beginner-facing artefact in the whole curriculum.

**Pages.**

- Home — The only page. Holds the creature card: a Group with a background colour and a set width, containing a Circle and a Text.

**Backend.** No data at all. Lesson 1 is purely visual — elements, hierarchy and properties. The database arrives at spine lesson 8.

**Rules for this project.**

- Colour parameters are set as var(--token) from the style vocabulary, never raw hex.
- Every node carries an explicit label, because lesson conditions address nodes by #Label and type-only addressing is an F3 ambiguity risk.
- No connections. If this graph ever grows a wire, the lesson has stopped being lesson 1.

## What was considered and rejected

This is the section with the longest shelf life. It is what stops the next reader — or the next
assistant — helpfully rebuilding something that was deliberately left out.

- **Use an Image node with a bundled picture** — rejected: No image asset ships with a new project — STARTER_ASSETS carries Inter and Lucide only — and log-a-thing ships none either. An Image would need an asset that does not exist.
- **Have the learner supply their own picture** — rejected: Nothing ships, the completion condition cannot verify which file arrived, and a learner with no picture to hand is stuck in the first ten minutes of their first lesson.
- **A remote avatar search API** — rejected: Richard's preferred idea and a good one, but it makes a network call a prerequisite for minute five of the first lesson, against D17's no-origin invariant, and an unfiltered image search is a moderation liability. Filed as its own task; lesson 1 upgrades to it later.
- **Grade the card's width with paramsEqual** — rejected: The prose deliberately does not name a value, so hasParams is the honest condition. Naming a value would also teach sizing, which belongs to lesson 2.

## Deliberately out of scope

- Sizing and responsive layout — deliberately deferred to the new spine lesson 2, 'It breaks on a phone'. Lesson 1 sets one fixed width precisely so that lesson has a problem to solve.
- Events, clicking and signals — spine lesson 'poke-it'.
- State and variables — spine lesson 'it-forgets-you'.
- Any logic node whatsoever. There are no connections in this graph.
- An Image node. Nothing ships a picture, so the creature is drawn from a Circle.

## Still open

> TODO: The creature is one Circle. Whether it gains eyes — which would need absolute positioning, and positioning is lesson 2's subject — is Richard's call.
> TODO: The learner-facing step prose in this lesson is drafted by Claude and must be replaced or edited by Richard before it ships.

## Proposed build plan

Produced from the scope above and handed over unexecuted — no components were authored during
scoping. Review it before building.

1. **update `Pages/Home`** — The only page. Holds the creature card: a Group with a background colour and a set width, containing a Circle and a Text. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do.

<!-- The same plan, for the editor to read back if it is offered again. Safe to delete. -->

```json nodegx-plan
{
  "version": 1,
  "plan": {
    "request": "Rock out for lesson 1 then please — the first lesson of the NodeGX University spine, \"Your creature, on screen\". Richard's own curriculum entry: \"A blank page becomes a card with a picture, a name and a coloured frame — and a user interface turns out to be a tree of things with properties.\" Teaches elements, hierarchy, properties. Nodes: Group, Text, Image, Circle. 30 minutes.",
    "operations": [
      {
        "id": "op-1",
        "kind": "update",
        "target": "Pages/Home",
        "intent": "The only page. Holds the creature card: a Group with a background colour and a set width, containing a Circle and a Text. Follow docs/CONVENTIONS.md; docs/BRIEF.md says what this app deliberately does not do."
      }
    ],
    "scroll": "page"
  }
}
```

## Transcript

_(no transcript was captured)_
