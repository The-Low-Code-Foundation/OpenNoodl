# Phase 67b — The Community Remainder

**Created:** 2026-08-18 (session 35), by Richard's decision at the close of phase 67. **Prefix:**
`UNI` — deliberately continued rather than restarted, because these are the *same* tasks, scoped in
phase 67, that were held out of its closing bar. Renumbering them would break every cross-reference
in `phase-67-nodegx-university/` and would disguise their history.
**Surfaces:** `platform` (`nodegx-community`), `editor`.

> **Why this phase exists.** Phase 67 closed on a shipping bar — *a stranger can reach
> `community.nodegx.io`, make an account, ask a question from inside the editor, and get an answer,
> and the site does not look like a placeholder*. Eight scoped tasks were deliberately outside that
> sentence. **The choice at the close was: give them a home, or let them drift.** Richard chose a
> home. This is it.

🔴 **This is not a backlog and not a parking lot.** Everything here was scoped, argued and in most
cases partly built inside phase 67. Each item below carries the reason it was held out — which is
also the reason it is safe to do later, and that reason is worth checking before starting one,
because a few of them stopped being true the moment the platform was actually deployed.

---

## What came in from phase 67

| Task | What it is | Why it was held out of the close |
|---|---|---|
| **UNI-017** | The queue and the signal — triage for unanswered questions, "same here" | The Bench answers questions without it; it makes answering *efficient*, not possible |
| **UNI-018** | Pull a graph — take an attached fragment into your own editor | The attachment renders and can be read; pulling it is the next verb |
| **UNI-007** (intake) | The lesson beamed into the editor — the intake half | The editor half shipped; the platform's intake is the other end of a bridge nobody crosses yet |
| **UNI-006** (bridge) | Assign / grade / review — the editor↔platform bridge | Assignments and grading work **on the platform**; the bridge is a second client |
| **UNI-011** (in-editor views) | The community mirrored in the editor — slices beyond s1–s2b | The mirror API exists and is specced; the views are editor surface |
| **UNI-008** | Online in one click, off in forty-five days | Hosting. Not in the closing sentence, and it is a product decision as much as a build |
| **UNI-010** (remainder) | A tutorial your own Claude can write — the remaining slice | 3/3 criteria met on the built slice; the remainder is scope, not debt |
| **UNI-012** | F4 on a packaged install | An editor-packaging check; orthogonal to the platform being reachable |
| ~~**UNI-013 slice 4**~~ | ✅ **BUILT 2026-08-18 (session 36) — and it was NOT Richard's after all.** Reassigned to us that day and built the same day: twelve files generated from **four family marks and one tier rule** by `scripts/draw-badges.mjs` | 🔴 **This row said *"RICHARD'S, and not code"* and was wrong from 2026-08-18 onwards.** ⚠️ The files carry no colour — an `<img>`-loaded SVG inherits none, so the profile paints them through a CSS mask and both themes are right by construction |

---

## 🔴 Two gaps found on 2026-08-18 that were NOT on anyone's list

These were measured while closing phase 67 and they are the reason this phase should not be treated
as leftovers. Both are cases where a thing reads as working and is not.

### A. `outbound_emails` HAS NO DRAINER — the relay queue is written and never sent

`src/lib/relay.ts` inserts into `outbound_emails` and reads it back. **Nothing sends it.** Phase 67
closed E6 by giving `notification_deliveries` a real transport (Brevo), and that is genuinely the
queue behind *"someone answered you"* on the Bench — so D19's condition is met for the Bench.

⚠️ **But `notify()` has a `'relayed'` outcome**, which means *"UNI-004's relay is already mailing
this event, so do not queue a second email about it."* For an RFP response or a coaching booking,
the notification row therefore defers delivery **to a queue that has no sender**. The person is
told, in the database, that they were emailed. They were not.

🔴 **This is not merely an unbuilt drainer.** The envelope is pinned by trigger to
`relay_policy.relay_domain`, still `relay.nodegx.dev` — **an unregistered domain**, deliberately
left alone by migration `0012` because pointing it at a domain we own would make it *look*
shippable while changing nothing about whether a relayed message reaches anybody. So the work is:
a domain that exists, a drainer, and a decision about inbound (UNI-004's double-blind replies need
it; v1's ruling is outbound-only with replies through the site).

### B. Backups are on the same box as the database

`ops/provision.sh` installs a daily `pg_dump` with 14 days of retention into
`/var/backups/nodegx-community`. ⚠️ **That survives "somebody dropped a table". It does not survive
"the box is gone"** — and the box is nexus-1, shared with `nodegx.io`,
`nexus.digitalbricks.io` and `digitalbricks.io`. Moving the dumps off-host is small, and it is the
kind of small that is only ever done before it is needed.

---

## Also landing here

**E7's second half.** Richard chose **Hetzner Object Storage** for artefacts on 2026-08-18. That
decision on its own unblocks UNI-020's *"Download the starter project"* button, because
`articles.project_url` already exists and a public object URL can simply be written into it —
**no code is owed for the button.** What *is* owed is the **capture image upload path**: a
`capture` attachment stores dimensions and consent and no image, so nothing has to be migrated, and
the upload needs S3 credentials that only Richard can mint from the Hetzner console. That is the
same shape as E10 — a form, then a small build.

---

## The order, when this phase is picked up

1. **A** above — the relay drainer, because it is the one where the database currently says
   something that is not true.
2. **B** above — off-host backups. Cheap, and it stops being cheap after an incident.
3. **UNI-017** and **UNI-018**, which are what make the Bench worth returning to.
4. The editor-side bridges (**UNI-006**, **UNI-007** intake, **UNI-011** views) as one tranche —
   they share a client and a transport, and doing them separately means three sessions rediscovering
   the same seam.
5. **UNI-008**, **UNI-010**'s remainder, **UNI-012** — independent, any order.
6. ✅ **UNI-013 slice 4 is BUILT (session 36), and it was never going to be Richard's.** This line
   said it was his and not code; the artworks moved to us on 2026-08-18 and landed the same day.
   It blocked nothing then and blocks nothing now.
