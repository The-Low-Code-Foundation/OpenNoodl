# RCK-005: The Session Record & the Report

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RCK-005 |
| **Phase** | Phase 32 — Reality Check (Track Q) |
| **Tier** | 2 — synthetic |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1.5–2 wks |
| **Prerequisites** | RCK-004, OPS-003 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — the whole value is in what it looks like when someone reads it about their own app |

## Objective

Turn sessions — synthetic now, human later — into the two artefacts that change a builder's mind: a
coverage number they cannot argue with, and a list of findings their AI can fix.

## Background

Richard, on what makes this different from a usability lab:

> "With AI we can literally see inside its head, know what it's truly thinking warts and all with no
> filter or ability to hide the truth."

That is real and it is not a consolation prize. Human think-aloud protocols are corrupted by politeness
and self-presentation — people do not say *"this is stupid and I have no idea what this company does"*,
they say *"hmm, interesting."* A persona's reasoning trace has no social filter and no desire to be a
good guest.

But it is *a* mind, not *the* mind — an articulate simulation of confusion, not evidence of it. The
report's job is to be devastating about what it knows and explicit about what it does not, in the same
document. Getting that balance right is the difference between this phase working and this phase
becoming the excuse machine its README warns about.

The coverage number is the other half, and it is the one aimed squarely at Richard's nightmare
scenario:

> "Watch 20 users gloss over 90% of them and not understand them."

*"Of your 34 screens, 6 were ever reached. Of your 112 interactive elements, 19 were ever used. Here
are the 14 components no tester ever saw"* — computed, from their own app, by their own testers.
Cutting scope after the build is the hardest advice in the world to give and the easiest number to read.

## Current State

| Piece | State |
|---|---|
| Sessions | RCK-004 produces them; nothing stores or renders them |
| Findings | OPS-003 — one shape for every source, with graph context |
| Coverage (static) | RCK-001 — journeys vs. components, before any run |
| Diff canvas | AIX-003 draws annotated components on a diff canvas; RCK-006 needs the same primitive |
| Component heatmap | RCK-001's static version; this task adds the *observed* layer |

## Desired State

### 1. The session record

Per session: the archetype and parameters, the generated intent, and an ordered trace of

- screenshot → the persona's reasoning at that moment → the action taken → what changed

plus derived signals: time to first action, hesitations, backtracks, repeated visits to the same
screen, clicks that hit nothing (RCK-003 records these and they are gold), abandoned form fields, and
the stop reason.

Stored with the project, prunable, and **never containing customer data** — synthetic sessions run
against test data, and RCK-007 owns the masking rules for when humans arrive.

### 2. The three findings that matter

Not every confusion is a finding. Three shapes are promoted automatically:

| Shape | Why it is a finding |
|---|---|
| **Dead end** | the persona could not proceed and abandoned. The flow is broken or unfindable |
| **Phantom affordance** | it clicked something that was not interactive. It believed a thing was a button |
| **Wrong model** | its stated understanding of what a screen was for diverges from what the screen is for |

Each becomes an OPS-003 finding with the screenshot, the reasoning at that moment, and the component
path — so *"fix the highest-priority open finding"* works unchanged.

**Deduplicated across personas**, with a count. Five personas hitting the same dead end is one finding
with weight 5, not five findings — and the weight is the priority signal.

### 3. Coverage, observed

The static heatmap from RCK-001, overlaid with what was actually reached across the run:

- components reached / never reached
- interactive affordances used / never used
- the explicit list of never-reached components, ready to act on

And the sentence, computed: *"Of your 34 screens, 6 were reached in 5 sessions."*

### 4. Prediction diff

Where RCK-006's prediction exists, both paths on the same canvas — predicted in one treatment, actual
in another, with dead ends and backtracks marked. This is the artefact nobody argues with, and it uses
AIX-003's existing annotated-diff-canvas primitive rather than a new one.

(This task builds the rendering; RCK-006 builds the prediction. They are separable and the report
degrades gracefully with no prediction present.)

### 5. What personas cannot tell you

A standing section, at the end of every synthetic report, **non-dismissible and never omitted**:

> **These sessions cannot answer:** would anyone pay for this? Would anyone come back next week? Do
> they trust you with their card details? Is the problem you are solving one they actually have?
> Would they have bothered at all?
>
> A persona completes the task because it was asked to. It never gets bored and closes the tab — which
> is the most common thing a real user does.

And the headline the report opens with is a readiness statement, not a verdict:

> **"Your app is now worth five people's time."**

Not *"your app passed."* There is no pass. This wording is a product decision recorded in the phase
README and it should be hard to change casually.

### 6. Promotion to the replay suite

One click from any finding to a deterministic RCK-002 journey step. This is the flywheel — exploration
discovers, replay defends — and it must be one click from the report, not a re-authoring exercise.

### 7. Run comparison

Two runs of the same configuration, before and after a fix: which findings are gone, which are new,
how coverage moved. The *"we changed something and re-tested"* evidence RCK-008's gate requires.

## Implementation Steps

1. The session record + storage + pruning.
2. The three promoted finding shapes + cross-persona dedup with weights.
3. Observed coverage overlay + the computed sentence + the never-reached list.
4. Prediction diff rendering on AIX-003's canvas primitive (degrading gracefully when absent).
5. The standing limitations section and the headline wording, both structurally required.
6. Promotion to replay.
7. Run comparison.
8. **Live pass**: run the QA fixture, read the report as a builder would, then fix one finding and
   re-run to confirm the comparison shows it gone. Screenshot the coverage heatmap and the report head.

## Success Criteria

- [ ] A session record carries reasoning, action and screenshot per step, plus every derived signal.
- [ ] The three finding shapes are promoted automatically and deduplicated with weights.
- [ ] Observed coverage renders over the static heatmap; the never-reached list is actionable.
- [ ] The prediction diff renders when a prediction exists and the report is coherent when it does not.
- [ ] The limitations section **cannot be dismissed or omitted** — verified by trying.
- [ ] The report has no pass state and the headline is the readiness sentence.
- [ ] Promotion to a replay step is one click.
- [ ] Run comparison shows a fixed finding as resolved.

## Out of Scope

- **Human sessions.** RCK-007 feeds the same record; this task must not special-case synthetic.
- **The gate.** RCK-008.
- **Statistical claims.** No confidence intervals, no significance. Five personas is not a sample and
  the report must never imply it is.
- **Sentiment scoring or satisfaction metrics.** A synthetic satisfaction score is a number with no
  referent and it would be quoted in a pitch deck within a week.
- **Video.** Screenshots per step.

## Traps

- **This report is the excuse machine if the framing slips.** Every design choice that makes it feel
  like a verdict — a score, a percentage, a green tick, a "passed" — undoes the phase. The limitations
  section and the headline are load-bearing product decisions, not copy.
- **Dedup that is too aggressive hides variety.** Two personas failing at the same screen for different
  reasons is two findings. Dedup on the *cause*, not the location.
- **The coverage number will be unfair on first contact.** Admin routes, paid-tier screens and error
  states are legitimately unreached. RCK-001's "not on a journey by design" marking must be honoured
  here, or the report tells people to delete their admin panel.
- **The persona's reasoning is *its* reasoning.** Present it as what a simulated tester said, never as
  "users think". The wording of every quote attribution matters more than it looks.
- **A finding weighted 5 is not five times as important as one weighted 1.** Weight is a priority hint;
  do not render it as severity.
- **Session records will grow fast** — screenshots per step, per persona, per run, per re-run. Prune by
  default, keep findings forever (OPS-003's resolve-never-delete rule), and never let a project's
  `.findings/` become the largest thing in it.
</content>
