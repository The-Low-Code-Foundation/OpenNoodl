# RCK-006: The Prediction Artefact & the Observer View

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RCK-006 |
| **Phase** | Phase 32 — Reality Check (Track Q) |
| **Tier** | 3 — humans |
| **Priority** | 🔴 Critical — this is the mechanism the phase is built on |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1.5–2 wks |
| **Prerequisites** | RCK-001, RCK-005 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — the interaction design *is* the intervention; a well-built version of the wrong design achieves nothing |

## Objective

Before anyone tests, the builder writes down what they expect. While someone tests, the builder can
watch and cannot help — but has exactly one thing to do, and doing it produces the bug list.

## Background

Two mechanisms, and both are psychological rather than technical.

**The prediction.** Showing a builder a recording does not work; they explain it away. *That user was
tired. She's not our demographic. He'd get it second time.* The confrontation fails because it is
someone else's interpretation against their vision. So the builder writes the prediction down first —
the path, the time, the features they are sure will be found — and the diff is against **their own
handwriting**. Nobody argues with that.

NodeGX can do this in a way nothing else can, because the prediction and the reality are the same
artefact type: a path through a graph it already owns.

**The observer.** Richard's rule is *sit beside them, say nothing, watch.* It is the hardest
instruction in coaching and almost nobody follows it, because doing nothing while your work is mauled
is psychologically impossible.

So give them a job. The observer view is mute — no chat, no intervene, nothing to click — except one
button:

> **"I wanted to help here."**

Every press timestamps onto the session. And the urge to help is a *precise coordinate of a usability
defect*: the builder's agony becomes the bug list. It also converts an instruction people break ("don't
help") into an activity people complete ("press the button"), and the count becomes the number they are
ashamed of — which is exactly the right shame.

## Current State

| Piece | State |
|---|---|
| Journeys | RCK-001 — goal, steps, anchors |
| Session record | RCK-005 — trace, findings, coverage, prediction-diff rendering (awaiting a prediction) |
| Diff canvas | AIX-003 — annotated components on a diff canvas; dependency closures |
| Live streaming | BAK-001's SSE ChangeBus — generic, already has two consumers (WF-005 was the second) |
| Anything prediction-shaped | nothing |

## Desired State

### 1. The prediction

Authored per journey, before a round, in four parts:

| Part | How it is captured |
|---|---|
| **The path** | components in expected order. The AI proposes it from the graph (it can compute a plausible route); the builder corrects. Correcting is cheap; authoring from scratch is not |
| **The time** | how long they expect it to take |
| **The completion rate** | how many out of N will finish without help |
| **The features** | which components/affordances they are confident will be found *and valued* |

The fourth is the one aimed at *"20 users glossed over 90% of the features."* It is a checklist of the
builder's own confidence, and RCK-005's coverage data scores it directly.

A prediction is **immutable once a round starts** and versioned per round. A prediction editable after
the fact is not a prediction, and this is the single most important constraint in the task.

### 2. The diff

RCK-005 renders it; this task supplies the payload and the moment. Both paths on one canvas: predicted
and actual, with dead ends, backtracks and the point of abandonment marked. Plus the three scored
numbers side by side — predicted time vs. actual, predicted completions vs. actual, predicted
feature-finds vs. observed.

Shown **once, in full, at the end of a round**, not as a live dashboard. It is a confrontation, and it
works better as one.

### 3. The observer view

For live human sessions (RCK-007 supplies the sessions; this task supplies the watching):

- a live stream of the tester's screen, over the existing SSE ChangeBus — third consumer, no second tap
- **no chat, no annotation, no intervene affordance.** Absent, not disabled
- one button: **"I wanted to help here"**, with an optional two-word note captured *after* the press so
  pressing stays instant
- a live count of presses, visible to the observer and nobody else

### 4. Presses become findings

