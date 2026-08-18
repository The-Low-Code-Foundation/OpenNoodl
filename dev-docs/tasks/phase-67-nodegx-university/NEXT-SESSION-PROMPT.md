# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** **[README.md](README.md) §"What closes this phase"** — the alpha
bar, **ten items** — then §"WHERE THE PHASE IS" below, then `TASKS.md`'s table, then your task file.

🔴 **Two repos.** Editor work is this checkout. Platform work is
`/Users/richardosborne/vscode_projects/nodegx-community` — a **sibling directory, never nested** —
pushing to `The-Low-Code-Foundation/nodegx-community`. None of this checkout's gates, peers or
traps apply there.

---

# 🟢 SESSION 35 ANSWERED THE FOUR DECISIONS AND BUILT THREE OF THEM

Richard ruled **E5 = nexus-1**, **E6 = Brevo**, **E7 = Hetzner Object Storage**, and **the
remainder = a phase 67b** (recorded as **D20**, which amends D1's *"Docker on Hetzner"*).

**E6 is built. E2 is built and NOT RUN. E7 needs no code for the thing it was blocking.**

## 🔴 WHAT IS ACTUALLY LEFT — three things from Richard, then one command

1. **E10 — the GitHub OAuth App.** Unchanged, still the first domino, still one form.
2. 🆕 **Verify `mail.nodegx.io` as a sending domain in Brevo.** Small, and E6 cannot do it itself.
3. **`openssl rand -base64 32`** for `NOTIFICATION_LINK_SECRET`.

Then `ops/deploy.sh <host>`, then **E9**, then the phase closes.

> ⚠️ **The deploy has NOT been run.** It is outward-facing, it touches a box serving three live
> sites, and it was built and left unrun deliberately. **Do not run it without Richard saying so
> in this session.**

---

# 🔴 CHECK THIS HANDOVER'S PREMISES — BEFORE ANY CODE, EVERY TIME

✅ **Quote the count or do not claim the run.** Session 35's own floor, taken before any edit:
**`nodegx-community` — 30 files, 848 tests, 0 failures, exit 0** (2026-08-18 20:55→21:00, 274s).
A number quoted from a handover is a number measured under somebody else's load. **Re-measure.**

⚠️ **The dev database was wiped twice this session** (the suite drops and rebuilds `public`) and
reseeded at the end. 🔴 **ORDER: `npm test` → `db:seed` → `start`.** Two of Richard's `next start`
servers (ports 3000 and 3210) were running throughout and **need a restart** — they hold pools
against a schema that was dropped underneath them.

---

# WHERE THE PHASE IS — 2026-08-18 (session 35)

| In the close? | Item | State |
|---|---|---|
| ✅ **E1** | UNI-001 — issuer + launcher | ✅ COMPLETE. AC4 settled s34. **No editor code item left** |
| ✅ **E2** | **Deployment** | ✅ **BUILT s35, NOT RUN.** `nodegx-community/ops/{provision,deploy}.sh` |
| ✅ **E3** | UNI-009 AC1 | ✅ MET (s31) |
| ✅ **E4** | UNI-013 slice 5 | ✅ BUILT (s32) |
| ✅ **E5** | Where it runs | ✅ **nexus-1** (D20) |
| ✅ **E6** | Sending account | ✅ **Brevo — BUILT s35.** ⚠️ Richard owes the domain verification |
| ✅ **E7** | Artefact storage | ✅ **Hetzner Object Storage.** Download button needs no code |
| ✅ **E8** | `NOTIFICATION_LINK_SECRET` | ✅ CLOSED (s33). ⚠️ Richard must still set it |
| 🔴 **E10** | **A GitHub OAuth App** | 🔴 **Richard's, and still the first domino** |
| 🔴 **E9** | Smoke drive on the box | 🔴 Blocked on the deploy being run |
| 🆕 **out** | UNI-021 · UNI-022 · UNI-023 | **NOT in the close** |

---

# 🔴 SESSION 35's FINDINGS — five, and four of them outlive their tasks

### A. 🔴 THE MIGRATIONS COULD NOT BE RUN TWICE, AND THE SAFE-LOOKING FUNCTION WAS THE DESTRUCTIVE ONE

`src/db/sql/` holds **155 `create` statements and zero `if not exists`** — every migration is
written as a first run. So a deploy's database step had two functions available and **both were
wrong**:

- `applySchema` re-runs 0001 and errors on `create type account_kind` — a half-applied deploy,
  reported as a message about an enum.
- 🔴 **`resetSchema` SUCCEEDS.** It drops `public` first, so it returns cleanly — **and takes every
  account on the box with it**.

⚠️ **The second is the one that matters, because it is the one a deploy script reaches for: the
function that does not error.** Now `migrateToLatest` — a `schema_migrations` ledger, one
transaction per migration paired with its own ledger row, and a **checksum comparison** that
refuses to continue if an already-applied migration has since been edited (that edit is applied on
your laptop, absent on the box, and **every drift check passes on both**).

✅ `tests/e2-migration-ledger.test.ts`, 9 specs, **both controls** — one asserting `applySchema`
throws, and one asserting **`resetSchema` does NOT throw and empties the table**, so nobody reads
the file and concludes a mistake would be caught.

### B. 🔴 THE SENDING DOMAIN IN THE DATABASE WAS ONE NOBODY OWNS

`notification_policy` still defaulted to `sending_domain = 'mail.nodegx.dev'` and
`site_origin = 'https://community.nodegx.dev'`. **D2 was amended to `.io` on 2026-08-17 and these
two rows never moved**, because nothing had ever sent mail and so nothing ever read them in anger.

Deployed as it stood: every envelope stamped `notifications@mail.nodegx.dev`, refused by Brevo as
an unverified sender, and **every unsubscribe link pointing into a domain that does not exist**.

✅ Migration `0012` changes the **defaults** as well as the row — a deploy step would have been
forgotten. ⚠️ It guards the `update` on the old values, so it cannot stamp on an operator's fix.

### C. 🔴 `outbound_emails` HAS NO DRAINER — AND THE DATABASE SAYS OTHERWISE

`relay.ts` inserts into it and reads it back. **Nothing sends it.** And `notify()` has a
`'relayed'` outcome meaning *"the relay is already mailing this, do not queue a second email"* — so
for an RFP response or a coaching booking, **the row records that a person was emailed by a queue
that never sends**.

⚠️ Its envelope is pinned by trigger to `relay_policy.relay_domain`, still `relay.nodegx.dev`,
**unregistered**. `0012` deliberately does NOT fix it: pointing it at a domain we own would make it
*look* shippable while changing nothing about whether a relayed message reaches anybody.
**Phase 67b, item A.**

### D. E7 was blocking less than four sessions of notes claimed

The old list said UNI-020's *"Download the starter project"* button was blocked *"until artefacts
have a home"*. **`articles.project_url` already exists.** The button needs a URL, not a build — a
public object URL written into that column makes it render. 🔴 **A premise inside a task file is
still a premise**, and this one had been relayed three times.

### E. Two of my own instruments were wrong before the code was

- The payload-completeness check compared against `JSON.stringify(payload)` and reported `body`
  **missing from a payload that carried it perfectly** — JSON escapes the newlines the body
  contains. ✅ Rewritten to compare **values**. 🔴 *An instrument that fails on a correct answer is
  worse than no instrument.*
- `deploy.sh`'s first draft used `declare -A`. **macOS ships bash 3.2**, where that is a syntax
  error — and the script runs from the laptop. ✅ Caught by `bash -n` before it ever ran.

---

# ⚠️ TRAPS FOR WHOEVER RUNS THE DEPLOY

- 🔴 **A 308 proves nothing.** Caddy redirects http→https for **every** host, known or not, so an
  unknown `Host` returns the same 308 this site does. Read `:2019/config/` and curl over real TLS.
- 🔴 **Caddy is all-or-nothing on that box.** `provision.sh` validates the whole config with the new
  drop-in and **removes the drop-in** if it does not validate. Do not bypass that.
- 🔴 **Brevo answers an unauthorised source IP with 401**, which reads exactly like a bad key.
  `api.brevo.com` publishes AAAA records and Node prefers v6. `BrevoTransport`'s constructor calls
  `preferIpv4()` — **both** `dns.setDefaultResultOrder('ipv4first')` and
  `net.setDefaultAutoSelectFamily(false)`, because Happy Eyeballs beats ordering alone.
- ⚠️ **`SITE_ORIGIN` unset defaults to `http://localhost:3000`** — cookies without `Secure`,
  callbacks pointing at a laptop, and a site that comes up and half-works. The deploy refuses
  anything that is not `https://`.
- ⚠️ **The backups are on the same box as the database.** Survives a dropped table, not a lost
  host. Phase 67b, item B.
