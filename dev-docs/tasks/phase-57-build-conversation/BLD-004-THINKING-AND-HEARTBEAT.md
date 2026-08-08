# BLD-004 — Thinking, and the heartbeat

**Status:** 📋 not started · **Track A** · after BLD-002 · closes **D6**, **D7**

## The defect, measured

**The one signal that separates "thinking hard" from "dead socket" is computed, plumbed through
three providers, and thrown away.**

`onActivity` fires once per event received from the provider's stream — including pings, keepalives
and the reasoning deltas the client deliberately drops. All three providers emit it:
[anthropic.ts:457](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/anthropic.ts#L457),
[openai.ts:287](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/openai.ts#L287),
[ollama.ts:244](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/providers/ollama.ts#L244).
**Its only consumer is the turn deadline**
([turnDeadline.ts:107](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/turnDeadline.ts#L107)).

Its own doc comment says what it is for
([types.ts:185-192](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/types.ts#L185)):

> *"It reports that the stream is alive, not that the model said anything, and it is the only signal
> that separates a model thinking hard from a provider that has stopped answering."*

The user — staring at a static wand icon, deciding whether to kill a run — is never told.

**Reasoning is discarded for a reason that binds the parser and need not bind the UI.** Adaptive
thinking is enabled with `display: 'omitted'` so *"reasoning never leaks into the response text the
XML templates parse"*
([models.ts:81-84](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/client/models.ts#L81)).
That is a correct decision about the parser. It became a decision about the interface by default:
there is no separate channel, so there is nothing to show even where showing it is safe.

## Build

1. **Surface `onActivity` as liveness.** A pulse that animates only while an event landed within the
   last ~2s, and goes still otherwise. ⚠️ **This is the whole point: a spinner that spins while the
   socket is dead is worse than no spinner.** Add a "no event for Ns" state that says so in words
   before the deadline fires, so the user learns the difference between slow and stuck.
2. **Add an `onReasoning` callback** to `AiStreamCallbacks`, separate from `onText`.
   - ⚠️ **The `display: 'omitted'` decision stays.** The reasoning must reach the *callback* without
     entering the text the XML templates parse. Verify per adapter that the two paths cannot merge —
     that is the entire risk of this task, and a regression here corrupts authoring output, not just
     a panel.
   - Providers with no reasoning channel simply never call it. Do not synthesise one.
3. **Render it as its own channel:** dim, italic, collapsed by default, with a live elapsed clock —
   *"Thinking… 0:38"*. Never mixed into assistant prose.
4. **The elapsed clock is per-turn**, and it is the honest answer to "is it stuck". ⚠️ **Occluded
   Electron clamps timers roughly 1000×** — a `setInterval` clock in a backgrounded window will lie.
   Pace it the way the observability work did, or derive elapsed from timestamps on render rather
   than counting ticks.

## Write the check before the fix

The mechanism is trivial to build and easy to have lie on screen. Before wiring the UI:

- A driver that **kills the provider mid-stream** and asserts the pulse stops within 2s.
- A driver that holds a stream open with keepalives and no content, and asserts the pulse *keeps*
  going — the case a naive "animate while `busy`" implementation gets wrong in the other direction.
- Run it both ways and diff. A right mechanism is not a right prediction.

## Acceptance

- [ ] Provider killed mid-turn → pulse stops, and within the deadline window the panel says so in
      words. Screenshot both.
- [ ] A long silent reasoning phase on a thinking-capable model → pulse alive, thinking strip
      counting, no assistant prose yet.
- [ ] Ollama (no reasoning channel) → no thinking strip, pulse still correct. **Open-weight leg is
      not optional.**
- [ ] Authoring output is byte-identical before/after the `onReasoning` change on a fixture run —
      proving reasoning did not leak into the parsed text.

## Register

| # | Finding | State |
|---|---|---|
| | | |
