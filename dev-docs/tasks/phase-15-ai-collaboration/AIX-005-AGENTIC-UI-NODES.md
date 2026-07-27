# AIX-005: Agentic UI Nodes

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-005 |
| **Phase** | Phase 15 — AI Collaboration Experience (Revival Track C) |
| **Priority** | 🟡 Medium — **deliberately deferred until AIX-002 proves out** |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 6–8 weeks |
| **Prerequisites** | AIX-002 shipped and validated; Gate G2 signal positive |
| **Branch** | `task/aix-005-agentic-ui-nodes` |
| **Recommended executor** | 🟠 **Opus 4.8** — a substantial set of new runtime nodes with real concurrency and lifecycle concerns (streaming, reconnection, cancellation), but with a well-understood target. The node-design conventions already exist; this follows them at scale. |

## Gate G2 prerequisite — explicitly overridden 2026-07-26

This task's checklist opens with "**Confirm Gate G2 signal is positive before starting** — this task is cancelled if it is not," and the prerequisite row requires "AIX-002 shipped and validated; Gate G2 signal positive."

**Gate G2 has not been reached, and this task was started anyway, on Richard's explicit instruction.** Recording it here rather than quietly proceeding, because the gate was a deliberate decision and reversing it should be visible to whoever reads this next.

What the gate actually asked for, and the state of each part:

| G2 requirement | Status at override |
|---|---|
| AIX-002 demo shipped in a **signed build** | Not done — AIX-002's own residuals list "exit-criterion demo in a signed build" as outstanding |
| Shipped for a **full quarter** | Not done — AIX-002 completed 2026-07-25, one day earlier |
| **Two LEARN-006 pilots** run | Not done |
| Retention signal: do users **return unprompted**? | Unmeasured — there are no users on a shipped build yet |

So the override is not "the gate passed on a technicality"; it is a decision to build ahead of the demand signal the roadmap wanted first. The risk the gate existed to prevent is the one named in this task's own risk table — "built before the market signal, wasting 6–8 weeks" — and it is now accepted rather than mitigated. The viability report's argument against it (a team of one pursuing too many half-finished things in parallel) stands unrefuted; it was overruled, not answered.

Two consequences worth keeping in view:

- If G2 later comes back negative, this work does **not** become the fallback. The roadmap's answer to a negative G2 is winding down to maintenance + export, and these nodes do not change that.
- The transport and state primitives (AGENT-001/002/003/007) have a use independent of the agent-UI bet — they are what the runtime lacks for *any* long-lived stream, and BAK-001's realtime work already needed one. The speculative half is the agent-specific layer (AGENT-004/005/006). If the bet has to be defended later, defend it in those terms.

---

## Objective

Implement the streaming, real-time, and state-store nodes specified in phase 3.5 (AGENT-001…007), so that applications *built with* Noodl can themselves be front-ends for AI agents.

## Background

Every other task in this phase is about AI helping you build a Noodl app. This one is about building Noodl apps that talk to AI — a different proposition, and one worth being precise about, because it is the phase's most speculative item.

The case for it: by 2026, a large share of new application work is agent front-ends — chat surfaces, streaming responses, tool-call status, long-running task monitors. These share a shape Noodl currently handles badly: server-sent events, incremental updates, and state that arrives over time rather than in one response. A visual builder that makes agent UIs genuinely easy to assemble has a real and current niche, and it plays to the medium's strength, since data flow over time is exactly what a node graph makes visible.

The case for deferring it: this is a bet on a *second* market on top of an unproven first one. The viability assessment was clear that the product's problem is not too few capabilities but too many half-finished ones pursued in parallel by a team of one. Phase 3.5 was specified in January 2026 and never started — 0 of 7 tasks — and it should stay unstarted until AIX-002 has shown that people want AI-collaborative visual building at all.

Hence the explicit gating in the prerequisites. If Gate G2's signal is negative, this task is not a fallback; it is cancelled with the rest.

## Current State

- `dev-docs/tasks/phase-3.5-realtime-agentic-ui/` — AGENT-001 through AGENT-007 specified, **0 of 7 built**, spec stubs only, no commits reference them. Read those specs before starting; this task implements them rather than redesigning them.
- The runtime has a framework-neutral engine with a push/signal execution model that suits streaming well.
- Existing data nodes cover request/response (REST, database queries) but not long-lived streams.
- AIX-001 will have introduced streaming client work editor-side; the runtime equivalent is separate but can borrow patterns.
- PLAT-003 (typing the runtime) may be in flight — coordinate, since this adds new runtime nodes.

## Desired State

A Noodl app can, without custom JavaScript:

- Open and consume a server-sent-events or WebSocket stream, with connection state visible in the graph
- Accumulate streamed tokens/messages into displayable state
- Represent an agent conversation (messages, roles, in-progress state, errors)
- Handle tool-call status and long-running task progress
- Reconnect, cancel, and clean up correctly on navigation

## Scope

### In Scope
- [ ] AGENT-001…007 as specified in phase 3.5 (review specs first; adjust only with recorded reasoning)
- [ ] SSE consumption node with connection lifecycle
- [ ] WebSocket node (bidirectional) with reconnection strategy
- [ ] Streaming accumulator / state-store nodes
- [ ] Conversation-shaped state primitives
- [ ] Cancellation and cleanup on component unmount and navigation
- [ ] Error and reconnection states surfaced as graph outputs, not swallowed
- [ ] Example project demonstrating an agent chat UI end to end
- [ ] Catalog entries (SUB-004/005) for every new node

