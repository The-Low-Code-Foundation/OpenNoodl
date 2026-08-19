# Next session — phase 72

**Written 2026-08-19, fifth session.** **NAT-014's code is done** — the outbox has a caller, and
mail can now leave this platform. It has not yet left it: what remains needs a deploy and Richard.

## Read first, in this order

1. [NAT-014](NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md) §Status — the AC table, the one decision
   inside the drain, and **§"the gate had a hole shaped like the defect"**. Read that third section
   even if you never touch mail again; it generalises.
2. [TASKS.md](TASKS.md) §The order — **NAT-006 is now the long pole**, and NAT-004/005 are the rest
   of Tier 1.
3. [README §4](README.md) — five rulings still open (D5, D6, D7, D8, D10).

## What happened this session

**NAT-014 AC1, AC5 and AC6 are closed**, on `nodegx-community@b41a94a`. The caller is the
deliverable and it now exists: `ops/install-mail.sh` installs a unit and a five-minute timer, run
from **both** `provision.sh` and `deploy.sh` (install-backup.sh's split, for its reason — provision
runs once and nexus-1 is long past it), driving `scripts/drain-outbox.ts`. `npm run mail:drain` for
a human on the box.

Gates: `tsc --noEmit` clean, vitest **42 files / 1070 tests**, 0 failures.

### 🔴 The finding worth carrying: my own gate had a hole shaped like the defect

The caller census reads `ops/`, `package.json` and the route tree **off disk**, because the import
graph is what said everything was fine for weeks. Then the control removed the caller outright —
`ExecStart=/bin/true`, npm script deleted — and **the gate stayed green**, because a *comment* in
`install-mail.sh` mentions `scripts/drain-outbox.ts`.

A gate satisfied by prose about the mechanism is exactly the defect the task exists to fix, one
level up. ✅ Comments are stripped now and `package.json` is parsed to its script commands, and it
is **verified red — 4 of 16 fail with the defects reintroduced**. 🔴 **A green gate proved nothing
here and the red run took four minutes.** Do this to any "does a caller exist" check you write.

### 🔴 The second finding: the recovery `transport.ts` promises had no caller either

`transport.ts` says mail queued before the API key is installed *"still goes out afterwards,
because `drainOutbox` accepts `'failed'` among its states"*. That is only true for a caller passing
`states: ['queued','failed']`, and **nothing passed it** — the same defect one layer down.

Worse, the default path made it destructive: on a secure origin with no key, `UnconfiguredTransport`
throws per message and `drainOutbox` marks each row `failed`, so one timer firing after a deploy
that dropped the key would walk the **whole queue** into a state v1 never retries. ✅ The drain now
**refuses before the first claim** — no row is touched, and the queue drains when the key arrives.
That makes the promise true without adding a retry loop. `--retry-failed` stays a flag a human
types, and a spec asserts the timer's unit does not contain it.

### 🔴 The third finding, and the one that most affects YOU: the next deploy sends mail

`deploy.sh` installs the drain timer on **every** deploy, so the next deploy **for any reason** —
including an unrelated one-line change from another phase — starts mail leaving the live platform.
The 67b session raised this; it is a defect in my own first commit and it is now fixed (`c245679`).

A queued backlog older than seven days **refuses the whole drain** rather than sending it, because
`notify()` has been writing rows since UNI-014 and nothing ever emptied them. Releasing it is
`npm run mail:drain -- --send-stale`, typed by a human, on purpose. ⚠️ **Expect the first real
deploy to print that refusal** — that is the system working, not a bug.

## Where to start

**NAT-006 is the long pole** — 19 pages, 15 routes, zero endpoints for people/profiles/RFPs/
coaching/University, and five Tier-3 tasks queue behind it. It has no editor dependency.

**If you want to finish NAT-014 instead, it is now a deploy task, not a coding task:**

1. **AC7 + AC2 together.** Deploy `nodegx-community` to nexus-1, confirm
   `systemctl list-timers nodegx-community-drain.timer`, then make something notify a real address
   and **read the email**. The deploy prints the drain status on every run (`==> outbox drain`).
2. ⚠️ **Deploy from a pristine `git clone` of a named commit**, not the shared checkout — the
   dirty-tree refusal is real and `deploy.sh` rsyncs the working tree. A sibling caught my
   half-finished drainer that way today. `--allow-dirty` silences the check; a clone satisfies it.
3. **AC3 needs Richard, not code.** The recommendation is written up in the task file: do **not**
   build a second drainer (the relay's `Reply-To` is an alias on an unregistered domain with no
   inbound path — that is D10) and do **not** retire the relay (its trigger is UNI-004 AC1's proof).
   Instead let `'relayed'` queue an ordinary *"you have a new message on NodeGX"* notification,
   which needs no relay domain at all. **Not implemented deliberately** — it changes delivery on the
   privacy-sensitive path D10 is open about.

🔴 **Do not close NAT-009 AC5, NAT-010 AC5 or NAT-013 AC4 on the strength of this session.** The
machinery runs; nothing has reached a human. Those close when somebody reads one of these emails.

## Loose ends

- ⚠️ **`ops/deploy.sh`'s two NAT-014 blocks are in `f30677d`, a sibling's commit** — a
  `git commit -- <path>` takes the working tree, so my unstaged edits to that file were swept in.
  The tree is correct; rewriting to un-sweep is worse than the sweep. Not repaired, recorded.
- ✅ **D19's ruling record is amended** (`phase-67/RULINGS.md`), dated, with the narrow statement:
  the machinery runs and the condition is **still not met**.
- ⚠️ **`src/lib/notifications.ts`' header claimed the relay "is already mailing this event"** —
  false. Corrected in the source so the next reader inherits the gap rather than the claim. The
  behaviour is unchanged and still wrong; that is AC3.
- ⚠️ **Eight phase-72 files remain modified and uncommitted** (NAT-006/007/009/010/011/012/013 and
  the README) — unchanged from the last two handovers, still somebody else's unlanded edits. I
  committed only my own by explicit pathspec.
- ⚠️ **`AskAboutNodeDialog.module.scss` still carries the stale `bg-4` comment.** Untouched, same
  reason.
- ⚠️ **~99 files still paint words with a fill role** (NAT-002's remainder). Unchanged.
- ⚠️ **The active-line contrast finding from session 4 is still open by design** — 8/21 dark,
  10/21 light sub-AA, ratcheted. See NAT-003.

## Verification notes that earned their place

- 🔴 **`npx tsc --noEmit | head` reports `head`'s exit code, not tsc's.** Redirect to a file and
  read the real status; a peer and I briefly disagreed about a typecheck failure for this reason.
- 🔴 **A peer's report can be true and stale.** They saw a real `tsc` error in
  `scripts/drain-outbox.ts` — during the four-minute window when I had the file deliberately broken
  to verify the gate went red. ✅ Re-measure before acting on a relayed failure, and say which
  window it came from.
- ✅ **Reconcile the suite's file count against disk.** 39 ran, 42 exist — the three missing were a
  peer's, two written *after* vitest built its file list. The arithmetic (38/1023 baseline + my 16)
  is what made the numbers attributable rather than merely plausible.
- ✅ **The shared docker Postgres on 55432 is one database.** `freshDb()` drops and recreates
  `public`, so two sessions running DB tests at once corrupt both runs. Announce it; it cost
  nothing and the peer held off twice.
