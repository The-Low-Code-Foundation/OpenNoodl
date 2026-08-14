# UNI-010 — a tutorial your own Claude can write

**Surface:** editor + MCP (no platform dependency — that is the point) · **Tier: experiment**
· **Effort:** M (after UNI-007's format exists) · ✅ **D5 RULED 2026-08-14** · still needs UNI-007's
lesson format and grading runner (criteria 3 and 4 there are this task's prerequisites)

> **D5 makes this task's premise literally true** ([RULINGS.md](RULINGS.md)). The Learning section
> is a **visible launcher section written by the editor process** — so a lesson the user's own
> Claude authors locally lands in exactly the same place, through exactly the same writer, as one
> pulled from the platform, **with no account and no platform involved**. "No platform dependency —
> that is the point" is now a ruling, not an aspiration.
>
> 🔴 **The verifier gets sharper: `Array` and `Object` must be REJECTED, not substituted.**
> Re-verification against `node-catalog.json` on 2026-08-14 found that two of the nine display names
> are **ambiguous** — `Array` maps to both `Collection` and `Collection2`, and **`Object` maps to
> both `Model` and `Model2`** (recorded as `Model2` alone until now). A freely-authoring model
> reaching for a display name therefore risks more than a silent no-match: an ambiguous name can
> resolve to the **wrong one of two**, which is class **F3** — the class the prior arc predicted
> *"nobody expects to see and is worst when it appears"*, and the class this task's own ruling made
> mandatory verifier work. **The static check must reject these two rather than auto-correct them**,
> because there is no single right substitution to make.

## Premise

Added 2026-08-14: for people who don't want the University platform at all, let **their own
Claude Code** author a tutorial lesson — an MCP instruction set + tool that teaches the model
how to write a lesson bundle, which lands in the same Learning folder with the same step-by-step
UX and the same grading. Personalisation at **zero platform cost** (the learner's own
subscription pays), fully offline from our servers, and a free test bed for the lesson format.

Richard's own doubt, verbatim: *"is it still too risky that the LLM makes a mistake and the
tutorial it makes gets stuck or teaches the wrong thing?"* This task exists to answer that
empirically, and its design splits the risk in two:

- **"Gets stuck" is machine-catchable.** A lesson bundle is only *installed* if it passes the
  verifier: every step's completion condition is satisfiable by that step's own solution state,
  each intermediate state validates, and the final solution passes `validate_project` +
  `render_report` with real pixels drawn (the "clean can mean EMPTY" lesson applies — assert
  drawn output, not just no-errors). Generate-then-verify, exactly like grading a student. A
  lesson that can't be completed by replaying its own steps never reaches the Learning folder.
- **"Teaches the wrong thing" is not machine-catchable** — no gate grades pedagogy. Mitigations,
  not guarantees: the MCP instructions embed the LEARN-002 spine + tutor-boundary material so
  the model projects from curated concepts rather than inventing doctrine (Loom's closed-palette
  idea applied to pedagogy); the lesson template constrains shape (concept → guided steps →
  check); and every AI-authored lesson is **provenance-marked** in the bundle and *visibly
  labelled* on its Learning-folder card — never presented as curated NodeGX curriculum.

## 🔴 Ruling 2026-08-14 — free authoring stands, the verifier pays for it

This task duplicates an already-specced arc:
**[LEARN-007…010](../phase-17-noodl-learn/EXPERIMENT-GENERATED-LESSONS.md)** (specced 2026-08-02,
open questions answered 2026-08-09). Its §3.1 is written as binding: *"The model fills slots. It
never authors predicates… A task in this arc that has the model emitting `completeWhen` directly
has misread this section."* UNI-010's premise is the opposite.

Put to Richard as a direct conflict, 2026-08-14. **Ruling: the model may author conditions — and
in exchange the verifier must absorb the full F1–F6 taxonomy, not F2 alone.**

The bet, stated honestly: §3.1's guarantee was *structural* (a condition never generated cannot be
wrong); this replaces it with a **gate**, so the gate carries all the risk and every class it
misses reaches a learner.

| | Class | What it is | How this task must detect it |
|---|---|---|---|
| **F1** | Unreachable | condition names a node type or port that doesn't exist | **static** vs `node-catalog.json` — and see the vocabulary trap below |
| **F2** | Dead on solution | conditions never fire against the lesson's own solution | deterministic replay — *the only class v1 covered* |
| **F3** | Ambiguous address | condition resolves to the **wrong node** when several candidates exist | **decoy graph**: add a second plausible node, assert it still resolves to the intended one |
| **F4** | Empty preview | sample-data keys miss the bindings, so nothing renders | **render and assert drawn output** — 🔴 "clean can mean EMPTY"; absence of errors is not evidence |
| **F5** | Variant-blind | conditions fail a legitimate *alternative* correct solution | **humans only** — the five-lesson run |
| **F6** | Text–graph divergence | prose asks for what conditions don't check, or vice versa | **human read** |

The prior arc's pre-registered prediction, which this task should be scored against: *"F4 (empty
preview) is the top defect. F3 is the one nobody expects to see and is worst when it appears."*
**v1 as written gated on the class predicted least common and omitted both predicted worst.**

