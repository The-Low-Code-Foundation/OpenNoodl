# Phase 32 — Reality Check (Track Q)

**Created:** 2026-07-30
**Origin:** not the roadmap, and not the AI coding guide either. Richard's own experience coaching
entrepreneurs, stated in a scoping conversation on 2026-07-30.

## The observation that started it

> "Almost every entrepreneur project I've been involved in […] they haven't already got prospective
> clients waiting for the solution. I tell them they MUST get real users to test the app. They must
> sit beside them and watch them, not help them, and wait for the eye opening moments that blow their
> minds about how little users understand about the app they thought would be an instant, intrinsic
> success. […] Watch 20 users gloss over 90% of the features and not understand them or even get
> annoyed at them.
>
> It's an entrepreneur's worst nightmare, but by god does it separate the winning apps from the losers.
> […] I've been involved in probably 80% of failed projects where the entrepreneur has slunk off in
> shame and never recovered from the thrashing their app got when they released it without user
> testing."

Every other phase in this repo is about making NodeGX a better tool. This one is about the thing that
determines whether anything built with it succeeds — and it is the only phase whose subject is the
*user of the user's app*.

## The thesis

**Builders do not skip user testing because they think it is worthless. They skip it because of three
excuses, and all three are removable.**

| Excuse | What removes it |
|---|---|
| *"I don't know 5 people."* | Synthetic testers run with no recruiting at all — and, after that, a tester link and a brief that make recruiting five people a WhatsApp message rather than a study |
| *"Someone will steal my idea."* | The first round involves disclosing nothing to any human |
| *"It's embarrassing."* | The first thrashing happens privately, with no witnesses, from something that has no social standing to lose face in front of |

The third is the real one, and it is why the order matters. Having already been proven wrong once —
cheaply, privately, with evidence they cannot dispute — the ask *"now go and find five humans"* stops
being an identity threat and becomes the obvious next step. **The synthetic round is a psychological
on-ramp, not a substitute.** That framing is load-bearing and every task in this phase is constrained
by it.

## The mechanism: predict, then watch

Showing a builder a session replay does not work. They explain it away — *that user was tired, she's
not our demographic, he'd get it second time.* The confrontation fails because it is somebody else's
interpretation against their vision.

So the artefact is inverted. **Before any tester — synthetic or human — touches the app, the builder
records a prediction**, in the editor, on the canvas: the task, the path they expect through their own
components, how long it will take, and which features they are confident will be found and loved.

Then reality is recorded, and both are drawn on the same canvas.

Nobody argues with their own handwriting. And NodeGX can do this in a way nothing else can, because the
prediction and the reality are *the same artefact type* — a path through a graph it already owns.

## The four things NodeGX computes that nobody else can

1. **Prediction-vs-reality as a canvas diff.** Both are paths through components. AIX-003 already draws
   annotated components on a diff canvas; this is that primitive with a different payload.
2. **Feature coverage over the component tree.** *"Of your 34 screens, 6 were ever reached. Of your 112
   interactive elements, 19 were ever used."* Derived, not instrumented. This is the number that kills
   the world-changing feature nobody found, and the builder generated it themselves.
3. **Static coverage before anything runs.** Journeys map to components, so components touched by *zero*
   journeys are visible at design time — either dead weight, or the feature nobody drew a path to.
4. **Self-healing tests, from the edit rather than from a diff.** QA Wolf infers what broke by
   comparing runs. NodeGX knows, at edit time, that you just deleted the node a journey step points at
   — because the tool that changed the app owns the tests.

## Two layers, never conflated

This is the design decision that keeps the suite trustworthy:

| | **Journey replay** (RCK-002) | **Persona exploration** (RCK-003/004) |
|---|---|---|
| Determinism | deterministic | stochastic |
| Cost | cheap | expensive (vision inference per step) |
| Runs | on every graph change | on demand |
| Verdict | green / red | a report, never a pass |
| Purpose | **defends** what is known | **discovers** what is not |

The flywheel is between them: **exploration discovers, replay defends.** A persona gets stuck on the
date picker → that becomes a finding → the builder fixes it → the moment is *promoted* into a
deterministic journey step that runs forever after. Expensive discovery is paid once per defect and
hardens into a cheap permanent test.

Making persona runs a pass/fail gate would produce a flaky suite everyone learns to ignore. They are
never a gate.

## The other design decision: the persona must be blind

If a synthetic tester can read the DOM, it cheats. It sees `id="submit-booking"`, clicks it by
selector, and sails through an app that would baffle a human — a green suite that proves nothing,
which is the exact failure this phase exists to prevent.

**Perception is a screenshot. Action is a coordinate.** No accessibility tree, no selectors, no graph
knowledge, no component names. Internally a coordinate may snap to the nearest hit target so a run does
not die on a 3px miss, but the persona never *knows* a name. RCK-003 owns that wall and every later
task depends on it holding.

It is also what makes the most common real-world defect surface at all: *"I couldn't tell that was
clickable"* is unreachable for a DOM-driven test.

## The trap this phase must be designed against

Stated plainly because it is the likeliest outcome, not a hypothetical:

> **An entrepreneur runs 200 synthetic testers, gets all green, and declares victory without ever
> meeting a human.**

That is what they *want* to happen. Built carelessly, this phase becomes the most sophisticated excuse
machine ever shipped. Four structural defences, all mandatory, none of them optional politeness:

1. **The synthetic round can never satisfy the gate.** In OPS-001's ladder the item reads *"Reality
   Check — step 1 of 2."* Step 2 has a counter only human sessions increment. Passing step 1 brilliantly
   moves the badge from red to amber. Never green.
