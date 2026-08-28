# Architecture

## Page map

- **Home** (`Pages/Home`) — The only page. Holds the creature card: a Group with a background colour and a set width, containing a Circle and a Text.

## Data model

> TODO: No records were agreed during scoping.

## Backend contracts

No data at all. Lesson 1 is purely visual — elements, hierarchy and properties. The database arrives at spine lesson 8.

## Decisions

Considered during scoping and deliberately not done:

- **Use an Image node with a bundled picture** — No image asset ships with a new project — STARTER_ASSETS carries Inter and Lucide only — and log-a-thing ships none either. An Image would need an asset that does not exist.
- **Have the learner supply their own picture** — Nothing ships, the completion condition cannot verify which file arrived, and a learner with no picture to hand is stuck in the first ten minutes of their first lesson.
- **A remote avatar search API** — Richard's preferred idea and a good one, but it makes a network call a prerequisite for minute five of the first lesson, against D17's no-origin invariant, and an unfiltered image search is a moderation liability. Filed as its own task; lesson 1 upgrades to it later.
- **Grade the card's width with paramsEqual** — The prose deliberately does not name a value, so hasParams is the honest condition. Naming a value would also teach sizing, which belongs to lesson 2.

Left open:

> TODO: The creature is one Circle. Whether it gains eyes — which would need absolute positioning, and positioning is lesson 2's subject — is Richard's call.
> TODO: The learner-facing step prose in this lesson is drafted by Claude and must be replaced or edited by Richard before it ships.

_Scoping record: `docs/decisions/000-initial-scope.md`._
