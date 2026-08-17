# UNI-004 — RFPs and coaching, without a gate

**Surface:** platform · **Tier 1 (R1, R3)** · **Effort:** L · ✅ **BUILT 2026-08-16 — all four ACs met**

> **Where it lives:** `/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling** of this
> checkout, never nested. Migration `0004_uni004_rfps_and_coaching.sql`; modules `src/lib/relay.ts`,
> `rfps.ts`, `coaching.ts`, `moderation.ts`, `refusals.ts`; routes `/rfps`, `/rfps/[id]`, `/coaching`.
>
> **Gates:** **245 specs / 12 files**, all pass (baseline **164 / 9**). `tsc --noEmit` clean.
> `next build` succeeds — **11 routes**, was 8. ⚠️ `npm run lint` is **still not a gate** in that
> repo: no ESLint config, so the script drops into an interactive setup prompt. It has never run.
>
> **Sixteen control runs and one of them was worthless** — see §"The controls" below, including the
> one that measured nothing and why. **Driven over HTTP against thirteen consequences written
> before the drive: 13/13.**

---

## What was built, and the three decisions that shaped it

**AC1's *"provably absent"* is a trigger, not a renderer.** A renderer that carefully omits an
address is a promise about the renderer; a database that refuses to store a row containing one is a
proof about the row. `outbound_email_relay_guard()` searches **`to_jsonb(new)` — the whole row** —
rather than the fields anyone remembered, so a column added to `outbound_emails` next year is
covered on the day it is added. 🔴 **And it catches the bypass nobody designs for:** a responder who
types their own address into the message body, to get around the relay, has the response **refused
and not stored** — one transaction, so there is no half-state where the smuggle succeeded quietly.

**The relay is one mechanism for both marketplaces**, per D8's *"one mechanism doing two jobs"*. An
RFP response and a coaching booking open the same kind of thread, and there is no second anti-spam
subsystem anywhere in the task. ⚠️ **What D8 does not mean, recorded because the strong reading is
tempting and wrong:** this is not anonymity. Each side sees the counterparty's **handle and public
profile** — that is how a client evaluates a builder — and what neither sees is an **email address**.

**D7's *"build so payment can be absent"* is expressed as a missing constraint.** There is nothing
in `coaching_bookings` tying `state` to `payment_state`, so a **priced** offer reaches `confirmed`
with `payment_state = 'not_required'` and nothing objects. The absence is the ruling, and a spec
asserts it on a £120 offer rather than a free one.

### 🔴 What is deliberately NOT built, so the absence reads as chosen

- **Nothing is sent.** No SMTP, no provider, no delivery attempt; `relay_policy.relay_domain` is
  unregistered. ⚠️ **This line used to read *"exactly as `community.nodegx.dev` is"*; that comparison
  died on 2026-08-17** — the community host is `community.nodegx.io` and it now resolves (RULINGS D2
  amendment). The relay domain is still unregistered on its own account, which is the claim that
  matters here. `outbound_emails` is a rendered queue — which
  makes AC1 a **stronger** claim than watching an inbox would, because every field of every message
  is checked rather than the two a human would have looked at.
- **No Paddle.** A receipt has a shape and a constraint that refuses half of one, and `recordPayment`
  has **no caller outside the suite**. A webhook handler for a payload nobody has ever received is
  the artifact this phase has found wrong four times.
- **No inbound mail**, so `relayMessage()` is the entry point a receiver *would* call.
- **No admin routes and no sessions** — UNI-002's and UNI-003's precedent, unchanged: an admin
  endpoint before sessions exist is a hide-anything endpoint. `hideProfile`-style functions take an
  actor id and wait for UNI-001.

## The judgement calls, and the one to reverse first if it is wrong

🔴 **Responding to an RFP requires clearing D8's bar.** The ruling's words are *"to list"*, the
task's premise says *"listed devs respond"*, and putting a builder in front of a client who did not
ask for them by name is what listing is. It doubles as the second half of the spam shield: an
account created five minutes ago has nothing published and cannot flood anything. ⚠️ **The
alternative reading — the bar gates only the directory, and anyone may respond — is coherent**, and
it is the one to relax to if this proves too strict. It is a one-line change in
`rfp_response_gate()` and it is a product call, not a correctness one.

**Posting an RFP has no bar at all.** Asking for help is not a claim about yourself, and gating it
behind having already built something would invert the board's purpose. A spec posts from an account
with no profile.

**A ban stops you posting more; it does not retract what you posted.** Those are two decisions, and
conflating them means an admin cannot do one without the other. Existing posts go through the report
path.

**Withdrawing an accept is allowed *before* the other side accepts, never after.** The first version
refused both, and its own comment said *"once an address has been revealed"* — the code and the
comment disagreed. The rule is now written about `connected_at`, and both arms are specced.

## D8's bar was written three times, and is now written once

UNI-003 wrote the predicate twice — in `profileBar()` and inline in `listDirectory()`. This task
needed a third (*"may this account respond?"*) and a fourth (*"is this offer listed?"*), which is
where it stops being affordable. It is now two SQL functions, `profile_has_evidence()` and
`profile_meets_bar()`, in `0004`, with **four callers**.

✅ **The refactor is proved by UNI-003's existing 56 specs**, which pass unchanged — a guard written
one task earlier grading a change made in the next, for the second time in this phase.
⚠️ **The functions live in a later migration than the table they are about**: a reader of `0003` will
not find the bar there.

## Two report tables, and the cost is named rather than discovered

`content_reports` covers the three things this task adds; UNI-003's `profile_reports` still covers
profiles. Generalising the existing one would mean rewriting a table whose thirteen control runs are
the evidence for another task's acceptance criteria, in the same session that adds three subjects to
it. **The cost:** *"what is open?"* is two queries, and an admin surface must ask both.
`src/lib/moderation.ts` says so at the top. Merging them is one migration and a shared reader.

⚠️ **One thing WAS merged: the enum.** `profile_report_state` is renamed to `report_state`, because a
second enum with identical values is the two-vocabularies failure this phase spent a day cleaning
up. 🔴 **The drift test would not have caught a rename left half-done** — it compares tables and
columns, not enum names. `tsc` and UNI-003's suite are what do, and that is now written in
`schema.ts` beside the enum.

## The controls

**Sixteen runs. Fourteen were clean, one measured nothing, and one is nondeterministic on purpose.**

| Control | Result |
|---|---|
| leak guard off | **3 fail** — both smuggle specs and the after-accept pair |
| premature-reveal off | 1 |
| D8 bar on responding off | 1 |
| response cap off | **3** — including the race |
| responder rate off | 1 |
| org-minor gate off | **3** — including the `communityVisibility` agreement spec |
| ban gate off | 1 |
| no-address (vacuity) gate off | **2** |
| booking machine off | 2 |
| price snapshot off | 1 |
| wrong-recipient off | 1 |
| reply-to pin off | 1 |
| bounce-path off | 1 |
| **shared D8 bar always-true** | **3** — and one of them is **UNI-003's**, see below |
| **advisory lock off** | nondeterministic by nature, see below |

In every clean row, **all other 242–244 specs still passed** — the mechanism failed the specs that
name it and nothing else.

### 🔴 The control that measured nothing, and why it is recorded rather than deleted

The first attempt at *"make `profile_meets_bar` always true"* was a `perl -0pi -e` substitution whose
**replacement string contained `$$`** — which perl expands to **the process id**. It wrote a garbage
dollar-quote delimiter, the migration failed to apply, and **71 specs "failed" with 148 skipped**.

A big red number that looks like an emphatic control. It measured **nothing**: every one of those
failures says *"the schema did not build"*, which is exactly the shape this phase already named —
*a failure indistinguishable from a missing mechanism measures nothing*. The tell was in the
result itself: whole **suites** failed rather than specs, including `db-schema-drift` and both
UNI-002 files, which have no opinion about D8's bar.

✅ **Redone with the delimiter escaped, and the patched function printed before the run** so the edit
is proved to be the one intended rather than assumed to be. The real result is **3 failed / 242
passed** — and 🔴 **one of the three is UNI-003's own** *"a public profile below the bar has a page
but is absent from the directory"*. That is the thing worth having from this control: it is positive
evidence that the extracted function is genuinely shared across two tasks, which the 71-failure run
could not have told anyone.

### The advisory-lock control is *supposed* to be flaky

Removing `pg_advisory_xact_lock` from `rfp_response_gate()` does not fail deterministically — **that
is the defect**, not a weak control. Under READ COMMITTED two concurrent responses each see the
other's row as absent, so a request capped at one takes two *sometimes*. The first pass reported
`1 failed` on one run and `0 failed` on the next, which is what a race looks like from the outside.

**Characterised over five runs each way rather than reported from one:**

```
lock removed   fail · pass · pass · fail · fail      3 of 5 slip
lock restored  pass · pass · pass · pass · pass      5 of 5 hold
```

⚠️ **A single run of this control would have been reportable either way**, and one of the two
reports would have been *"the lock is unnecessary"*. That is the generalisable half: **when a
control's mechanism is a race, one run is not a measurement** — and the arm that passes is the one
that gets believed, because it is the cheaper conclusion.

## Not in v1 — unchanged, and now with two more

Platform take-rate, escrow/milestones, dev reviews/ratings, featured listings, the certification
badge on offers, the coaching delivery space (phase 68 per D13). Added: **calendar automation**
(D7's *bought, not built* — Cal.com or similar) and **inbound mail**.

> **What the rulings fix here** ([RULINGS.md](RULINGS.md)):
> - **D7 — Paddle as merchant of record; coaching sessions are the only sellable at launch.** Both
>   Paddle and Lemon Squeezy handle EU VAT on our behalf, which was the requirement; **Lemon Squeezy
>   was acquired by Stripe in 2024** and is no longer an independent bet. Org contracts stay
>   contact-us and invoiced outside the platform (R4). ⚠️ **Payments are not a blocker for the board
>   itself** — build so that the payment step can be absent, and the booking-form-ends-in-an-email
>   v0 remains valid while the Paddle account is set up.
> - **D8 — the relay is double-blind.** `client --▸ platform --▸ dev`, with neither side's address
>   revealed until both accept. 🔴 That is **one mechanism doing two jobs** — it is also the spam
>   shield this task already asks for, so do not build a second. The address must not leak in a
>   header, a reply-to, or a bounce.
> - **D13 (2026-08-14) — this task builds the transaction only.** The coaching *delivery* space
>   (LearnBook: programs, threads, assignments, media — [phase 68](../phase-68-learnbook/README.md))
>   is a separate phase after this one. Build the booking flow so a phase-68 program can attach to
>   a booking later without rework — a booking row should be referenceable, nothing more.

## Premise

Two marketplaces on one rail. **RFPs** (the Bubble pattern): a user posts a request for work;
listed devs respond; responses reach the poster through **our email relay** so nobody's address
is exposed and nobody gets spammed. **Coaching**: listed devs (Richard first — R3, "eating my own
dog food", explicitly *not* exclusive to him) offer bookable, payable sessions. Both hang off
UNI-003's professional flags. This is the phase's first real revenue rail, and it gates nothing
(README principle 2).

## Scope (v1)

- **RFP board**: post (title, description, budget band, timeline), browse/filter, close.
  Posting requires an account; no fee.
- **The response relay**: a dev responds through the platform; the poster receives it by email
  from our system with a reply channel that keeps both addresses masked until the poster chooses
  to connect. Per-RFP response caps and a report button are the spam defence in both directions.
- **Coaching offers**: an offer belongs to a profile — description, duration, price. Booking v0
  is a request form that ends in scheduled email confirmation; calendar automation (Cal.com or
  similar — bought, not built) and payment through the D7 merchant of record follow in the same
  task once D7 is ruled. **The platform takes no cut in v1** — rails first, take-rate is a later
  conversation for non-Richard providers.
- **Moderation**: admin remove/ban, report flows on RFPs, responses, and offers.

## Acceptance criteria

1. An end-to-end RFP round trip with both addresses provably absent from every email header and
   body until the poster opts to connect.
2. A coaching booking round trip: offer → request → confirmation → (once D7 lands) paid receipt
   from the merchant of record.
3. Response caps and reporting demonstrably stop a flood (spec-level, simulated).
4. Richard's own coaching offer is created through the same public flow as anyone else's — no
   admin backdoor listing.

## Not in v1

Platform take-rate, escrow/milestones, dev reviews/ratings, featured listings, the certification
badge on offers, **the coaching delivery space** (programs/modules/threads — phase 68 per D13).
