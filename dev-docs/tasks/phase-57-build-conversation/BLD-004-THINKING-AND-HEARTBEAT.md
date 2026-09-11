# BLD-004 — Thinking, and the heartbeat

**Status:** ✅ **built, driven and closed** (2026-08-09, `7d6e955c` + `95c13e30`) · **Track A** ·
closes **D6**, **D7**, and the two items filed on it — **C8** (the collapsed run claims no duration)
and **BLD-005's R2** (the current operation does not move).

## ⚠️ The premise this task shipped with was wrong, and it was one field

The build instruction said *"the `display: 'omitted'` decision stays — the reasoning must reach the
callback without entering the text the XML templates parse"*. That decision was never protecting the
templates. **`display` governs the thinking *block*, and thinking has never been part of a `text`
block on any setting** — the raw chain of thought is not returned at all. What `'omitted'` actually
does is stream thinking blocks whose text is **empty**, so `onReasoning` would have been wired to a
channel that carries nothing: a feature inert rather than safe, and inert in a way every spec above
it would have passed.

`display: 'summarized'` returns a readable summary on its own block type, and is **billed
identically** — display controls visibility only, not whether the model thinks. The isolation the
task was worried about is real and is enforced a different way: a second accumulator
(`fullReasoning`) that the returned response never reads, so a leak requires renaming a variable
rather than forgetting a branch.

⚠️ **BLD-012's golden request spec caught the change** — a spec this task never touched, which pins
the *whole* request rather than the fields one task cared about. Updated deliberately, with the
reason beside the byte.

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

- [x] **Provider killed mid-turn → pulse stops, and the panel says so in words.** Driven: the pulse
      stopped within 2s of the last event (`dotAnimation: "none"`, read from the compositor rather
      than from the class), and at 53s the panel read *"No response for 53s — this turn ends by
      itself at 3m 0s of silence."* ⚠️ **The consequence was verified too, not just the mechanism:**
      the sentence made a prediction and the prediction came true — the turn ended by itself at
      exactly 180s with *"The model stopped responding — nothing arrived for 180 seconds."*
- [x] **A long silent reasoning phase → pulse alive, thinking strip counting, no prose.** Driven for
      **96 seconds** of pure keepalives with zero content — twice the quiet threshold — state
      `alive` throughout, animation running, strip counting. This is the direction a heartbeat wired
      to `onText` fails, and it fails it on exactly the turns worth waiting for.
- [x] **The two runs diffed on one variable.** Same turn, same clock, same code path; the only
      difference was whether pings kept arriving. `alive` → `waiting` → `silent`.
- [x] **Authoring output is byte-identical with the reasoning present and absent.** Pinned as a spec
      on a fixture turn whose reasoning contains `<Group>`, so a leak would be a *parseable* one
      rather than obvious noise.
- [ ] **Ollama (no reasoning channel) → no thinking strip, pulse still correct.** ⚠️ **Not driven —
      see R3.** The negative half is specced (`onReasoning` uncalled on a non-thinking stream); the
      open-weight leg on a real endpoint is not.

### R2, closed — and the measurement that closes it

The current operation in the run map moves only while the *stream* moves. Driven on a two-operation
plan run, killing the pings mid-run:

| | before | after |
|---|---|---|
| run still busy | ✅ | ✅ (Stop present) |
| `.Current` class | `is-alive` | `is-waiting` |
| dot animation | `heartbeat-pulse` | **`none`** |

**A `busy`-driven pulse would still have been animating in the right-hand column.** That is the
whole of R2, and it is why the row shipped still until this task existed.

### C8, closed

The collapsed run reports `2 steps — 3s` against a scripted 3000ms delay — and, on the same screen,
the plan-run's own collapsed strip still reads `2 steps` with no duration, because `turns.ts`
synthesises those from state that has no per-entry clock. **Both paths visible at once** is the
demonstration: the stamp is optional, and its absence costs a fact rather than inventing one.

## Register

| # | Finding | State |
|---|---|---|
| R1 | **The task's own premise about `display: 'omitted'` was wrong** — it did not protect the XML templates, it made the reasoning blocks arrive empty. See the header. | ✅ fixed (`'summarized'`), golden updated |
| R2 | **The reasoning clock outlived what it measured** — it ran while `streaming` was set, and a hung turn stays `streaming` until the deadline fires, so a one-second think showed **"Thinking… 3m 2s"**. Found by driving; invisible to `tsc` and to all 29 specs. | ✅ fixed (`lastAt`), label changes tense |
| R3 | **The heartbeat's wrapper state class collided with the dot's animated modifier**, so an alive heartbeat drew `background-color: primary` behind the sentence — **1.16:1**. ⚠️ Found by *measuring composited pixels*; every screenshot I had was taken in `waiting`, where the collision does not paint. | ✅ fixed (`Dot*`-prefixed modifiers) |
| R4 | **Ollama's open-weight leg is not driven.** No local endpoint was available this session. The adapter is untouched and calls `onReasoning` nowhere, so the specced behaviour (no strip, pulse from `onActivity`) is what it does — but that is inference, not a drive. | 📋 filed for BLD-010 |
| R5 | **OpenAI-compatible reasoning (`reasoning_content` / `reasoning` deltas) is deliberately not wired.** Several gateways emit it, but nothing here could verify against a real endpoint, and a speculative field-read is the "fake pass" this phase keeps paying for. `turnDeadline` already forwards `onReasoning`, so adding it later is one adapter branch. | 📋 filed, blocker named |
| R6 | **The user's request renders twice** in the thread — one retired turn carrying only the request, plus the live one. Visible in every drive screenshot. Not BLD-004's surface and provenance not established (it predates this session's changes); it is a thread-composition question. | 📋 filed for **BLD-006** |
| R7 | ⚠️ **`test:ci` run while a dev stack is live produces phantom failures.** The first run reported 11; three were `BEN-001 … the bench reads it` returning an empty interface, and they vanished on a clean re-run after `dev:stop` with no code change. Recorded because the *false* explanation was convincing — the sibling's `4020ff80` changed 105 lines of `noodl-runtime/src/node.ts` after the last baseline, and BEN-001 reads ports "off the plug the runtime agrees with". It fit; it was wrong. The specs import the runtime for **types only**, the one fact that did not fit. | ✅ understood — stop the stack first |
