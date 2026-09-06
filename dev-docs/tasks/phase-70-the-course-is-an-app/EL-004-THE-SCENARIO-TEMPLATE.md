# EL-004 — The scenario template

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M |
| **Surface** | `templates`, `editor` |
| **Rulings** | **D2** · **D4** |
| **Depends on** | EL-002, EL-001; shares EL-003's measured navigation substrate |

## The job

The template that demonstrates what Storyline cannot legibly do — and the pedagogical heart of
the phase (P3): `embedded://elearning-scenario`, a branching-scenario starter where the learner
makes decisions, state carries forward, and consequences compound.

Contents:

- A worked example scenario (a realistic multi-step decision conversation — pick a domain with
  Richard; it doubles as marketing) with **at least three decision points**, carried state that
  changes later options, feedback beats, and multiple endings.
- The **scenario pattern components**: a decision screen (prompt + options from data), a
  state-display fragment, an ending screen with outcome + score.
- **State and branching authored in the graph** — this template is where the node graph is the
  product, visibly: the branch structure on the canvas *is* the scenario map, which is the
  artifact Storyline authors currently reconstruct in spreadsheets.
- Every decision emits an xAPI statement (choice made, option taken) via the kit — item-level
  analytics on decisions is the 10X demo, and it costs one wire per decision here.

## Acceptance criteria

1. The example scenario plays end to end: ≥3 decision points, at least one where an **earlier
   choice changes a later screen's options** (carried state, the thing trigger-lists can't do
   legibly), ≥2 distinct endings reached by different paths — each path driven.
2. Every decision lands a statement in the transport harness with the choice identified — so a
   trainer can later ask "who chose B at the escalation step" of an LRS.
3. **The add-a-branch drive**: extend the scenario with a new decision point by copying the
   pattern component and wiring it in, following only the template's own README — performed by
   someone who did not build the template.
4. The canvas of the scenario component reads as the scenario map: an instructional designer shown
   the graph can narrate the branching structure unprompted. (Subjective by nature — run it on the
   ID student; their reading is the acceptance evidence, recorded verbatim.)
5. Ending states report completion + outcome through `Report Progress`, same harness assertions as
   EL-003 AC3.
6. Equal billing (P3) verified in the shipped wizard: two cards, same weight, deck not preselected.

## Traps

- ⚠️ Branch state wants the graph's plain state tools (variables/objects) used in the **pattern**
  the templates teach — not a bespoke state node in the kit, unless EL-002 measurement shows the
  plain tools genuinely can't express carried state cleanly. Adding kit surface for what stock
  nodes do teaches the wrong lesson (P69's P2, inherited).
- ⚠️ The example scenario's prose is content, not chrome — it will be copied verbatim into real
  courses. Write it like it ships, and keep it culturally portable.
- ⚠️ Same vocabulary, token and fork-vs-kit audits as EL-003 (D2, D8 spirit, P2).

## Out of scope

- Adaptive difficulty / spaced repetition — the data loop phase, later.
- A visual scenario-map editor distinct from the canvas — the canvas being the map is the point.
- Timed/scored simulations of software — the real-app simulation story is its own future phase.
