# OPS-009: Authoring Budget & Circuit Breakers

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OPS-009 |
| **Phase** | Phase 31 — Readiness & Operations (Track P) |
| **Tier** | 4 — the narrative |
| **Priority** | 🟡 Medium — until Phase 32's persona runs land, at which point it is High |
| **Difficulty** | 🟢 Low–Medium |
| **Estimated Time** | 4–6 days |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** — the design is settled by the source chapter; this is instrumentation |

## Objective

A user can see what AI assistance is costing them, cap it, and cannot be surprised by it — before
Phase 32 makes it possible to spend real money in a single click.

## Background

The [token-economics chapter](../../../../ai-coding-docs/docs/part-5/token-economics.md) documents where
spend actually comes from — re-sent context per turn, not "AI thinking" — and names four canonical
leaks: open tabs, missing `.clineignore`, **polling loops**, and sub-agent fan-out. Its remedies are
mostly circuit breakers: hard stop after 3 failures, Plan-mode default, a max-requests-per-task cap,
auto-approve off.

The chapter's cautionary tale is a $30 polling loop during a deploy, which the deployment chapter then
designed the non-polling deploy pattern around.

Two facts make this task current rather than theoretical:

1. **Phase 15's live-provider pass ended with the Anthropic key out of credit.** The failure mode is
   not hypothetical here; it has already happened once in this project's own development.
2. **Phase 32 introduces a button that spawns a fleet.** A persona run is vision-model inference over
   dozens of screenshots, multiplied by personas, multiplied by re-runs after every fix. Shipping that
   without a meter would be irresponsible.

## Current State

| Piece | State |
|---|---|
| AI client | AIX-001 — provider-agnostic, registry capabilities not model ids |
| Authoring loop | AIX-002 — whole-candidate + diff review |
| Cost visibility | none |
| Caps | none |
| Retry behaviour | per-call; no cross-attempt awareness |

## Desired State

### 1. A meter

Per-project cumulative spend and per-operation spend, in the currency the provider reports, shown where
AI work is initiated (the AI authoring panel, and Phase 32's run launcher). Not buried in settings.

Where a provider does not report cost, report tokens and say that cost is unavailable — never
extrapolate a price and present it as fact.

### 2. A cap that actually stops

An optional per-project budget. On reaching it, AI operations stop and say so. Not a warning banner —
a stop, with a one-click raise.

The distinction matters because the person this protects is the hobbyist who left something running,
and a banner is exactly what they will not be looking at.

### 3. Circuit breakers

Lifted from the chapter, applied to our loop:

- **Hard stop after 3 failed attempts** at the same operation. The fourth attempt is a human decision.
  This is also the project-memory chapter's self-audit trigger — worth pointing at OPS-008's
  `query_context` when it fires, rather than just stopping.
- **A per-operation request ceiling**, so one runaway generation cannot consume a budget silently.
- **No polling.** Any long-running AI or deploy operation is event-driven. WFA-002 already found a
  30-second supervisor request ceiling that makes a long run read as a failure; polling around it would
  be the exact leak the chapter names.

### 4. Estimate before spending, where the shape is known

Phase 32's runs have a knowable shape — personas × journeys × steps. Show an estimate before the run
and the actual after, and record both. Two or three runs in, the estimate is calibrated and the user
can size their own runs. This is what makes a fleet feature safe to offer.

### 5. It is not a readiness item

Cost is not a maturity concern; a Playing-level project can burn credit as easily as a Scale one. The
meter and the cap are always available and never on the ladder.

## Implementation Steps

1. Cost/token accounting in AIX-001's client, per operation, attributed to a project.
2. The meter, in the authoring panel.
3. The budget cap and the stop.
4. The three-failure breaker, wired to suggest a `query_context` lookup.
5. Per-operation request ceiling.
6. Estimate/actual for shaped runs, with recorded history.
7. **Live pass**: set a small budget, run generations until it stops, confirm the stop is a stop and
   the raise works.

## Success Criteria

- [ ] Per-project and per-operation spend visible where work starts.
- [ ] A budget cap stops operations; verified by hitting it.
- [ ] Providers that do not report cost show tokens and say cost is unavailable.
- [ ] Three failed attempts at one operation halt and suggest a next step rather than retrying.
- [ ] No polling loop exists in any AI or deploy path — audited, listed in `OPS-009-NOTES.md`.
- [ ] A shaped run shows an estimate beforehand and an actual afterwards, both recorded.

## Out of Scope

- **Billing, invoicing, or reselling inference.** The user brings their own key.
- **Model selection heuristics.** AIX-001's registry decides capability; cost-based routing is a
  separate argument.
- **Context-window optimisation.** Real, and a different task — this one measures and stops.
- **`.clineignore`-equivalent.** Our context comes from the graph, not a file tree.

## Traps

- **Provider cost reporting is inconsistent and changes.** Store the raw usage figures alongside any
  derived cost, so a pricing change does not invalidate the history.
- **A cap that only warns is not a cap.** The failure this prevents is someone discovering the spend
  afterwards, at which point a banner they did not read is worse than nothing.
- **The three-failure rule must count *the same operation*, not any failure.** Counting globally makes
  it fire during unrelated work and it gets switched off.
- **Estimates become promises.** Present a range, show the recorded actuals next to it, and never round
  down.
- **Phase 32 is the real consumer.** If this task ships after RCK-004, the fleet ships unmetered. Order
  matters more than the priority tag suggests.
</content>
