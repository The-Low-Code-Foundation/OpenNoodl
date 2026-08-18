# UNI-014 — the mail room

**Surface:** platform · **Tier 1 (it is the dependency, not a feature)** · **Effort:** M ·
🔴 **NOT BUILT.** Unblocked to build; **one ask inside it** (a sending account) that does not block
the build.

> **D19** ([RULINGS.md](RULINGS.md)): the forum is **built, not bought**. That ruling makes this
> task the critical path — see its §"The dependency that decides it". Nothing else in the D19
> tranche degrades gracefully without it.

## Premise

Measured, not remembered: **nothing on the platform sends email.** `outbound_emails` (0004) is a
*rendered queue* — UNI-004 writes rows into it and asserts over their fields, which is a stronger
test than watching an inbox, but no process has ever drained it. There is no SMTP, no provider, no
inbound relay, and the relay domain is unregistered.

That was fine while the only consumer was an RFP relay nobody had launched. It stops being fine the
moment a stranger asks a question and waits for an answer. **A forum where "someone answered you"
never reaches an inbox is a forum nobody returns to** — and D16's threshold is explicitly about
people coming back.

🔴 **This task is owed to UNI-004 and UNI-006 regardless of D19.** It is not new work the forum
decision created; it is work the forum decision stops us deferring.

## 🔴 The spine: a notification is a ROW, email is one DELIVERY of a row

UNI-006 already ruled this shape for assignments — *"AC2's notify is a ROW, not an email"* — and its
reason is a constraint, not a preference: **an org-minor account cannot hold an email address.**
`accounts.org_minor_holds_no_pii` (0001) refuses one. So a design where notification *is* email
works for every user except the ones D10 exists to protect.

Therefore:

- `notifications` is the canonical table. Every account kind gets rows, including org-minor.
- `outbound_emails` becomes **one delivery channel for a notification**, not a parallel system.
- A user with no address gets the row and no delivery, and **that is a complete, correct outcome**
  rather than a failure to handle.

⚠️ **This inverts the obvious build order.** The tempting first move is "wire up a provider". The
right first move is the row, because the row is what every other surface reads.

## Scope

- **`notifications`** — account, kind (closed enum), subject reference, `read_at`, `created_at`.
  Written in the same transaction as the thing it is about, never by a poller.
- **Delivery adapter behind an interface**, with two transports in the repo:
  - `log` — writes the rendered message and marks delivered. The default in dev and test.
  - the real provider — **one file, arriving with the account** (see §"For Richard").
- **A drainer** that is safe to run twice: claim-then-send with a status column, so a crash between
  send and mark cannot double-send. 🔴 Use `select … for update skip locked`, not an advisory lock —
  UNI-002's advisory-lock control exists because *that* path had exactly one racing caller; this one
  has N.
- **Preferences**: per-kind opt-out, and a global unsubscribe reachable **without a session** (a
  signed link), because an unsubscribe that requires signing in is not an unsubscribe.
- **D3 compliance**: an erasure removes queued and undelivered mail. 🔴 D3 refuses UPDATE
  absolutely, *including inside an erasure* — so the erasure path must DELETE undelivered rows, and
  a delivered row's residue must be argued for explicitly the way `awarded_by` was in UNI-002.
- **Rendering** reuses UNI-004's precedent: the row holds the rendered body, so a spec asserts every
  field rather than the two a human would skim in an inbox.

## Acceptance criteria

1. **Every notification-worthy event writes a row, for every account kind.** Proved by a sweep over
   the modules that create them (UNI-005's AC3 shape: quantified over `src/lib/` exports, with a
   recipe-coverage assertion so a new event fails until someone gives it a verdict) — **and by an
   org-minor case, which receives the row and no delivery.**
2. **The drainer is idempotent under a crash.** A spec kills the process between send and mark and
   asserts exactly one delivery. 🔴 Control: remove the claim and the same spec must fail.
3. **Unsubscribe works with no session**, is per-kind, and a suppressed kind produces the row and no
   delivery — asserted in both directions, beside a known-firing control that the *unsuppressed*
   kind still delivers. (Per [[assert-an-absence-with-a-known-firing-signal-beside-it]]: refused and
   never-requested are identical otherwise.)
4. **An erasure leaves no undelivered mail addressed to the erased account**, asserted against
   `information_schema` for any column that could hold an address, not against a hand-list.
5. **The `log` transport is not a stub that passes.** Its output is asserted field-by-field against
   the same expectations the real transport must meet, so swapping transports is a change of
   destination and not of content.

## Not in v1

Inbound mail (reply-by-email is a **chosen absence** — see D19), digests, HTML templating beyond one
plain layout, per-thread mute, bounce handling beyond recording a hard bounce, DMARC/DKIM tuning
past what the provider does for us.

## ⚠️ For Richard — one ask, and it does not block the build

**A transactional sending account** (Postmark, SES, Resend — a decision, not a big one) plus a
sending domain. Until it exists the `log` transport is the default and every spec passes against it;
the real transport is one file and one env var. 🔴 **Do not let this ask block the task** — the
substrate is the deliverable, and it is unblocked today.

⚠️ The **relay domain** (UNI-004's double-blind addresses) is a *separate* ask and a harder one,
because it needs inbound. v1 keeps UNI-004's ruled behaviour: outbound only, replies go through the
site.
