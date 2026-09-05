# Defects building spine lesson 7 found

**Opened 2026-09-05 while building [SYL-010](SYL-010-LESSON-7-IT-GETS-DEMANDING.md).** Every row is a
finding about the *product or the tooling*, not about lesson 7 — lesson 7 works around each one and
ships. Rows carry an **owner or `NONE`**.

The earlier registers are [DEFECTS-LESSON-2-FOUND.md](DEFECTS-LESSON-2-FOUND.md) (5 rows),
[DEFECTS-LESSON-3-FOUND.md](DEFECTS-LESSON-3-FOUND.md) (4),
[DEFECTS-LESSON-5-FOUND.md](DEFECTS-LESSON-5-FOUND.md) (4) and
[DEFECTS-LESSON-6-FOUND.md](DEFECTS-LESSON-6-FOUND.md) (4). **All seventeen are still open.**

| # | severity | owner | one line |
|---|---|---|---|
| I1 | ⚠️ medium | `NONE` | every gate the lesson programme has is blind to a lesson whose behaviour is time-delayed |
| I2 | low | `NONE` | `drive-page.js eval` is documented as taking an expression and requires a `return` |

---

## I1 ⚠️ — every static gate is blind to a time-delayed lesson

**The shape.** `create_lesson`'s F4 renders the solution and asks whether it drew anything. Lesson 7's
solution draws its new content **five seconds after the page mounts**, and the render harness
screenshots well before that. So:

> The shipped solution and a solution with **every one of this lesson's eight wires deleted** produce
> byte-comparable render reports: 11 texts, `placeholders: 0`, `overflowingCount: 0`,
> `consoleErrors: []`, and the nag at opacity 0 in both.

F1-F3 are graph-shaped and pass either way, because the conditions and the graph agree with each
other; it is the *behaviour* neither can see. `lessons:check` is structural. The chain check compares
bytes. **Nothing in the programme's gate set can fail this lesson.**

**Why it matters beyond lesson 7.** Every remaining spine lesson that touches time, animation,
navigation or anything asynchronous has the same hole, and the hole is invisible: the scorecard reads
`F4 pass` in exactly the tone it uses for a lesson it actually checked. This is the same family as
[G1](DEFECTS-LESSON-5-FOUND.md#g1--an-expressions-as-number--as-string--as-boolean-outputs-never-update),
where every gate stayed green over a vanished creature.

**Worked around by driving it**, with a control arm at `duration: 60000` to prove the delay was the
cause rather than the load — see [SYL-010](SYL-010-LESSON-7-IT-GETS-DEMANDING.md). That is a manual
procedure and nothing requires the next author to follow it.

⚠️ **The cheapest fix is probably not a new gate.** `render-report` already settles the page; a
`--settle-ms` or a second capture at a named delay would let F4 answer *did anything change between
these two frames?*, which is the question a time-based lesson needs and a static one is unharmed by.
Not designed here; the row is the reading.

---

## I2 low — drive-page.js eval is documented as an expression and requires a statement

**The shape.** The usage block says:

```
drive-page.js eval    <expression>
```

The implementation wraps the argument in a function body:

```js
// scripts/devtools/drive-page.js:118
expression: `(() => { ${expression} })()`,
```

So an actual expression — `document.querySelectorAll('.ndl-visual-text').length` — evaluates, is
discarded, and the verb prints `{}`. It needs `return` in front of it, which is what every internal
caller in the file does (`ev(client, 'return innerHeight')`).

**Why it is worth a row rather than a shrug.** `{}` is indistinguishable from *the page returned
nothing*, which is a plausible answer to a lot of the questions this verb gets asked — "is that
element there", "what is its computed opacity". The header comment above `ev` explains the wrapping
and is read after the failure, not before it. One word in the usage line (`<statements>`, or
`<expression, needs "return">`) closes it.

⚠️ Found while trying to read computed opacity during lesson 7's drive. Recovered by using `dom` and
screenshots instead, which is why the lesson's measurements are pictures.