### 🔴 The two-vocabulary trap makes F1 load-bearing here

[LESSON-FORMAT.md §3](../phase-17-noodl-learn/LESSON-FORMAT.md) documents a **silent** failure:
prose must use a node's **display name**, conditions must use its **type name**, and nine of them
differ — `Repeater`→`For Each`, `Static Array`→`Static Data`, `Delay`→`Timer`, `Array`→`Collection`,
`Insert Object Into Array`→`CollectionInsert`, `Object`→`Model2`, `Record`→`DbModel2`,
`Page Router`→`Router`, `Repeater Item`→`For Each Actions`. A condition naming a display name
matches nothing and *tells the learner they failed a step they completed* — precisely the
"tutorial gets stuck" risk, and a freely-authoring model will reach for the picker's names.
The static check must reject display names outright.

### Two constraints that survive the ruling as authoring guidance

They were *findings*, not preferences, and nothing now enforces them structurally — so the MCP
brief must teach them and the human read must look for them:

- **§3.2 — address by `#label`, not `%Type`.** `findNodeWithPath` returns the **first** match at
  each path segment, so type-only addressing on a learner's own project is a lottery.
- **§3.3 — binding keys come from the pattern, values from the theme.** A model inventing sensible
  data with the wrong field names renders an empty box (this is F4's cause).

## Scope (v1 — an experiment with a kill switch)

- A `create_lesson` surface in the local MCP: instructions (the how-to-author brief: format,
  pedagogy constraints, worked example) + a validating install tool that runs the verifier and
  writes the bundle via the editor process (🔴 never writing launcher state from the sidecar).
- The verifier itself — shared with UNI-007's runner, not a fork.
- Provenance + labelling end to end (bundle field → card badge).
- **The test Richard wants:** ask Claude Code for, say, "a lesson on wiring a For Each to
  Static Data, assuming I know JavaScript" — then take the lesson as a learner. Grade the
  experience honestly: did the verifier catch the broken drafts? Was the surviving lesson
  worth taking?

## Kill / keep criteria (pre-registered, so the experiment can fail honestly)

- **Kill** if the verifier passes lessons that still routinely dead-end in human hands, or if
  authoring reliability is so low the verifier rejects nearly everything (the format is too
  hard for the model — fix the format or the brief before shipping the feature).
- **Keep** if ≥ 3 of 5 test-generated lessons install and are completable + worth completing —
  then this graduates from experiment to shipped feature, and becomes the org story's cheap
  end too (a teacher's Claude authoring class-specific lessons onto UNI-005's shelf).

**Reconciled with the prior arc (2026-08-14):** LEARN-009's harness output is the *evidence*
(F1–F4 scored mechanically, per-lesson, regenerable); UNI-010's ≥3-of-5 is the *decision rule*.
The harness was always designed to outlive its experiment — *"it becomes the gate any future
generated lesson passes before a learner sees it"* — which is already UNI-007's "same verifier,
not a fork" requirement. Build it once, here.

## Acceptance criteria

1. A deliberately-broken bundle is refused with a diagnostic the authoring model can act on — the
   refusal *writes* its reason (the phase-64 lesson: grade a refusal by what it wrote). **Per the
   2026-08-14 ruling this needs one deliberately-broken bundle per machine-detectable class, not
   one overall:** F1 (a condition naming `Repeater` instead of `For Each`), F2 (unsatisfiable step
   condition), F3 (a condition that resolves to a decoy node), F4 (sample-data keys that miss the
   bindings, so the solution renders nothing).
2. A valid bundle installs, shows the AI-authored label, and grades identically to a
   platform-authored lesson through UNI-007's runner.
3. The five-lesson test run is performed and written up against the kill/keep criteria.

## Not in v1

Sharing AI-authored lessons to other users or the platform shelf (curation questions belong to
a later tranche), auto-repair loops where the MCP re-prompts the model, non-Claude clients
(the MCP is client-agnostic by nature; we only *test* with Claude Code).
