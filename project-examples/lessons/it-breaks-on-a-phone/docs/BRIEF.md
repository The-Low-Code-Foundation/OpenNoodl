# Brief

## What this app is

The solution project for University spine lesson 2, "It breaks on a phone". Lesson 1's creature card, plus a strip underneath it holding three words in a Columns node — three across on a laptop, one above the other on a phone. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

🔴 **The starter of this lesson is the solution of lesson 1, and that is a build constraint rather than a description.** Every spine lesson `needs` the one before it and they share one app, so `starter(N)` must equal `solution(N-1)`. Two rules follow, and neither is obvious:

- **This lesson may only ADD.** A step that graded a parameter lesson 1 already set — `Card`'s `sizeMode`, say — would have `derive_starter` retract it, and the learner would open lesson 2 to find lesson 1's work undone.
- **Ungraded furniture may only be added to nodes this lesson creates.** A parameter set on `Page shell` or `Card` and not graded stays in the derived starter, so it appears in a project the learner never built it in.

## Who uses it

Somebody who has finished lesson 1 and has never thought about layout. They have one card that happens to look right on the screen in front of them.

## Deliberately out of scope

- Events, clicking and signals — the next spine lesson, `poke-it`. The strip this lesson builds is what that lesson makes clickable.
- State and variables — spine lesson `it-forgets-you`.
- Absolute positioning, `transformX` / `transformY` and z-order. Out of scope on purpose: this lesson is an argument *against* placing things by coordinate.
- `sizing: autoFit` and `minWidth`, the other way a Columns node reflows. One reflow mechanism per lesson.
- Any logic node. There are still no connections in this graph.

_Agreed before the project was authored; the full record, including what was considered and rejected, is in `docs/decisions/000-initial-scope.md`._
