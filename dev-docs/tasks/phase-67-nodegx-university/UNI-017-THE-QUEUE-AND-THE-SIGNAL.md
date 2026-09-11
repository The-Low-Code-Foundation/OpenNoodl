# UNI-017 — the queue, and the signal

**Surface:** platform · **Tier 2** · **Effort:** M · ✅ **BUILT 2026-08-19 (session 39) in phase
67b — all five acceptance criteria met.** `nodegx-community@d0ba01c`. Suite **1010 passing / 0
failed** (from 962/6), `tsc` clean, `next build` clean at 22 routes.

> 🔴 **THE FINDING, and it is why this was not two tables.** `unansweredQueue` selected
> `accepted_post_id is null`, so a thread with three replies and no accepted answer stood in the
> queue. But the queue exists to move **one** number — D16's median **first reply**, the only one of
> D16's three components software can move — and **a thread that has already been replied to cannot
> improve a first-reply median, ever.** So the surface built to move the metric was filling with
> rows inert to it, and *the healthier the community got, the more of the queue went inert.* Nothing
> threw. No test failed. `awaiting` now has **no default**, so every call site says which question
> it means, and `unansweredQueue` is left exactly as UNI-015 shipped it.

**What is built:** `0015` (`bench_thread_retirements`, `bench_same_here` + two triggers) ·
`src/lib/queue.ts` (`triageQueue`, `answeredNodeTypes`, retire/restore, press/withdraw/counts,
`roadmapSignal`, `coachQueue`) · `POST`/`DELETE /api/v1/bench/threads/:id/same-here` · the Bench
queue on the right lens with node facets and the signal chip · the coach queue on `/u/[handle]` ·
`QueueRows` as one producer for both · **35 specs** across `uni017-queue-and-signal.test.ts` and
`uni017-queue-rows.test.tsx`.

🔴 **BOTH CONTROLS THE ACs DEMAND WERE RUN, NOT ASSERTED.**
* **AC2 — matching disabled** (`matched: true` always): fails the 2 matching specs, ordering stays
  green. ⚠️ **Its first run failed 2 where it should have failed 1, and the extra one was MINE** — a
  spec asserting order *and* `matched` together cannot say which mechanism broke. Split. **The
  criterion caught the test, not the code**, which is the only reason a control is worth running.
* **AC4 — `profile_meets_bar()` → `select true`**: **5 failures across 4 files** — UNI-003's
  directory spec, UNI-004's rfps and coaching bar specs, and 2 of this task's. That is what one
  definition with five callers looks like from outside.

🔴 **A HOLE THIS TASK OPENED AND ANOTHER TASK'S INSTRUMENT CAUGHT.** The first draft of `0015` had
**no minor gate on `bench_same_here`** — every other Bench write is gated by `bench_author_gate`, so
an org-minor who cannot ask or answer could have pressed a button that put a row of theirs into a
roadmap query. ✅ **UNI-005's data inventory found it**, by censusing the live schema and refusing to
pass until the new free-text columns were classified — classifying `node_type` is what forced the
question *"who can write this row?"* to be asked out loud. **An instrument catching a hole it was
not built for, one task after it was written.** Two other derived-from-disk guards fired the same
way: the typed schema mirror, and UNI-011's route inventory.

🔴 **AND A FINDING ABOUT THE SUITE:** `npm test` on its own reports **1006 tests with 8 SKIPPED**,
and the skipped file is `uni015-bench-http.test.ts` — **the only one that drives real HTTP.** It
skips when there is no `.next` build, so a plain `npm test` reads as a full green pass with the
end-to-end file silently absent. Build first, then 1010/0.

⚠️ **Deliberately NOT built:** no retirement *surface* (the library and the record exist; nothing in
the UI presses it yet, and a triage UI wants a signed-in moderator view that no page has), no
`roadmapSignal` page, and the *same here* button itself is an **API endpoint with no web control** —
the site's Bench is read-only by construction (every write is `/api/v1`, driven by the editor), so
the press belongs to phase 72's editor work rather than to a form this site does not have.

Previously: 🔴 **NOT BUILT.** Blocked on **UNI-015** and on there being a backlog worth queueing.

> Scoped from ["Questions Made of Nodes"](https://claude.ai/code/artifact/7ac9fdff-757c-4cd0-8a94-879ba5fa1509)
> §"Form · the queue" and §"Same here". Specimens in full CSS.

## Premise

Two features, one argument: **the forum should be an instrument, not just a place.**

**The queue** is the only lever software has on D16. Its threshold is *30 threads · 3 consecutive
weeks with a call held · median first reply under 24h* — the first two are things Richard does and
the third is a thing a surface can move. So build the surface that moves it: unanswered questions,
oldest first, matched against the node types a responder has actually worked with.

**"Same here"** turns a forum into a roadmap input. Bound to a *node type and version* rather than
to a post, opt-in per post, it gives the bug-fix phases a real signal **without shipping telemetry**
— the user is choosing, per question, to say "this happens to me too", and that is consent in the
plain sense rather than the legal one.

## Scope

- **The unanswered queue** — `first_reply_minutes` computed for real off `bench_posts` rather than
  arriving from a webhook. Sorted by age; clock coloured **before** it is breached.
- **Matching**: a responder sees questions whose facets intersect the node types they have answered
  on before. ⚠️ v1 is a join over their own accepted answers — not a recommender, and it should not
  become one.
- **The coach queue** on a profile, gated by **D8's bar**, which is also how the coaching listing
  earns its place. 🔴 Read the bar through `profile_meets_bar()` (0004) — D8's bar was written three
  times and is now written once, with four callers; make it five, not a fourth copy.
- **"Same here"** — one row per (account, thread), opt-in, showing a count. Never retroactive,
  never inferred from a view.
- **D16 instrumentation reads the real tables**, with each component reported **with its `n`
  visible** — D16 ruled the composition obligation is *not* discharged by the threshold.

## 🔴 The trap this task inherits

`readThreshold()` and `mirror.ts` currently compute from `forum_threads`, the webhook-fed stub.
UNI-015 drops it. **This task must re-derive the threshold from `bench_*` and prove the numbers move
for the right reason** — a control that seeds a thread with a fast reply and one with none, and
asserts the median changes by the amount arithmetic says it should.

⚠️ **`{forum: 'absent'}` is gone** (UNI-015 AC4). If you find yourself reaching for it here, the
removal was incomplete.

🔴 **A metric that punishes the wanted behaviour is the fourth way an instrument lies** — score the
ideal run by hand before trusting the queue's ordering. A queue that sorts purely by age surfaces
the *unanswerable* question every time somebody looks, and the honest fix is to let a responder
retire one with a reason, not to hide it.

## Acceptance criteria

1. **The three D16 components compute from real tables**, each with its `n`, proved by a control
   that changes one seeded reply time and asserts the median moves by the predicted amount.
2. **The queue surfaces a question to a matched responder and not to an unmatched one**, both
   asserted, with the matching disabled as a control (which must fail exactly the matching spec and
   not the ordering one).
3. **"Same here" is per-account and idempotent** — a second press is not a second count — and its
   count is derived, never stored on the thread.
4. **The coach queue is gated by `profile_meets_bar()` and by nothing else**, proved by making the
   function always-true and watching UNI-003's *and* UNI-004's own bar specs fail alongside this
   one, which is what shows there is still one definition.
5. **A retired question leaves the queue with a recorded reason** and is still readable at its URL.

## Not in v1

Reputation-weighted routing, SLAs, notifications on queue entry (that is UNI-014 territory and
should not fork), per-org queues, any ranking that is not age + facet match.
