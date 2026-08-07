# Phase 32 — Progress

**Track Q — Reality Check**

**All 8 tasks specced as of 2026-07-30. None started.**

| Task | Tier | Status | Notes |
|---|---|---|---|
| RCK-001 User journeys as first-class objects | 1 | 📋 Specced | **The durable half of the phase.** Worth building even if the persona layer were cut — journeys give static coverage, a regression suite and self-healing tests from the edit rather than from a diff |
| RCK-002 Deterministic journey replay | 1 | 📋 Specced | Assembles SUB-009's shims + RUN-001's CDP harness + AIX-008's export seam. Flake rate must be *measured*, not asserted |
| RCK-003 The blind driver | 2 | 📋 Specced | The epistemic wall. DOM/ids/names **absent, not filtered**, with a nonsense-token leak test in CI |
| RCK-004 The persona set & run harness | 2 | 📋 Specced | Six behavioural archetypes; default run 5, ceiling 12. **Do not start before OPS-009's budget meter lands** |
| RCK-005 The session record & the report | 2 | 📋 Specced | Coverage number + three promoted finding shapes + the non-dismissible limitations section |
| RCK-006 Prediction & observer view | 3 | 📋 Specced | The mechanism the phase is built on. Immutable-once-started prediction; the "I wanted to help here" button |
| RCK-007 The human testing kit | 3 | 📋 Specced | Consent and masking built **first**, not last. The only part of either phase that can go legally wrong |
| RCK-008 The gate & calibration | 4 | 📋 Specced | Two steps; synthetic can never satisfy it. The numbers and the wording are the feature |

## The exit criterion

The phase is done when this has happened once, for real, on the QA fixture, and been written up:

1. A prediction is recorded — path, time, completion rate, features expected to be found.
2. Five archetypes run blind against the app; the report lands; the coverage number is read.
3. At least one finding is fixed through AIX-002 and a re-run shows it resolved.
4. The recruiting kit unlocks; five real humans test on their own devices; at least two are observed
   through the observer view with the help button used in anger.
5. A change is made; round two runs with three fresh testers.
6. The gate transitions red → amber → satisfied, for the right reasons, and the prediction diff is
   shown to whoever authored it.

Step 4 cannot be substituted with synthetic sessions. The phase's entire claim is that the two are
different.

## Open questions for Richard

| # | Question | Why it is his call |
|---|---|---|
| 1 | **The archetype set.** Six proposed: motivated, lazy, technophobe, technophile, breaker, scanner. The scanner (reads headings only, never body text) is the addition — the spec argues it will find the most. | These are the product. He has watched real users do this; the descriptions should be his. |
| 2 | **Two rounds, or one?** RCK-008 requires two human rounds with a change between them, on the argument that round two is where the winners separate. It doubles the work and is the number most likely to be negotiated down. | It is his coaching claim; the spec is arguing his own position back at him and he should confirm it. |
| 3 | **Five human sessions — right number?** Five is the classic usability figure and a number people can actually reach. His experience says twenty is when the belief breaks. | The gate has to be achievable or it is theatre. Trade-off is his. |
| 4 | **"Your app is now worth five people's time."** The step-1 headline. | Product voice, and it carries the whole anti-excuse-machine framing. |
| 5 | **Does the gate apply to folder exports?** Currently no — someone exporting and self-hosting is outside it by construction, stated plainly rather than pretended. | It is the honest position, but it is also the obvious loophole. |

## Decisions already taken

Recorded in [README.md](./README.md): synthetic-required-then-human, blind personas, a small archetype
set rather than a crowd, persona runs never a gate, consent and masking from the first commit, no
anti-gaming machinery, and not a testing marketplace.

## Dependencies that will bite

| On | Why it matters |
|---|---|
| **OPS-003** (findings store) | Every finding in this phase is an OPS-003 finding. There is no fallback; RCK-005 has nowhere to write without it |
| **OPS-001** (ladder) | RCK-008 is a rung on it. The gate has no home otherwise |
| **OPS-009** (budget) | RCK-004 ships a button that spawns a fleet. Phase 15's live-provider pass already ended with a key out of credit |
| **AIX-002** (authoring loop) | The fix half of the loop. Without it, findings are a list rather than a cycle |
| **AIX-003** (diff canvas) | RCK-005/006's prediction diff is that primitive with a different payload |
| **BAK-001** (SSE ChangeBus) | The observer stream. Third consumer — do not add a second tap |
| **DEP-002/003** | A real URL for the tester link. Without them, sessions are preview-only — smaller, still useful |

## Notes for whoever starts

- **Tier 1 ships alone and is worth it.** Journeys plus deterministic replay give NodeGX a regression
  suite that survives graph edits, with no AI involved. If the phase stalls, that is a good place to
  stop.
- Read RUN-003's CDP notes and the editor-driving traps before writing any driver code. `--target=editor`
  attaches to the *preview* window; launch detached; never `cdp reload`; HMR breaks the webpack probe.
- The QA fixture (not the agent-chat example) is the subject for every live pass. Editor launch rewrites
  the example project on open and on shutdown.
- Three tasks have live passes that need a human who did not build the fixture: RCK-004's
  broken-affordance experiment, RCK-006's observer session, and RCK-008's full loop. Schedule them;
  they are not desk work.
</content>
