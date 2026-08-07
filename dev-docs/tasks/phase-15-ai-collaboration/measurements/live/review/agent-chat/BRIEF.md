## Brief

<!--
  What this app is, for whom, and what it deliberately is not.
  The assistant reads this on every build. Keep it short — a page at most.
-->

## What this app is

This reads as a reference/demo app for streaming and real-time data patterns with a
backend, rather than a product built around a specific business task. Each page
exercises a different transport or state pattern against what appears to be the same
demo backend (localhost:4830), and the on-page copy is written to explain the pattern
to the reader, not to a task-focused end user ("Server-Sent Events / WebSocket when
the client needs to talk back mid-stream", "State History watches one key of the
"chat" store"). The four pages read as: a streamed chat over SSE (Chat), a two-way
WebSocket stream with buffering and NDJSON reassembly (Live), undo/redo/checkpoint/
optimistic-update patterns on a shared store (State), and server-driven actions plus
regex extraction over a streamed answer (Tools).

> TODO: confirm whether this is a Noodl node-pattern showcase/internal reference, or a
> real product whose users would never see this explanatory copy.

## Who uses it

> TODO: no persona is inferable from the graph. The explanatory, pattern-naming tone
> of the on-page text (e.g. "Optimistic updates", "Reassembling NDJSON") suggests the
> audience is a developer evaluating or learning these Noodl node types, not an
> end-user of a finished product — but confirm this.

## Deliberately out of scope

- There is no evidence of authentication, multi-user identity, or persistence beyond
  the in-memory "chat" global store (Global Store's `persist` is set to false). Data
  does not appear meant to survive a reload.
- No backend code or contract was available to this review; all endpoints (SSE POST,
  WebSocket, action-stream SSE) are inferred from URLs/config only.
  > TODO: is there a real backend, or are these demo/mock endpoints?
