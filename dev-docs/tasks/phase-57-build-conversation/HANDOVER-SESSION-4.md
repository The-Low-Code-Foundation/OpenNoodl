# Phase 57 — handover after session 4 (2026-08-09)

**What ran:** **B9 fixed, driven, and BLD-001 closed.** The thread no longer resets — three sends
leave three turns, in order, verified in a real editor from a provably empty thread. ⭐ **D1 is
closed.** A second defect (**B10**) turned up while writing the fix and is fixed and driven too.

Phase 57 is **3 of 16 built** (BLD-001 ✅ closed, BLD-007, BLD-012). ⚠️ **BLD-007 and BLD-012 are
still undriven**, and BLD-012's is the one with a bill attached to getting it wrong.

## The one thing worth carrying

> **The id prefix *is* the liveness — and retiring is a pair.**

`liveTurns(sources, idPrefix?)` is one derivation read twice: with no prefix for the live turns, with
`history-N` for retired ones. The live ids (`component-…`, `plan-…`, `docs-run`) are *exactly* the
strings `renderOutcome` matches to mount a live control, so a retired turn **cannot** mount one. Trap
1 from session 3 isn't guarded against — it is unreachable.

And retiring is two halves: **freeze the record, then release what produced it.** Doing only the
first is worse than doing neither — the frozen copy and the live derivation end up on screen
together, which is the duplicated message this phase is measured on.

**The contract was not new; it had gone missing.** The pre-BLD-001 panel opened `startPlanning` with
`reset()` — *"planning a new request is the user saying they are done with the previous one"*. The
refactor kept every other retire path (accept, discard, declined, failed) and dropped the success
one. What is new is only that the conversation survives the retire.

## What is on the branch

| Commit | What |
|---|---|
| `458e189f` | **B9 + B10** — a new request retires the previous one instead of erasing it |
| `4d562e19` | session 3's handover |
| `b9a26a84` | BLD-001 driven; B9 filed |
| `02c3072c` | the composer's Enter binding |
| `a93720b3` | BLD-001 — the frame |

## B10 — the defect the fix surfaced

`renderOutcome` matched `turn.outcome?.kind === 'staged-component' && canDecide`, and **neither half
is turn-specific**: a frozen turn keeps the `staged-component` outcome it had when frozen (it should
— what it built is worth reading), and `canDecide` is a *session-wide* flag. So the moment a second
build staged, the historical turn rendered a second Accept/Review/Discard card beside the live one.

This predates B9 — the accept path has always put a frozen staged turn into history. It was found by
**writing** B9's fix, not by driving it: re-prefixing ids makes *"what else keys off a turn's
identity?"* unavoidable. Fixed by matching the live id, the convention the `plan-` and `docs-run`
branches already used.

## Two traps for whoever drives this panel next

**1. A drive that starts from whatever the last drive left is measuring two runs at once.** My first
re-run reported four turns with the first request twice, and it looked exactly like a bug in the fix.
It was an aborted earlier attempt: a plan left live in `PlanSessionStore` (durable by design) plus
turns in `history` (not durable). **Assert the starting state; do not assume it.**

**2. The reset that works is not the obvious one.** Switching sidebar panels does *not* clear the
thread — `PlanSessionStore`'s own module note is literally true: **sidebar panels are hidden, not
unmounted**. `history` is component state and survives the switch (the turns stay in the DOM while
you're away — I checked). Only an editor restart gives an empty thread. `cdp reload` is still off
limits.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **86 suites, 1170 tests** — +8 over the 1162 baseline, exactly the new specs |
| `test:ci` | ⚠️ **not re-run this session.** Nothing here touches a jasmine spec, but that is a prediction, not a measurement |

⚠️ **Never `tail` a `test:ci` run you intend to read a verdict from** — the pipe eats the `Jasmine:`
summary and the result looks exactly like a swept suite. Redirect to a file and grep it.

## The recipe for driving this panel with no provider

Unchanged from session 3 and now proven twice. Patch the provider boundary and nothing else; script
the **planning** turn, because BLD-001 routes every send through `PlanningSession` first. Intent
comes from `classifyPlan` — **two component operations → `plan`, one → `component`** — never from the
agent's prose.

Session 4 extended it to the component route: the same fake answers `submit_plan` *and*
`submit_component`, and the candidate can be hand-written — `{ nodes: [{ id: 'g1', type: 'Group',
… }], visual_roots: ['g1'] }` is the smallest thing the gate accepts. **No recorded candidate is
needed.** Target `Ui/…`, not `Pages/…`, or the page rules reject a bare Group.

⚠️ Two things that cost me a cycle:

- **Wait on `busy` clearing, not on Send being enabled.** Send is *never* enabled after a send —
  `canSend` requires typed text, and the composer has just cleared. Watch for the `Stop` button
  going away.
- **`connect()` takes the target object**, not `target.webSocketDebuggerUrl`.
- A planning session may take an **advisory turn** (LAS-006), so one send can be two `chatStream`
  calls. Count sends by request, not by provider call.

Read the turn ids off the React fiber (`__reactFiber$…`, walk `.return` for the first `key`) — the id
is the whole mechanism, and rendered text alone cannot tell a retired turn from a live one.

## What to do next

1. **BLD-003, then BLD-002.** Unchanged, and BLD-003 is now the one that makes the control count
   measurable. ⚠️ **B5 is measured**: with a candidate staged there are **2 Accept and 2 Review
   changes** on screen — one pair in the thread, one in `AuthoringPreviewDocument`'s topbar. **And
   the two disagree on wording**: the thread says **Discard**, the preview still says **Reject**, so
   the D3 correction landed on one surface only. BLD-003 owns both halves.
2. **Drive BLD-007 and BLD-012.** Both merged, neither driven; BLD-012's image block has never
   reached a real endpoint and has *no symptom except the bill*.
3. **BLD-005** is still nearly free — `BuildThread` already has a header row outside the scroll area.
4. **BLD-006** inherits a smaller job than it had: the thread now accumulates within a session, so
   what is left is genuinely persistence (surviving a restart) plus the switcher.

⚠️ Both BLD-002 and BLD-003 must keep the README correction: **contrast is not the legibility
problem** — type scale is. No colour tokens.

## Concurrency

Four `claude` processes were alive at session start; `git log` and `git status` were re-checked
immediately before the one commit, which was pathspec-scoped. **No sibling touched phase 57 this
session** — the tree was clean at start and the only commit is mine. Session 3's warning stands
regardless: **assume a sibling may be inside your own task, and read `git log`, not the handover
table.**

## Fixture

The drive opened **`ai-test`** and accepted one component into it; that was reverted (`git checkout
-- project.json`, verified clean). The editor's own `.nodegx/` line in that project's `.gitignore`
was left in place — it is the editor's behaviour on open, not drive litter. The dev stack was stopped
(`dev:stop`, 26 processes, nothing left running). No worktree created.
