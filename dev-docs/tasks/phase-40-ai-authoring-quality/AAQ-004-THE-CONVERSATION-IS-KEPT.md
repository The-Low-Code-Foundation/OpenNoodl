# AAQ-004 — The conversation is kept

**Findings:** #2 (the wizard's long answer collapses to one sentence) and the standing third
complaint from the diagnosis handover: *no conversation history for in-editor builds* —
`lib21-qa/.nodegx/` is empty, and "Show the conversation" appears only for a launcher-scoped plan
when `recovered && !plan && !runState` (`ProjectAuthoringView.tsx` ~1084).
**Status:** Mechanism A built and under test (2026-08-04). Mechanism B remains with AAQ-006, as this file
already directs.

## What was built (Mechanism A)

`ScopingSession.run()` now keeps **every** non-empty prose round of a turn, joined by a blank line, instead
of only the last. Three details beyond the obvious fix:

- **The streamed text was collapsing too.** `onText` reports the accumulated text *of the round in flight*,
  so round 2 restarted the bubble at the recap and dropped the long answer from under the user before the
  transcript ever got involved. `withProsePrefix` shifts each round's accumulated view by what has already
  been said, so the bubble only grows and ends byte-equal to the transcript entry. The spec asserts exactly
  that, and asserts monotonicity.
- **Every exit keeps what was said**, failures included: prose the user watched arrive is theirs whether or
  not the round after it reached the provider. Previously an error returned `reply: ''` and pushed nothing.
- The one-round case is byte-identical to before — the inverse failure this file warns about (text shown
  once, entered twice) has its own spec.

## Mechanism A — the collapse (verified)

`ScopingSession.run()` (`ScopingSession.ts:184-216`): each model turn's prose overwrites `lastProse`;
only the **final** turn's prose is pushed to `this.entries`. The characteristic sequence is:

1. Turn 1: long, useful prose with follow-up questions — streams to the UI live.
2. The model calls `record_scope`; the tool result instructs *"Recorded. Now answer the user in
   prose."*
3. Turn 2: a short recap — and that becomes the only transcript entry. The UI re-renders from
   `entries` when the run resolves, so the long answer visibly *vanishes in front of the user*.

### Fix

Push every non-empty prose turn to `entries` (or concatenate turns into the one entry), so the
transcript equals what streamed. The `record_scope` tool-result nudge stays — it exists so a turn
never ends on a bare tool call — but it must not cost the preceding prose. Watch the inverse
failure: duplicating text that streamed once. The transcript entry and the streamed text must be
byte-equal in the simple one-turn case.

## Mechanism B — nothing persists an in-editor build (verified absence)

Launcher-scoped plans persist via the scoping sidecar and `PlanSessionStore` restores staged output
(AIB-003 slice 4), but the *conversation* of an in-editor build — the refinement turns, the reasons,
what the user asked for in what words — is held in memory and lost. Richard cannot reopen
yesterday's build conversation to say "the cards are too cramped, fix the spacing".

### Fix — but on the new session model

AAQ-006 replaces the authoring loop's session with a harness-managed conversation. Persisting the
*old* loop's transcript and then migrating would build it twice. So:

- **Now**: Mechanism A's fix (it is upstream of the harness and stands alone).
- **With AAQ-006**: conversation persistence is an acceptance criterion of the harness task —
  sessions serialize to the project sidecar (`.nodegx/`), listable and reopenable from the Build
  panel, resuming with context intact. This file owns the *UX contract*; AAQ-006 owns the storage.

The UX contract, drawn from how Richard actually works:

1. Past build sessions are listed per project (title = the brief's first line, date, cost).
2. Opening one shows the full conversation — including the parts that used to vanish — and the
   changesets it produced, with links to what was applied.
3. **Continuing** one resumes the agent with its history, so "make the hero taller" lands as a
   refinement, not a cold rebuild.
4. A restart is a stop (phase-38 rule): a reopened session after a crash is a resumed-cancelled one,
   never a silently-restarted one.

## Acceptance criteria

1. The wizard's long-form answer remains in the transcript after the turn completes; scripted
   provider replay asserts the streamed text equals the kept text.
2. After a completed in-editor build, quitting and reopening the project shows the session in the
   Build panel's history; opening it shows the full conversation.
3. A continued session produces an update changeset against the previously-built components (kept
   node ids — the update-mode contract), not a recreate.
4. Nothing is written outside `.nodegx/` and the existing sidecar conventions; the sidecar remains
   git-ignorable without breaking the feature.

## Traps

- `ProjectAuthoringView` holds state in `useState` and the panel conditionally renders (the AIB-003
  defect family). History UI must read from the store, never from component state.
- The launcher handover's destructive `take()` (AIB-003) is the anti-pattern; anything reopenable
  must be re-readable.
- Cost: persisted conversations replayed into a resumed session pay input tokens — resume should
  reuse provider-side caching where the prefix is intact (the AIX-007 cache-boundary work already
  orders material for this).