2. **Every report ends with what personas cannot tell you** — a standing, non-dismissible section:
   *would anyone pay, would anyone come back, do they trust you with their card, would they bother?*
   Personas are agreeable; they complete tasks because they were told to. A persona never gets bored
   and closes the tab, which is the most common real-user behaviour there is.
3. **The artefact is framed as readiness for humans, not for launch.** The headline sentence is
   ***"your app is now worth five people's time"*** — true, motivating, and pointing at the door.
4. **The recruiting kit is unlocked by the synthetic round**, not gated behind it. Reward, not toll.

## Task table

| Order | ID | Title | Tier | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|---|---|
| 1 | [RCK-001](./RCK-001-JOURNEYS.md) | User journeys as first-class objects | 1 — the model | 🔴 Critical | 1.5–2 wks | none | 🔵 Fable 5 |
| 2 | [RCK-002](./RCK-002-JOURNEY-REPLAY.md) | Deterministic journey replay | 1 — the model | 🔴 Critical | 2–2.5 wks | RCK-001 | 🟠 Opus 4.8 |
| 3 | [RCK-003](./RCK-003-BLIND-DRIVER.md) | The blind driver — screenshot in, coordinate out | 2 — synthetic | 🔴 Critical | 1.5–2 wks | RCK-002 (the harness) | 🔵 Fable 5 |
| 4 | [RCK-004](./RCK-004-PERSONAS.md) | The persona set & the run harness | 2 — synthetic | 🔴 Critical | 2–2.5 wks | RCK-003, OPS-009 | 🔵 Fable 5 |
| 5 | [RCK-005](./RCK-005-SESSION-RECORD.md) | The session record & the report | 2 — synthetic | 🟠 High | 1.5–2 wks | RCK-004, OPS-003 | 🟠 Opus 4.8 |
| 6 | [RCK-006](./RCK-006-PREDICTION-AND-OBSERVER.md) | The prediction artefact & the observer view | 3 — humans | 🔴 Critical | 1.5–2 wks | RCK-001, RCK-005 | 🔵 Fable 5 |
| 7 | [RCK-007](./RCK-007-HUMAN-TESTING-KIT.md) | The human testing kit — link, consent, briefs | 3 — humans | 🔴 Critical | 2–2.5 wks | RCK-006 | 🟠 Opus 4.8 |
| 8 | [RCK-008](./RCK-008-THE-GATE.md) | The Reality Check gate & calibration | 4 — the gate | 🔴 Critical | ~1 wk | RCK-005, RCK-007, OPS-001 | 🔵 Fable 5 |

Serial worst case ~14 weeks; realistic with parallelism ~9–10. This is the largest of the two new
phases and the tiers are genuine stopping points.

**Tier 1 alone is worth shipping.** Journeys plus deterministic replay give NodeGX something it has
never had — a regression suite that survives graph edits — with no AI involved at all.

## The decisions this phase starts from

| Decided | Decision | Why |
|---|---|---|
| 2026-07-30 | **The synthetic round is required before human sessions can be logged, and the whole gate is overridable.** | Required-within-the-gate keeps the on-ramp in the right order; an overridable gate keeps NodeGX from being paternalistic. Both, not one. |
| 2026-07-30 | **Personas are blind. Perception is pixels.** | A DOM-reading tester produces a green suite that proves nothing. This is not negotiable and RCK-003 owns the wall. |
| 2026-07-30 | **A small archetype set, not a synthetic crowd.** Default run = 5, ceiling = 12. | Richard: *"the user doesn't need 200 personalities, they're building an app for one or two ICPs trying to solve their one or two pain points."* Archetypes vary *behaviour*, and demographics are a parameter on top — a hundred personas is a focus group nobody asked for and a bill nobody expected. |
| 2026-07-30 | **Persona runs are never a pass/fail gate.** | Stochastic. Making them a gate produces a flaky suite that gets ignored, which loses the deterministic layer too. |
| 2026-07-30 | **Consent and PII masking are built from the first commit of RCK-007, not added at Scale.** | It is the only part of either phase that can go legally wrong rather than merely badly. |
| 2026-07-30 | **No anti-gaming machinery.** | Someone will test with their mum. Detect the obvious, then say plainly in the UI that this gate only protects you from yourself. Engineering against it costs more than it saves and insults everyone using it honestly. |
| 2026-07-30 | **Not a testing marketplace.** | Scope is observing *your own* recruits. No panel, no paid testers, no incentives. The moment it is two-sided it stops being a NodeGX feature. |

## Relationship to other phases

| Phase | Relationship |
|---|---|
| **31 — Readiness & Operations** | **Hard dependency.** RCK-008 is a rung on OPS-001's ladder; every finding in this phase is an OPS-003 finding; RCK-004 must not ship before OPS-009's budget meter. |
| **15 — AI Collaboration** | AIX-002's update mode turns a finding into a reviewable graph change — the fix half of the loop. AIX-003's annotated diff canvas is the drawing primitive for RCK-006. |
| **16 — Runtime & Deploy Health** | SUB-009's headless-export recipe and RUN-001's CDP corpus harness are the driver's ancestors. RUN-003's file records the live-editor CDP traps. |
| **22 — Production Backend** | BAK-001's SSE ChangeBus streams a live session to the observer view. Third consumer; no second tap. |
| **26 — Deployment** | RCK-007's tester link needs a real URL. DEP-002/DEP-003 provide it. Without them, sessions run against preview only — smaller, still useful. |
| **17 — Noodl Learn** | *"Ask one person to try it without telling them anything"* is arguably the most valuable lesson in the curriculum. LEARN gets the idea and none of the gating — Playing level sees nothing from this phase. |
| **20 — Ecosystem** | ECO-004's hosted platform would be the natural home for a shared persona library. Explicitly out of scope until G3 resolves. |
</content>
