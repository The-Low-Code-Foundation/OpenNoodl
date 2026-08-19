# NAT-014 — The queue that nothing empties

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M |
| **Surface** | `platform` (`nodegx-community`), `ops` |
| **Rulings** | 🔴 **D10 OPEN** (inbound relay) · inherits P67 **D19** |
| **Depends on** | none — **can start immediately**, in parallel with Tier 1 |
| **Blocks** | **NAT-009** AC5, **NAT-010** AC5, **NAT-013** AC4 |
| **Promoted** | From phase 67b on 2026-08-19. It was deferred there as a remainder; three Tier-3 tasks cannot meet their acceptance criteria without it |

## The job

**No email leaves this platform.** Not "the relay queue has no drainer" — *nothing sends at all*,
and the reason it reads as working is that every part except the caller exists.

Measured 2026-08-19 against `nodegx-community` at `aa7bd6a`:

| Queue | Transport | Drainer function | Production caller |
|---|---|---|---|
| `notification_deliveries` | ✅ Brevo, real ([`mail/brevo.ts`](../../../../nodegx-community/src/lib/mail/brevo.ts)) | ✅ [`drainOutbox`](../../../../nodegx-community/src/lib/notifications.ts) `:696` | 🔴 **none** |
| `outbound_emails` (the relay) | 🔴 none | 🔴 none | 🔴 none |

🔴 **`drainOutbox` is imported by exactly two files, and both are tests.** There is no route under
`src/app/api`, no entry in `package.json`'s scripts, and no systemd unit — `ops/provision.sh`
installs precisely two timers, the app and the `pg_dump` backup. **Build the caller**, and it is
the fourteenth instance of that failure in this codebase; the thirteenth was P67's own D16 gate,
whose only callers were its specs.

The consequence is worse than silence, because the database disagrees with reality. `notify()` has a
`'relayed'` outcome meaning *"UNI-004's relay is already mailing this, do not queue a second"*
([`notifications.ts:28`](../../../../nodegx-community/src/lib/notifications.ts)). For an RFP
response or a coaching booking, the notification row therefore defers delivery to a queue that has
no sender, and a row exists saying the person was emailed. **They were not.**

And the relay's envelope is pinned by trigger to `relay_policy.relay_domain`, still
`relay.nodegx.dev` — **an unregistered domain**
([`0004_uni004_rfps_and_coaching.sql:850`](../../../../nodegx-community/src/db/sql/0004_uni004_rfps_and_coaching.sql)).
Migration `0012` left it alone deliberately: pointing it at a domain we own would make it *look*
shippable while changing nothing about whether a relayed message reaches anybody.

## Acceptance criteria

1. **`drainOutbox` has a production caller**, and what invokes it is stated in the file that owns
   it: a systemd timer beside the backup timer in `ops/provision.sh`, or an authenticated route, or
   a script the app runs on boot. 🔴 **The caller is the deliverable.** A better drainer with no
   caller is this defect again.
2. **A real message reaches a real MX from this repo.** `transport.ts`'s header states that nothing
   ever has — every Brevo test stubs `fetch`. Send one, to an address someone can check, and record
   the date. 🔴 An unstated limit reads as coverage; so does a stated one nobody closes.
3. **`outbound_emails` drains too**, or the relay is explicitly retired in favour of
   `notification_deliveries` and `notify()`'s `'relayed'` outcome is deleted along with it. Two
   queues where one has no sender is not a design, and **the choice is the work here** — not a
   second drainer built by reflex.
4. **The relay domain exists**, is registered, and its SPF/DKIM/DMARC are configured — or D10 rules
   the double-blind relay out of v1 and the trigger's pin is changed in a migration that says why.
5. **Idempotency holds under a second runner.** `claimNextDelivery` claims per row; two timers, or a
   timer overlapping a manual run, must not double-send. There is already a concurrency test at
   [`uni014-notifications.test.ts:434`](../../../../nodegx-community/tests/uni014-notifications.test.ts) —
   extend it to whatever the caller turns out to be, because the caller is the new surface.
6. **A queued message that never sends is visible.** `failed` rows exist and v1 deliberately does
   not retry; something has to show a human that thirty of them are sitting there. A metric, a log
   line the deploy surfaces, or an admin readout — decided in this file, not left implicit.
7. 🔴 **The claim is made against the deployed box, not the dev database.** This is the class of
   defect that passes every local gate.

## Traps

- 🔴 **The instrument here is a green suite.** `uni014-notifications.test.ts` and
  `uni014-brevo-transport.test.ts` are thorough, they exercise `drainOutbox` against a real
  database, and they pass — while zero mail is sent in production. A test that calls the function
  directly can never observe that nothing else does. **The spec that catches this asserts a
  caller exists**, derived from disk (routes, `package.json`, `ops/*.sh`), not from an import graph.
- 🔴 **D19 was recorded as met for the Bench and it is not.** Phase 67b's README says E6 gave
  `notification_deliveries` a real transport and therefore *"D19's condition is met for the Bench"*.
  A transport is not a delivery. 🔴 **Amend the P67 ruling record with a date and a reason** rather
  than leaving two live documents in disagreement.
- 🔴 **A retry loop is not in scope and must not arrive by accident.** `drainOutbox`'s header
  argues v1 has no retry because backoff, poison-message handling and a cap are undecidable before
  a real provider's failures have been seen. Adding a timer is not permission to add a retry.
- ⚠️ **The relay trigger is UNI-004 AC1's proof.** It holds for every row, which is exactly what
  makes it evidence. Do not weaken it to make a drainer easier to write.
- ⚠️ **Backups live on the same box as the database** (`ops/provision.sh:172-206`, a daily `pg_dump`
  into `/var/backups/nodegx-community` on nexus-1, which is shared with three live sites). That is
  **phase 67b's**, not this task's — but the two are the only things in `ops/`, and whoever opens
  that file for the drain timer is one edit away from fixing it. Flag it; do not silently absorb it.

## Why this is in phase 72 and not 67b

Three of this phase's tasks assert that a write from the editor **sends**: NAT-009 AC5 (an RFP
response reaches the poster), NAT-010 AC5 (a booking notification), NAT-013 AC4 (nothing is
silently queued into a thing with no drainer). None of them can be closed while this is open.

A dependency owned by a phase nobody is working on is how NAT-009 ships a feature that tells
somebody they were emailed. It is promoted here for that reason and for no other — 🔴 **the rest of
phase 67b keeps its own ledger.**
