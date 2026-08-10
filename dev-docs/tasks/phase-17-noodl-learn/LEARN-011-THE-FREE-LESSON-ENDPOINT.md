# LEARN-011 — The free lesson endpoint

**Phase:** 17 (Track E) · **Status:** 🟠 **STUB — decided, not specced** (2026-08-09)
**Priority:** deferred — depends on [LEARN-010](./LEARN-010-THE-RUN-AND-VERDICT.md)'s verdict
**Origin:** Richard, 2026-08-09, answering the generated-lessons open questions:

> *"It would be great if we could find a cheap model on DeepInfra or equivalent that can handle it,
> then offer it to people using NodeGX for free using a Github secret or whatever the fuck to make
> the LLM request for them and return the lesson choices, objectives, whatever to their editor free
> of charge and without using their own API key (so anyone can do it without any hindrance)."*

⚠️ **This document records a decision and its constraints. It is not a task spec** — no slices, no
criteria, no file:line research. Nothing here has been read in source. Do not work from it; spec it
first.

## What was decided

Generated lessons ([EXPERIMENT-GENERATED-LESSONS.md](./EXPERIMENT-GENERATED-LESSONS.md)) reach the
learner through **a hosted endpoint we pay for**, not through the learner's own API key. A beginner
opening the Learn tab gets a personalised lesson with no account, no key, no billing setup.

## Why it matters beyond convenience

It is the difference between two audiences. §3.8 of the experiment doc named the consequence
plainly: *a BYO-key product cannot serve a classroom.* Every teenager needing an API key is every
teenager not doing the lesson, and the 13–17 band is half of
[CURRICULUM-DESIGN](./CURRICULUM-DESIGN.md) D1. This endpoint is what keeps that audience reachable.

## The three things that will decide whether it is cheap or awful

1. **A GitHub secret is not a runtime secret.** Anything shipped inside the Electron app is readable
   by anyone who installs it — this is the same class as
   [FH-018](../phase-42-first-hour/FH-018-THE-CONFIG-NODE-IS-INERT-AND-ITS-ENDPOINT-IS-PUBLIC.md)
   (inert config node, public endpoint) and
   [FH-024](../phase-42-first-hour/FH-024-THE-LOCAL-ADMIN-API-IS-CROSS-ORIGIN-READABLE.md) (loopback
   is not a trust boundary). The key lives behind a small service the editor calls. **That is a
   service to run, monitor, rate-limit and pay for** — an operational commitment, not a config value.
2. **An unauthenticated free endpoint is an unauthenticated free endpoint.** Someone will point a
   script at it. Whatever the answer is (per-install token, rate limit, daily cap, proof-of-work,
   an allowance that degrades to BYO-key), it is part of the spec and not an afterthought.
3. **The model choice is a measurement, not a preference.** [LEARN-010](./LEARN-010-THE-RUN-AND-VERDICT.md)
   produces a defect rate against whatever model generated. A frontier model passing tells you
   nothing about a cheap one, and a cheap model is the entire point of this task. **Run the
   experiment on the model you intend to ship, or run both and report the gap** — otherwise the
   number that justified generation was measured on a product we are not shipping.

## Sequencing

Do not spec this until LEARN-010 returns a go. If generation is a no-go, this task dies with it —
authored lessons need no endpoint at all.

## Related

- [EXPERIMENT-GENERATED-LESSONS.md §9](./EXPERIMENT-GENERATED-LESSONS.md) — where this decision is
  recorded in context
- [ECO-004](../phase-20-ecosystem/ECO-004-HOSTED-PLATFORM.md) — the only other place the project
  contemplates running a service; check for overlap before speccing
- [CURRICULUM-DESIGN.md §2](./CURRICULUM-DESIGN.md) — the audience this protects
