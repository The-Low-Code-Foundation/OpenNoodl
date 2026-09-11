# Brief

## What this app is

The solution project for University spine lesson 1. A single home page holding one card: a coloured Group containing a Circle creature and a Text name. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

## Who uses it

A person who has installed NodeGX, opened it, and never built anything in it. This is the most beginner-facing artefact in the whole curriculum.

## Deliberately out of scope

- Sizing and responsive layout — deliberately deferred to the new spine lesson 2, 'It breaks on a phone'. Lesson 1 sets one fixed width precisely so that lesson has a problem to solve.
- Events, clicking and signals — spine lesson 'poke-it'.
- State and variables — spine lesson 'it-forgets-you'.
- Any logic node whatsoever. There are no connections in this graph.
- An Image node. Nothing ships a picture, so the creature is drawn from a Circle.

_Agreed in the initial scoping conversation; the full record, including what was considered and rejected, is in `docs/decisions/000-initial-scope.md`._
