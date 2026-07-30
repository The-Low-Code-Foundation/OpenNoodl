# RCK-004: The Persona Set & the Run Harness

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RCK-004 |
| **Phase** | Phase 32 — Reality Check (Track Q) |
| **Tier** | 2 — synthetic |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟠 Medium–High |
| **Estimated Time** | 2–2.5 wks |
| **Prerequisites** | RCK-003; **OPS-009 (budget) must land first in practice** |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — the archetype set and the intent-generation rules are the product; the harness around them is ordinary |

## Objective

A small set of behavioural archetypes attempt a journey's *goal* — blind, with an intention generated
at run time and no knowledge of how the app works — and the run is bounded, budgeted and repeatable.

## Background

Richard's constraint, which shapes the whole task:

> "The user doesn't need 200 personalities, they're building an app for one or two ICPs trying to solve
> their one or two pain points, and you maybe need a few personalities: the lazy one, the motivated
> one, the technophobe, the technophile, the hacker who wants to break things for fun, etc."

That is right, and it is worth being precise about *why*, because the instinct to generate a crowd is
strong. A hundred synthetic personalities is a focus group nobody asked for and a bill nobody expected.
The variance that matters for finding usability defects is **behavioural**, not demographic: how much
patience someone has, whether they read, whether they explore or follow, whether they are trying to
break it. Two people with different jobs and the same behaviour find the same defects.

So: archetypes vary behaviour. Demographics, device and prior knowledge are *parameters* on top, set by
the builder to match their ICP.

The honest position on what this produces, which RCK-005's report must carry and this task must not
oversell: LLM personas are good at finding dead ends, missing affordances, ambiguous labels, broken
flows and unclear value propositions. They are poor at predicting whether someone will *bother*,
aesthetic reaction, trust, and price sensitivity. **A persona never gets bored and closes the tab**,
which is the single most common real-user behaviour there is.

That limitation is not a flaw to engineer away. It is the argument for the human round, and it maps
exactly onto Richard's coaching problem: the synthetic round clears the mechanical rubble so the five
human sessions are spent on the questions only humans can answer.

## Current State

| Piece | State |
|---|---|
| Blind driver | RCK-003 — screenshot in, coordinate out, step counters exposed |
| Journeys | RCK-001 — a goal, and steps the persona never sees |
| AI client | AIX-001 — provider-agnostic; vision capability required |
| Budget | OPS-009 — meter, cap, estimate-before-run |
| Phase 15 warning | the live-provider pass ended with the Anthropic key out of credit |

## Desired State

### 1. Six archetypes, shipped, editable

Behavioural, not demographic. Richard's five plus one:

| Archetype | Behaviour that produces findings |
|---|---|
| **The motivated one** | genuinely wants the outcome; persists through friction. Establishes whether the flow is *possible* |
| **The lazy one** | takes the shortest apparent path; abandons at the first ambiguity. Finds anything that requires effort to discover |
| **The technophobe** | hesitant, re-reads, fears irreversible actions, backs out when unsure. Finds missing reassurance and unclear consequences |
| **The technophile** | fast, uses keyboard, opens things in parallel, expects conventions. Finds broken affordances and non-standard patterns |
| **The breaker** | curious and adversarial *within the UI* — empty forms, silly values, back button mid-flow, double submits. Finds validation and state bugs |
| **The scanner** | reads headings and buttons only, never body text. **Finds the most, because this is what real users do** |

The scanner is the addition and it should be in every default run. The single most reliable way to
reproduce the *"20 users ignored the feature I built the company around"* experience is a persona
instructed not to read the paragraph explaining it.

Archetypes are data, editable and extensible by the builder, with the six as defaults.

### 2. Parameters on top

Set per run, to match the ICP rather than to manufacture diversity:

- **device** — desktop, or a phone at a real viewport with touch-shaped targets
- **prior knowledge** — never used anything like this / uses two competitors daily
- **language** — including non-native reader
- **accessibility** — low vision (affects legibility of the same screenshot), low numeracy
- **entry context** — how they arrived and what they were told, which feeds §3

### 3. Intent is generated at run time, never scripted

The persona receives the journey's **goal** and an entry context, and nothing else:

> *"A friend mentioned this app helps you find a coach. You want to book something for next week. You
> have five minutes."*

