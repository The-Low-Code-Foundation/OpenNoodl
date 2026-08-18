# UNI-017 — the queue, and the signal

**Surface:** platform · **Tier 2** · **Effort:** M · 🔴 **NOT BUILT.** Blocked on **UNI-015** and
on there being a backlog worth queueing.

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