### Out of Scope
- Bundling a specific AI provider (these are transport and state primitives; the app author points them at their own endpoint)
- Server-side agent orchestration (Phase 19)
- Authentication schemes beyond passing headers/tokens
- Redesigning phase 3.5's specifications without recorded reasoning

## Technical Approach

### Where the nodes live

Follow the existing separation: transport and state nodes that do not render belong in `noodl-runtime` (framework-neutral, reusable by any future renderer); anything that renders belongs in `noodl-viewer-react`. Most of this task should land in the runtime — which is also why coordination with PLAT-003 matters, since these should be written in TypeScript if that work is underway.

### Design notes

**Lifecycle is the hard part, not the protocol.** Opening an SSE connection is easy; correctly closing it when a user navigates away mid-stream, reconnecting after a network blip without duplicating messages, and cancelling an in-flight request when the component unmounts are where streaming implementations fail. Model connection state explicitly as node outputs so the app author can see and handle it, and test the lifecycle paths harder than the happy path.

Make errors visible. A silent failed reconnection is the worst outcome for an app builder who cannot step through code — surface connection state, errors, and retry status as graph outputs, in keeping with the product's whole premise that behaviour should be legible.

## Implementation Steps

1. **Review the phase 3.5 specs** against current reality (they are eighteen months old by the time this starts); record any deviations and why.
2. **SSE node first** — the most common agent transport, and the simplest lifecycle. Get connection state, cancellation, and cleanup right here; the rest reuse the pattern.
3. **Accumulator/state-store nodes** for assembling streamed fragments into usable state.
4. **WebSocket node** with a documented reconnection strategy.
5. **Conversation primitives** — messages, roles, in-progress markers, errors.
6. **Tool-call/progress nodes** for long-running task status.
7. **Example project**: a working agent chat UI, used as both a test and a template.
8. **Catalog entries** for every node (SUB-004/005), so AI authoring can use them too — pleasingly, this makes AIX-002 able to build agent UIs.

## Testing Plan

- Unit tests per node against a mock stream server.
- Lifecycle matrix, tested explicitly: navigate away mid-stream, unmount mid-stream, network drop and recovery, server closes connection, cancel in flight, rapid open/close cycles.
- No leaked connections after navigation (assert on open handles).
- Example project works against a real streaming endpoint.
- Catalog entries validate; AIX-002 can author a simple streaming UI using them.

## Success Criteria

- [ ] AGENT-001…007 implemented (or deviations recorded with reasoning)
- [ ] SSE and WebSocket nodes with explicit, observable connection state
- [ ] Cancellation and cleanup correct across the full lifecycle matrix; no leaked connections
- [ ] Errors and reconnection surfaced as graph outputs
- [ ] Example agent chat project working end to end
- [ ] Catalog entries present; AIX-002 can author with these nodes
- [ ] Nodes placed in `noodl-runtime` where framework-neutral

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Built before the market signal, wasting 6–8 weeks | Hard prerequisite on AIX-002 validation and Gate G2; this task does not start on speculation |
| Connection leaks degrade long-running apps | Lifecycle matrix testing with explicit open-handle assertions, not just happy-path tests |
| Reconnection duplicates or drops messages | Document and test the delivery semantics; make them visible to app authors rather than implicit |
| Phase 3.5 specs are stale | Step 1 reviews them against current reality before implementation |
| Collides with PLAT-003's runtime typing work | Coordinate; write new nodes in TypeScript if that conversion is underway |

## References

- `dev-docs/tasks/phase-3.5-realtime-agentic-ui/` — AGENT-001…007 specifications
- [Revival roadmap — Track C (C-05, explicitly deferred)](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §5 (phase 3.5 triage)](../../reviews/NOODL-VIABILITY-REPORT.md)
- Depends on: AIX-002 + Gate G2. Related: PLAT-003, SUB-004/005

## Checklist

- [x] ~~**Confirm Gate G2 signal is positive before starting** — this task is cancelled if it is not~~ — **overridden 2026-07-26, see the Gate G2 section at the top of this file.** Not satisfied; started regardless, on instruction.
- [x] ~~Branch `task/aix-005-agentic-ui-nodes`~~ — superseded by the working agreement: task work commits straight to `cline-dev`, no task branches, no PRs
- [x] Review phase 3.5 specs; record deviations — `aix005-notes/AGENT-001-007.md`
- [x] SSE node with full lifecycle handling; then accumulators, WebSocket, conversation primitives
- [x] Lifecycle matrix testing incl. leak assertions — and then the same matrix run against a live server *in a browser*, which is what found the two defects the tests could not: see `aix005-notes/LIVE-RUN.md`
- [x] Example agent chat project — built, then actually run; three defects fixed, streamed answer byte-identical to the server's
- [x] Catalog entries — 154/154 enriched, gates green — but **AIX-002 authoring with these nodes is not demonstrated**; that needs a live provider and is the one open success criterion
- [x] CHANGELOG — ~~open PR~~ superseded by the working agreement (commits go straight to `cline-dev`)