It does not receive the steps, the component names, or the affordances. Working out what to do is the
test. This is what Richard meant by *"no knowledge of how it works, just an intention generated at
testing time."*

Intents are generated from the goal plus the archetype, and **recorded**, so a run is reproducible in
its setup even though its execution is not.

### 4. Bounded runs

| Bound | Default | Why |
|---|---|---|
| personas per run | **5** | one per archetype, minus one; enough for signal, cheap enough to re-run after a fix |
| ceiling | **12** | a hard cap; beyond this you are buying variance, not information |
| steps per session | ~40 | a persona that has not achieved the goal in 40 steps has produced its finding |
| wall-clock per session | bounded | a stuck persona must end, and ending is a result |
| spend | OPS-009's estimate + cap | shown **before** the run, recorded after |

A run that hits a bound reports *why* it stopped. "Abandoned after 40 steps without reaching checkout"
is a finding, not an error.

### 5. Repeatability without determinism

The same run configuration can be re-run after a fix — same archetypes, same parameters, same goals,
newly generated intents. What is compared across runs is *outcomes*, not traces. RCK-005 owns the
comparison; this task must record enough to make it possible.

### 6. It is never a gate

No persona run produces a pass. The run produces a report. This is stated in the harness's own output
and enforced by there being no green state to render.

## Implementation Steps

1. The archetype model, the six defaults, and the editing surface. Write the behavioural descriptions
   carefully — they are prompts and they are the product.
2. Parameters, including honest device viewports.
3. Intent generation from goal + archetype + entry context; recording.
4. The run harness over RCK-003's blind driver: scheduling, concurrency, bounds.
5. OPS-009 integration — estimate before, actual after, cap enforced.
6. Stop-reason recording for every bound.
7. **Live pass**: run all six archetypes against the QA fixture on one journey, then deliberately break
   an affordance (make a button look like text) and confirm the scanner and the lazy one fail where the
   motivated one grinds through. If all six behave identically, the archetypes are decorative and the
   task is not done.

## Success Criteria

- [ ] Six archetypes ship, are editable, and **demonstrably behave differently** on the same journey —
      evidenced by the broken-affordance experiment, not by inspection of the prompts.
- [ ] The scanner archetype finds something the motivated one does not.
- [ ] Intent is generated at run time from the goal and recorded; steps are never in the persona's
      context (RCK-003's leak test still passes during a real run).
- [ ] Default run = 5 personas; the ceiling of 12 is enforced.
- [ ] Every bound produces a recorded stop reason.
- [ ] Cost is estimated before the run and recorded after; the cap stops a run mid-flight.
- [ ] There is no state in which a persona run renders as a pass.

## Out of Scope

- **The report.** RCK-005.
- **Demographic persona generation.** Explicitly rejected — behaviour is the variance that matters, and
  synthetic demographics invite conclusions the method cannot support.
- **A persona marketplace or shared library.** ECO-004 territory, gated on G3.
- **Personas that read documentation or watch an onboarding video.** A second information channel is a
  different experiment; the goal-plus-context brief is the whole input.
- **Multi-session personas** (a returning user, day two). Genuinely interesting, needs state modelling,
  not now. Record it as a follow-up.

## Traps

- **Archetypes that are prompts in name only.** The failure mode is six labels producing one behaviour.
  The broken-affordance experiment is the test that catches it and it belongs in the success criteria
  for exactly that reason.
- **Personas are agreeable and will complete tasks they should abandon.** They were told to do it. Bake
  abandonment into the lazy and technophobe archetypes explicitly, and treat *"it kept going"* as weak
  evidence rather than success.
- **Cost compounds silently across re-runs.** Five personas × three journeys × forty steps × a fix cycle
  is the shape that empties a key. OPS-009 must be in place, not planned.
- **The breaker archetype must stay inside the UI.** Silly values, double submits, back mid-flow — not
  request forgery, not probing endpoints. Security testing is OPS-006 and its out-of-scope note; a
  persona that starts attacking is a different feature with a different authorization story.
- **A blind persona will get stuck in scroll loops** (RCK-003's trap). The step bound is what makes that
  survivable; do not solve it by giving the persona scroll position.
- **Reproducibility will be over-promised.** The setup is reproducible; the run is not. Say so in the
  UI, or the first time two runs differ the user will report it as a bug.
- **Phase 15's key ran out of credit during a live pass.** Budget the live pass for this task
  explicitly before starting it.
</content>
