# DSG-006 — The cold benchmark

**Status:** 🟠 **run, in phase 55's frame** · **Track C** · the architecture half was scored; the
half this phase is about **never was**

## What the README asked for

> Wipe a copy, hand the same brief to a **cold** agent with the library and nothing else, and judge
> it side by side against A.

The point of the "cold" is that it is the only honest proof. Everything else this phase produces is
an argument; a cold replay is a measurement. And the one pretty result the phase had was produced by
Claude Opus with an enormous amount of scaffolding, which is not evidence that the library works.

## §1 — What was actually run

It happened, in [phase 55's acceptance matrix (LAS-011)](../phase-55-llm-authoring-support/LAS-011-ACCEPTANCE-MATRIX.md),
on 2026-08-08 — the audit ran two cold replays before the tasks were written, and the matrix ran
three models afterwards. The method matches the README's: cold replay of the same brief, artefacts
scored mechanically (`measurements/score-run.js`, which reproduces the published numbers off disk),
and **Richard judging the rendered pages side by side against a Claude artifact of the same brief**.

The verdict, and it is Richard's:

> *"Sonnet is the only one that clears the bar, which confirms that we should recommend Opus for
> scoping larger creations and doing high level design, Sonnet for the creation work and basic
> designs."*

Two results worth keeping:

- **The gates made the run cheaper, not loopier.** Sonnet went from 147 turns/$7.86 to 92/$5.10, with
  3 rejections in 91 calls — contradicting the standing fear that blocking gates would make models
  spin.
- **Cold models decompose correctly once the doctrine reaches them.** Both replay Homes came in at
  **7 and 8 nodes**, against the reference build's 66. That is the clearest single number the design
  library has produced, and it is about architecture.

## §2 — Why this task is not closed

Two gaps, and the second is the one that matters to *this* phase.

### 1. No run isolates the design library

The doctrine (`2ef44128`), the recipes (`231fc68d`) and the first gate (`ef945bdc`) landed **within
four hours of each other**, and phase 55's gates landed on top before the matrix ran. Every replay
therefore measures *all* of it at once. Nothing in the record answers "what did the recipes buy?" or
"would the doctrine alone have done it?" — and the honest reading is that the phase does not know
which of its three instruments is carrying the result.

⚠️ An ablation is expensive (each replay is a paid drive; see the standing constraints) and it is
**not obviously worth it**. Log it as a known limit on every claim this phase makes rather than
scheduling it. If one ablation is ever run, run the one that answers a decision: **doctrine minus
recipes**, because the recipes are the deliverable with the ongoing maintenance cost.

### 2. "Looks designed" was judged, not scored ⭐

The mechanical scorer covers structure — node counts, connections, varying instances with no port to
land on, repeaters. The visual half was a human looking at rendered pages side by side, which is
**the right final authority and the wrong instrument for a trend.** There is no per-criterion score
for hierarchy, rhythm, one accent, imagery, empty states, or narrow-width survival, so:

- the phase cannot say whether a later change made pages *prettier* or merely *not worse*;
- a regression in the design half is invisible until someone happens to look;
- and the phase's own success line — *"if a strong model produces a beautiful 66-node page, it has
  not [succeeded]"* — is only half measurable.

Phase 58 hit exactly this and fixed it there: **score the exit test per criterion, because one
verdict hides the one that matters.** The same correction applies here.

## §3 — What to build, if this is picked up

A design rubric that scores the same artefacts the structural scorer already reads, one row per
doctrine section, from **rendered evidence rather than the graph**:

| Criterion | Measured how | Doctrine |
|---|---|---|
| Type hierarchy | distinct `fontWeight` values across text nodes; `{"400"}` is a zero | `§3` |
| One accent | count of distinct non-neutral colours used as backgrounds | `§4` |
| Rhythm | distinct vertical gap values between bands — a page with nine is not designed | `§1`, `§8` |
| Imagery present | `Image` nodes with a **loading** URL, not merely a URL | `§5` |
| Narrow width survives | `scrollWidth > clientWidth` at 390px; multi-column bands became one | `§7`, `§11` |
| Grid is a grid | item `offsetWidth` ≠ container width | `§8`, `§11` |
| Empty state exists | the list component has a designed empty branch | `§9` |
| Real copy | no "Lorem ipsum", "Welcome to our store", "Card title" | `§10` |

⚠️ **Score per criterion and publish the row, never a single verdict.** ⚠️ **Every one of these is a
render-time fact** — they run against the render report, not the validator (see
[DSG-004 §3](DSG-004-THE-GATES-BEHIND-THE-DOCTRINE.md)). ⚠️ And the rubric does not replace Richard's
eye; it makes the trend visible between the times he looks.

## Acceptance

- One brief, replayed cold — fresh project, no conversation history, the library and nothing else.
- Scored **per criterion** against the table above, from rendered pages, with the numbers on disk and
  reproducible off the artefacts the way `score-run.js` is.
- Judged side by side against a Claude artifact of the same brief, by Richard. The score informs the
  verdict; it does not replace it.
- ⚠️ The cost is stated before the run starts, and the run is not started without a yes.
- The limitation in §2.1 is restated wherever the result is quoted: **this measures the library, not
  any one of its three parts.**

## Register

| # | Finding | State |
|---|---|---|
| F23 | **Cold models decompose correctly once the doctrine reaches them** — 7 and 8 node Homes against the reference build's 66 | ✅ measured, audit session 1 |
| F24 | **Blocking gates made the run cheaper** — 147 turns/$7.86 → 92/$5.10, 3 rejections in 91 calls | ✅ measured, LAS-011 |
| F25 | **The design half has no per-criterion score**, so a visual regression is invisible between human reviews | 🔴 open — §3 |
| F26 | **No run isolates the design library's contribution**; doctrine, recipes and gate landed within four hours and were replayed together | 🟠 filed, deliberately not scheduled — §2.1 |
</content>
