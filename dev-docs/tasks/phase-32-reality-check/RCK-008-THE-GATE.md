# RCK-008: The Reality Check Gate & Calibration

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RCK-008 |
| **Phase** | Phase 32 — Reality Check (Track Q) |
| **Tier** | 4 — the gate |
| **Priority** | 🔴 Critical — without it the phase is a very good feature nobody uses at the right moment |
| **Difficulty** | 🟡 Medium — small code, and every line of it is a judgement call |
| **Estimated Time** | ~1 wk |
| **Prerequisites** | RCK-005, RCK-007, OPS-001 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — the numbers and the wording *are* the feature |

## Objective

Deploying to strangers requires having watched somebody use the app and changed something because of
it — enforced honestly, overridable openly, and structured so that passing the synthetic half increases
the pressure to do the human half rather than relieving it.

## Background

Richard's account of why this matters is the origin of the phase:

> "I've been involved in probably 80% of failed projects where the entrepreneur has slunk off in shame
> and never recovered from the thrashing their app got when they released it without user testing."

The nearest existing precedent is Google Play's closed-testing requirement — a fixed number of testers
over a fixed period before production access. It is widely resented and it works, and the resentment is
instructive: a gate with an arbitrary duration and no visible purpose produces compliance theatre. This
gate must be about *evidence*, not elapsed time.

The design constraint that overrides everything else in this task is the trap named in the phase
README:

> An entrepreneur runs 200 synthetic testers, gets all green, and declares victory without ever meeting
> a human.

That is the outcome they *want*. Built carelessly, this phase becomes the most sophisticated excuse
machine ever shipped. This task is where that is prevented or not.

## Current State

| Piece | State |
|---|---|
| The ladder | OPS-001 — declared levels, a registry, `ReadinessState`, deploy acknowledgements |
| Synthetic rounds | RCK-004/005 — reports, coverage, findings, run comparison |
| Human rounds | RCK-006/007 — predictions, observed sessions, rounds |
| Deploy interlock precedent | OPS-006 (critical security findings) and BAK-003's dev-open interlock |

## Desired State

### 1. Two steps, and the first can never satisfy the gate

Registered on OPS-001's ladder at **Live** as one item with two visible parts:

> **Reality Check — step 1 of 2**

| Step | Requirement | Satisfied by |
|---|---|---|
| **1 — Rehearsal** | a synthetic round completed, with a prediction recorded before it, and its findings triaged | RCK-004/005/006 |
| **2 — Contact** | **5** human sessions, by people not on the team, across **two rounds**, with a change made between them | RCK-007 |

Step 1 turns the badge from red to **amber**. Never green. There is no state in which synthetic results
alone produce a satisfied gate, and this is enforced by the readiness item's own logic, not by copy.

### 2. The numbers, and the reasoning for each

