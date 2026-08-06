# Phase 45 — Streaming (Track S)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 6 tasks. Post-alpha.
**Input:** [CWF-007](../phase-42-first-hour/CWF-007-STREAMING-RESPONSES.md) — the design doc, whose
four questions are answered and whose build was deliberately deferred past alpha. This phase is that
build. **Read CWF-007 first; this file does not restate its decisions, it schedules them.**

## The one-sentence gap

A cloud function can **consume** a stream and cannot **emit** one.

That asymmetry is easy to miss and it has been missed twice. The cloud picker offers SSE, WebSocket,
Text Accumulator, JSON Stream Parser, Pattern Extractor and Stream Buffer — six streaming nodes,
all of them **readers**. Phase 42 measured that the reading works for real: functions run in host
Node 22 with the genuine `fetch`, and `Response.body` is a `ReadableStream`, so consuming
Anthropic's streaming API from a cloud function works **today**, unchanged.

What does not exist is any way for that function to hand tokens onward to the app. So the last hop
of every LLM feature is missing, and it is the hop the user actually sees.

## Why this is the phase that decides a product category

Every AI-app builder on the market ships token streaming. A chat UI that waits eight seconds and
then paints a wall of text does not read as "slower" — it reads as broken. This is not a performance
optimisation dressed as a feature; it is the difference between the platform being usable for the
category it most wants to be used for and not.

The comparison document ranked this second of six post-alpha items for exactly that reason: it is
~3 weeks, it is mostly assembly of parts that already exist, and it converts a 🔴 that gates a whole
class of app.

## What already exists (so the estimate is credible)

| Piece | Where | State |
|---|---|---|
| SSE hub with connection registry, auth, reconnection, connection counting, `closeWithGoodbye` | [`realtime/RealtimeHub.ts`](../../../packages/nodegx-backend/src/realtime/RealtimeHub.ts) | Built (BAK-001) |
| Change bus + subscription filtering, with the filter twin property-tested against the query predicate | `realtime/ChangeBus.ts`, `realtime/filter.ts` | Built |
| Client-side stream consumption nodes | SSE, Text Accumulator, JSON Stream Parser, Stream Buffer, Pattern Extractor | Built |
| Cloud-side stream **consumption** | host `fetch` + `ReadableStream` | Measured working |
| Transport decision (channel-on-the-hub, not HTTP response) | CWF-007 Q1 | **Decided** |
| Read-auth decision (the session that started it, and nobody else) | CWF-007 Q2 | **Decided** |
| Node-family decision (two deliberate nodes, not one) | CWF-007 Q3 via TALK-005 | **Decided** |

## The one open question, which the build owes rather than discovers

CWF-007 flags it and this phase must not paper over it:

> **Who may read a channel that no session created?**

Q1 chose channels partly *because* they work when no caller is waiting — a scheduled workflow
publishing progress. Q2 binds read access to the authenticated session that started the stream. A
scheduled workflow has no session. The two answers do not compose for exactly the case Q1 named as a
reason to prefer channels.

**The failure shape to avoid** is a "system channels are public because there's no session" branch.
That would be the third instance of the class FH-024 and OBS-004 already produced — reachability
mistaken for access control — arriving through a case nobody was looking at. STR-004 owns this and
must land **before** STR-005, not alongside it.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **STR-001** | The channel kind, and its auth rule | 4 d | A new subscription kind on the existing hub. Record-change subscriptions keep their current posture — **only the new kind gets Q2's rule**. Channel ids are not capabilities: knowing one grants nothing. Enforced at the hub, tested as a property. |
| **STR-002** | `Publish To Channel` — the cloud node | 3 d | Ports: channel, payload, `done` signal. Backpressure and a bounded buffer, because a function that publishes faster than a client reads must degrade rather than grow. Publishing to a channel nobody reads is a no-op, not an error. |
| **STR-003** | `Subscribe To Channel` — the client node | 3 d | Deliberately **not** merged with Subscribe To Changes (TALK-005): different payloads, different auth postures. Shares `RealtimeSubscription`, not a node definition. Composes with Text Accumulator so the LLM case is three nodes and no code. |
| **STR-004** | Who reads a system-authored channel | 3 d | The open question above. Candidates in CWF-007, unranked: admin-only; a reader declared at publish time; or a separate channel kind with an admin posture that never mixes with user streams. **Decide, write it down, then build.** |
| **STR-005** | Workflow progress on a channel | 3 d | "Step 3 of 7" falls out nearly free once STR-004 is settled — and *only* then. |
| **STR-006** | The LLM recipe, and the isolate refusal | 4 d | A validated example fragment: HTTP → upstream SSE → Pattern Extractor → Publish To Channel → app-side Subscribe → Text Accumulator → Text. Plus: the isolate path must refuse a publishing function loudly (same rule as [MOD-006](../phase-44-compute-ceiling/README.md)) or the two paths differ silently. |

**Total: ~3 weeks.**

## Deliberately out of scope

- **The HTTP-response streaming variant.** CWF-007 Q1 accepted the cost that channels are *not* what
  an LLM SDK looks like and that we will eventually want the response variant too. It is not ruled
  out; it is not first; and when it comes it must not produce two paths that differ silently.
- **WebSocket transport.** TALK-005 settled this: there is no WebSocket in the backend at all, by
  decision, and this phase does not reopen it.

## Exit criteria

1. A cloud function calls a streaming LLM API and the app renders tokens as they arrive, with no
   API key in the browser.
2. Reloading the page mid-stream reattaches to the same channel and keeps rendering — the property
   the HTTP-response variant could not have, and the reason channels were chosen.
3. A second authenticated session that knows the channel id is refused.
4. A running workflow publishes step progress that the History Panel renders live.
5. The refusal in (3) is covered by a property test, not an example test.
