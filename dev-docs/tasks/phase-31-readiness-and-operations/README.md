# Phase 31 — Readiness & Operations (Track P)

**Created:** 2026-07-30
**Origin:** not the roadmap. Richard read his own [AI coding guide](https://github.com/) — the
`ai-coding-docs` methodology he wrote for people building apps with Cline and Claude Code — and asked
what of it belongs *inside* NodeGX.

## The observation that started it

Read the guide's Part 5 back to back and a pattern falls out that the guide itself half-names in
[The Project Brain](../../../../ai-coding-docs/docs/part-5/project-brain.md):

> "n8n showed you the actual workflow graph. You didn't read about the automation; you *saw* it, node
> by node, edge by edge. […] The structure was the interface."

Almost every chapter is a **prosthetic for something a visual tool used to give for free**:

| Guide chapter | What it reconstructs | NodeGX already has |
|---|---|---|
| Control Panel → Deployment Centre (`deployment.json`) | a service registry | the deploy popup + Backend Services panel |
| Control Panel → Data Browser | a data browser | `views/panels/databrowser/` |
| Control Panel → Automation Visualiser (`flow-registry.js`, `flowLog()`) | a flow graph with live overlay | WFA-004's workflow canvas + WFA-002's run inspector |
| Frontend Tweaker (`@tweak` CSS annotations) | a style inspector | the property editor + design tokens |
| Project Brain (derive views from OpenAPI/migrations) | a visual model of the system | **the graph is the model** |

The prosthetics exist because in a code project the human has to make the AI maintain a convention
file, and the convention file drifts. NodeGX does not need the convention file. It needs to *derive*.

So the port is not "build a control panel." It is:

> **Every convention file in the guide that a human must keep an AI honest about becomes something
> NodeGX computes, because NodeGX already knows it.**

## The thesis

**Three things in the guide are not prosthetics, and NodeGX has none of them.**

1. **The irreversible plumbing.** The observability chapter's core argument: source maps and release
   tagging must be captured *at build time* or the data never existed. "You cannot retroactively
   create data that was never captured." NodeGX **owns the build**, so it can make this unskippable at
   zero user cost — which no code project can, because there the deploy script is the user's problem.
2. **Proof that what is running is what you built.** The [deploy-verification](../../../../ai-coding-docs/docs/part-5/deploy-verification.md)
   chapter lists nine ways a deploy silently ships old code. Every one exists because the builder and
   the deployer are different systems that cannot compare notes. In NodeGX they are the same system.
   The failure mode is not hard to fix here; it is *structurally impossible* here, and nobody has done
   it.
3. **A declared maturity level.** The observability ladder — Foundation / Early / Pre-launch / Scale —
   with most boxes unchecked and a *Phase* column, so a human or an AI can see at a glance what is
   deliberately deferred versus actually missing. This is the answer to the audience problem: NodeGX
   serves a nine-year-old in a lesson and someone with two thousand paying users, and the same
   checklist must be invisible to one and load-bearing for the other.

Item 3 is the frame. Items 1 and 2 are its first two rungs.

## The ladder

A project declares a level. Nothing above the declared level is shown, nagged about, or enforced.

| Level | Who it is for | What switches on |
|---|---|---|
| **Playing** | LEARN lessons, a first hour, a kid | nothing. No panels, no gates, no checklist. |
| **Sharing** | showing five people something | build identity + deploy verification, the client-secret sweep, the feedback hotkey |
| **Live** | strangers can reach it | + error capture, source maps, release tagging, env split, an uptime check, a *verified* backup restore, **and Phase 32's Reality Check** |
| **Scale** | hundreds or thousands of users | + metrics, rate-limit review, alerting, the access-control audit, load smoke |

The readiness panel shows **the whole ladder**, including levels above the declared one, with unchecked
boxes and the level each item belongs to. That is lifted directly from the observability chapter and
it is the part that does the teaching: *"here is what you have not done yet, and here is when it will
matter."*

**Levels are declared, not detected, and never auto-promoted.** A project sitting at Playing with a
public URL is the user's business; the panel says so once and does not nag.

## Task table

| Order | ID | Title | Tier | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|---|---|
| 1 | [OPS-001](./OPS-001-MATURITY-LADDER.md) | The maturity ladder & the readiness panel | 1 — the frame | 🔴 Critical | 1–1.5 wks | none | 🔵 Fable 5 |
| 1 | [OPS-002](./OPS-002-BUILD-IDENTITY.md) | Build identity & deploy verification | 1 — the frame | 🔴 Critical | 4–6 days | DEP-001 (soft) | 🟠 Opus 4.8 |
| 2 | [OPS-003](./OPS-003-FINDINGS-STORE.md) | The findings store & the graph-aware feedback hotkey | 1 — the frame | 🔴 Critical | 1–1.5 wks | none | 🔵 Fable 5 |
| 3 | [OPS-004](./OPS-004-OPS-PANEL.md) | The Ops panel — one view over what is already emitted | 2 — visibility | 🟠 High | ~1 wk | OPS-001 | 🟠 Opus 4.8 |
| 4 | [OPS-005](./OPS-005-OBSERVABILITY-PLUMBING.md) | Observability plumbing & the analytics module | 2 — visibility | 🟠 High | 1–1.5 wks | OPS-001, OPS-002 | 🟠 Opus 4.8 |
| 5 | [OPS-006](./OPS-006-SECURITY-SWEEP.md) | The security sweep & the deploy interlock | 3 — the sweep | 🔴 Critical | 1.5–2 wks | OPS-001 | 🔵 Fable 5 |
| 6 | [OPS-007](./OPS-007-CONTENT-LINKS-META.md) | Content, links & meta as derived panels | 3 — the sweep | 🟡 Medium | 1–1.5 wks | none | 🟠 Opus 4.8 |
| 7 | [OPS-010](./OPS-010-LAUNCH-GUIDANCE.md) | Launch guidance — the assistant that knows your app | 3 — the sweep | 🟠 High | 2–2.5 wks | OPS-001 | 🔵 Fable 5 |
| 8 | [OPS-008](./OPS-008-PROJECT-JOURNAL.md) | The project journal & `query_context` | 4 — the narrative | 🟠 High | ~1 wk | none | 🔵 Fable 5 |
| 9 | [OPS-009](./OPS-009-AUTHORING-BUDGET.md) | Authoring budget & circuit breakers | 4 — the narrative | 🟡 Medium | 4–6 days | none | 🟢 Sonnet 5 |

Serial worst case ~11 weeks; realistic with parallelism ~6. OPS-002, OPS-003 and OPS-007 have disjoint
file territories and can run concurrently from day one.

**Tiers are stopping points.** Tier 1 alone is a coherent, shippable product change: a project has a
declared level, you can prove what is deployed, and everything you notice while using your own app
lands somewhere an AI can act on it.

## The decisions this phase starts from

| Decided | Decision | Why |
|---|---|---|
| 2026-07-30 | **Levels are declared by the user, never inferred.** | Auto-promotion turns a helpful checklist into a system that tells people what their project is. The panel may *suggest* ("this is deployed to a public URL — Sharing?") once. |
| 2026-07-30 | **Nothing in this phase blocks a deploy except OPS-006's critical findings, and that is overridable.** | Paternalism sends people to Bubble. An override that is recorded on the artifact and displayed afterwards is honest; a lock is not. |
| 2026-07-30 | **No convention files the user or an AI must maintain.** | `deployment.json`, `flow-registry.js`, `links.json` are the guide's workarounds for not owning the model. If a fact must be authored rather than derived, that is a signal the derivation is missing, not that a JSON file is needed. Exactly one thing in this phase is authored: OPS-008's narrative. |
| 2026-07-30 | **`nodegx-backend` is not extended for this phase.** | BAK-009 already emits ops state, metrics, audit, request ids, rate limits and redaction (`packages/nodegx-backend/src/ops/`). OPS-004 is a *view*. If it needs a new endpoint, that is a finding worth recording, not a licence to grow the backend. |
| 2026-07-30 | **Third-party observability ships as an optional module, never a dependency.** | LIB-003 is the vehicle. A project that never installs it must still get source maps and release tagging into its own artifact — the irreversible half is ours, the dashboard half is theirs. |
| 2026-07-30 | **Guidance is delivered by the assistant, which knows the project — not by a library of written tutorials.** | A step-by-step for Google Cloud Console is wrong within eighteen months because the console moves, and forty stale runbooks lie confidently to beginners. OPS-010 owns this. **But no provider has web access, so the model cannot see today's console either**: the check is the arbiter, steps are written structurally, and the model is forbidden from declaring an item complete. |
| 2026-07-30 | **Disclaimers live in the system prompt, not in each item's prose.** | Legal, security and financial guidance carries a standing treatment that cannot be forgotten when a new item is added, and can be revised in one place. NodeGX never asserts what the law requires of a given user; it explains what a document is for and generates a clearly-marked template that must be professionally reviewed. |
| 2026-07-30 | **Every readiness item must be fully usable with no AI provider configured.** | Phase 15 hit a real out-of-credit period. Summary, structural steps, authority link and check are the floor; the assistant is the layer above it, never the price of entry. |

## What this phase is not

- **Not a hosting product.** NodeGX tells you what is missing and offers a module or a deploy target.
  It does not run your servers. Phase 26 owns where an app goes; this phase owns whether you can tell
  what happened after it got there.
- **Not a performer of external setup.** OPS-010 walks you through creating a Google OAuth client; it
  does not create one. Most of these providers have no account-creation API, and each integration is
  credential storage plus a support burden failing in a dashboard we cannot see.
- **Not end-user onboarding.** "Getting *your users* into *your app*" is a template and a set of nodes
  — phase 21 territory, and filing it here would bury it. See PROGRESS.md open question 6.
- **Not a rebuild of the control panel's four tabs.** Three of the four already exist as better,
  native surfaces. Building the tabs would be cargo-culting the prosthetic.
- **Not visible at Playing level.** A LEARN-001 lesson must not acquire a readiness checklist.

## Relationship to other phases

| Phase | Relationship |
|---|---|
| **26 — Deployment** | OPS-002 rides DEP-001's un-frozen endpoint and DEP-008's artifact contents. If Phase 26 has not landed, OPS-002 still ships against the current folder export — smaller, still correct. |
| **22 — Production Backend** | OPS-004 is a view over BAK-009's ops surface, BAK-007's backups and BAK-003's access control. It adds no backend capability. |
| **19 — Cloud & Workflows** | WF-003's build-time credential scan is OPS-006's ancestor. OPS-006 moves it from the artifact to the graph and from terminal to pre-emptive. |
| **15 — AI Collaboration** | OPS-003's findings are AIX-002's new input source. OPS-008's journal is queried by the same loop. OPS-009 puts a meter on it. |
| **32 — Reality Check** | **Consumes OPS-003's findings store and OPS-001's ladder.** The Reality Check is the Live rung. Phase 32 does not ship without OPS-001 and OPS-003. |
| **17 — Noodl Learn** | Playing level exists so that LEARN sees none of this. LEARN-002's curriculum may choose to *teach* the ladder later; that is a curriculum decision, not a dependency. |
</content>
</invoke>