| Number | Value | Why |
|---|---|---|
| Human sessions | **5** | the long-standing usability finding that five participants surface most problems. It is also a number a person can actually get |
| Rounds | **2** | *this is the load-bearing one.* Round one is the thrashing; round two is where the winners separate. A gate satisfied by round one rewards the experience without the response |
| Change between rounds | **≥1 finding resolved** | evidence of response, not of effort |
| Fresh testers in round two | **≥3 of 5** | a tester who has seen it before cannot be confused by it again |
| Time | **none** | deliberately no duration requirement. Google's fourteen days produces compliance theatre; evidence is the requirement |
| Synthetic personas | 5 (RCK-004's default) | enough for the rehearsal to be meaningful |

All configurable, with these as defaults. A builder who wants a stricter gate should be able to set one.

### 3. Overridable, and permanently honest about it

Consistent with OPS-006 and with the phase's refusal to be paternalistic:

- override is one click away and requires the reason typed, not chosen
- it is recorded on the artifact (OPS-002 `acknowledgements`)
- the Ops panel shows **"Deployed without a Reality Check"** indefinitely — not a toast, not
  dismissible, until the gate is actually satisfied
- the override is never hidden, never shameful in wording, and never repeated as a nag

The people who override were going to fail anyway. The ones on the fence are moved by a line of text
that does not go away.

### 4. The reward, not the toll

The recruiting kit (RCK-007 — the tester link, the briefs, the observer script) **unlocks on completing
step 1**. Passing the rehearsal hands you the tools for the real thing, at the moment you have just
been proven wrong and are most willing to use them.

This is the opposite of gating the kit behind the gate, and it is the single most important interaction
choice in the task.

### 5. The wording

Three strings that carry the phase and should be hard to change casually:

| Moment | Wording |
|---|---|
| After step 1 | **"Your app is now worth five people's time."** |
| Gate state at amber | *"Rehearsed. Not yet tested by anyone who doesn't know you."* |
| On satisfying step 2 | states what was *learned* — findings resolved, coverage change, prediction accuracy — never "passed" |

No score, no badge, no certificate. The gate's satisfied state is a list of what happened.

### 6. Calibration — what makes this an instrument

Once a project has done both rounds, compare them: where did personas over-call confusion, where did
they sail through something that stopped every human, which archetype best matched real behaviour.

Stored per project, and — with explicit opt-in — aggregable later. This is what turns the synthetic
layer from a plausible simulation into a calibrated one, and it lets the product eventually say things
like *"our personas systematically under-call trust and pricing friction"* with data rather than
honesty-by-disclaimer.

Ship the per-project half. The aggregate half needs a privacy story and a home (ECO-004) and is
explicitly not in this task.

### 7. LEARN sees none of it

Playing level shows nothing from this phase. If LEARN-002's curriculum chooses to teach *"ask one person
to try it without telling them anything"* — and it should — that is a lesson, not a gate.

## Implementation Steps

1. The readiness item with two parts, and the enforcement that step 1 cannot satisfy it.
2. The counters: human sessions, non-team attestation, rounds, findings resolved between rounds, fresh
   testers.
3. Override: typed reason, artifact record, permanent Ops-panel statement.
4. Unlocking the recruiting kit on step 1.
5. The three strings, and a test that the satisfied state contains no pass/score vocabulary.
6. Per-project calibration.
7. **Live pass**: take the QA fixture through the whole thing — prediction, synthetic round, triage,
   five human sessions across two rounds with a real fix in between — and confirm the gate transitions
   red → amber → satisfied for the right reasons. This is a multi-day exercise involving real people and
   it is the phase's exit criterion, not a formality.

## Success Criteria

- [ ] Step 1 alone can never satisfy the gate — verified by trying to force it.
- [ ] The five counters are correct, including the fresh-tester requirement in round two.
- [ ] Override requires typed text, is recorded on the artifact, and shows permanently in the Ops panel.
- [ ] The recruiting kit unlocks on step 1 completion.
- [ ] The satisfied state contains no score, badge or "passed" — asserted by a test.
- [ ] Per-project calibration compares a synthetic round against a human round.
- [ ] Nothing from this phase is visible at Playing level.
- [ ] **The full loop has been run once, for real, with real humans**, and written up in
      `RCK-008-NOTES.md`.

## Out of Scope

- **Aggregate/cross-project calibration.** Needs a privacy story and a home; ECO-004, gated on G3.
- **Any gate below Live.** Sharing does not require this. Showing a friend a link is not shipping.
- **Certification, badges, or public proof.** *"Reality Checked"* as a marketing badge would be gamed
  within a month and would corrupt the honest signal.
- **Enforcing this on projects that do not deploy through NodeGX.** Someone exporting a folder and
  hosting it themselves is outside the gate by construction. Say so plainly rather than pretending.
- **Anti-gaming machinery.** Phase decision. Detect the obvious, state the honest sentence, move on.

## Traps

- **The excuse machine is the default outcome, not the edge case.** Every design pressure in this task
  — from users, from demos, from the desire for a satisfying green tick — points at letting synthetic
  results count. The two-step structure and the amber state are the defences and they must not be
  weakened for a release deadline.
- **Numbers will be negotiated down.** Five sessions, two rounds, three fresh testers. Each looks
  arbitrary in isolation and each has a reason above. The one that will be attacked first is *two
  rounds*, because it doubles the work — and it is the one that carries the outcome Richard is
  describing. Defend it.
- **A time requirement will be proposed** as a proxy for seriousness. Refuse it. Google's version
  produces people running the clock, and elapsed time is evidence of nothing.
- **The override will drift into a nag.** One permanent line in one place. A repeated modal turns a
  reasonable position into an adversarial one and gets the whole gate resented.
- **The wording will be softened.** *"Not yet tested by anyone who doesn't know you"* is uncomfortable
  and it is supposed to be. A friendlier phrasing that says the same thing less clearly is a downgrade.
- **The live pass involves real people and will be the thing that slips.** It cannot be substituted with
  synthetic sessions — the phase's entire claim is that the two are different, and a gate validated only
  against personas would be the joke version of this task.
</content>