Each press produces an OPS-003 finding: the screenshot at that moment, the component path, what the
tester did next, and the note if there was one. Priority defaults from press density — three presses
within thirty seconds is one moment of significant confusion, not three findings.

This is the highest-signal finding source in the entire phase, because it is a human expert marking the
exact instant their design failed.

### 5. The debrief question

At session end, one question, recorded verbatim:

> **"What did you think this app was for?"**

Ninety percent of the eye-opening moments live in the gap between that answer and the pitch. Verbatim,
never summarised, never sentiment-scored, shown next to the builder's own one-line description of the
app.

### 6. It works for synthetic rounds too

The prediction is authored before a synthetic round as well — and that is deliberate. The builder's
first confrontation is with five archetypes, privately, and the prediction mechanism is what makes even
that round land. The observer view has no synthetic equivalent (there is nobody to bite your tongue at)
and simply does not appear.

## Implementation Steps

1. The prediction object, AI path proposal, immutability-per-round, versioning.
2. Diff payload into RCK-005's renderer; the three scored numbers.
3. Observer view over the SSE ChangeBus; verify latency is watchable, not a slideshow.
4. The button, the press record, the post-press note, the private count.
5. Presses → findings with density-based grouping.
6. The debrief question, verbatim capture, side-by-side display.
7. **Live pass**: Richard (or anyone who did not build the fixture) tests the QA fixture while someone
   watches through the observer view and uses the button for real. The press count and the resulting
   findings are the evidence this task works — a synthetic rehearsal cannot demonstrate it.

## Success Criteria

- [ ] A prediction is authored in four parts, AI-proposed and human-corrected.
- [ ] A prediction cannot be edited once its round has started — verified by trying.
- [ ] The diff renders both paths on one canvas with the three scored numbers.
- [ ] The observer view has **no** way to communicate with the tester — absent, not hidden.
- [ ] The help button records instantly; the note is optional and captured after.
- [ ] Presses become findings, grouped by density, with the screenshot and what happened next.
- [ ] The debrief answer is stored verbatim and displayed against the builder's own description.
- [ ] The observer stream is watchable in real time — measured, with the latency recorded.
- [ ] The full loop demonstrated with a **real human tester and a real observer**, screenshotted.

## Out of Scope

- **Recruiting, consent, the tester link.** RCK-007.
- **Remote unmoderated testing.** The observer view is for watching. Sessions with no observer are
  RCK-007's business and produce fewer findings by design.
- **Two-way audio or video of the tester.** Deliberately not built. It changes the consent story
  entirely and the value is in the screen and the presses.
- **Post-session surveys.** One question. Adding a form dilutes the one question and nobody fills it in.
- **Scoring the builder.** The prediction diff is a mirror, not a grade. No accuracy score, no history
  of how wrong they have been. That would be cruel and would stop people predicting honestly.

## Traps

- **An editable prediction is not a prediction.** The temptation to allow "just a small correction
  before we start" is enormous and it destroys the entire mechanism. Lock it at round start, version
  it, and make the lock visible.
- **The observer view will grow a chat box.** Someone will ask for it, reasonably, for remote sessions.
  It is the one feature that must never be added: the moment the builder can talk, they help, and the
  session is worthless. Write the reason into the code comment, not just here.
- **A slideshow stream is worse than no stream.** If the ChangeBus cannot carry it at a watchable rate,
  reduce fidelity (smaller frames, lower rate) rather than shipping something that arrives after the
  moment has passed. Measure it.
- **Press density grouping can hide a second defect** that happened to occur in the same window. Group
  for priority, keep the individual presses in the record.
- **The debrief answer will be summarised by someone.** Verbatim, always. The exact words are the
  finding — *"I think it's for booking gyms?"* is not improved by being tidied.
- **The prediction's feature checklist is the builder's ego on a page.** That is the point, and it also
  means the UI must not be smug about it. Present the diff plainly, without commentary, and let the
  numbers do it.
</content>
