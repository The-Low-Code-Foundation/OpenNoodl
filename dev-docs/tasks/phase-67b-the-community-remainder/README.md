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

## 🔴 Amended 2026-08-19 — three items left this phase, and one line below was false

Phase 72 (*nobody has to leave*) was scoped on 2026-08-19 and overlaps this phase at three points.
Rather than track them in two ledgers, **they are struck from here and owned there**:

| Left this phase | Now | Why it moved |
|---|---|---|
| **Gap A**, the mail drainer | **[P72 NAT-014](../phase-72-nobody-has-to-leave/NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)** | Three phase-72 tasks (NAT-009 AC5, NAT-010 AC5, NAT-013 AC4) assert that a write from the editor **sends**. A blocker owned by a phase nobody is working on is how those tasks ship a feature that tells somebody they were emailed |
| **UNI-018** — pull a graph | **[P72 NAT-015](../phase-72-nobody-has-to-leave/NAT-015-A-GRAPH-YOU-CAN-PULL-INTO-YOUR-PROJECT.md)** | NAT-007 builds the attachment *renderer*; pulling is the same seam's other half, and it is phase 72's closing sentence |
| **UNI-011's remainder** — the rail icon drawn for a D15-refused viewer | **P72 NAT-012 AC7** | NAT-012 audits every door in the editor. Forbidding it from closing this one was ledger tidiness buying a worse product |

🔴 **And section A below understated the defect.** Measured against `nodegx-community` at `aa7bd6a`
on 2026-08-19: it is not that the relay queue lacks a drainer. **No mail leaves this platform at
all.** `drainOutbox` is written and thoroughly tested and is **imported by exactly two files, both
tests** — no route, no npm script, no systemd unit (`ops/provision.sh` installs two timers: the app
and the `pg_dump`). So the sentence below claiming *"D19's condition is met for the Bench"* **was
wrong from the day it was written**: a transport is not a delivery, and *"someone answered you"*
has never been sent either. Corrected here rather than silently, and NAT-014 owns the amendment to
the P67 ruling record.

⚠️ **Everything else in this file stays here.** Phase 72 defers to it by name.

---

## What came in from phase 67

| Task | What it is | Why it was held out of the close |
|---|---|---|
| ~~**UNI-017**~~ | ✅ **BUILT 2026-08-19 (session 39) — all 5 ACs.** 🔴 **The queue could not move the number it was built for**: it selected *"not accepted"* and exists to move *"first reply"*, and a replied thread cannot improve a first-reply median. See [UNI-017](../phase-67-nodegx-university/UNI-017-THE-QUEUE-AND-THE-SIGNAL.md) | ~~The Bench answers questions without it~~ |
| ~~**UNI-018**~~ | ~~Pull a graph~~ — 🔴 **MOVED 2026-08-19 to [P72 NAT-015](../phase-72-nobody-has-to-leave/NAT-015-A-GRAPH-YOU-CAN-PULL-INTO-YOUR-PROJECT.md)** | It rode the same seam as NAT-007's renderer. Not this phase's any more |
| **UNI-007** (intake) | The lesson beamed into the editor — the intake half | The editor half shipped; the platform's intake is the other end of a bridge nobody crosses yet |
| ~~**UNI-006** (bridge)~~ | ✅ **BUILT 2026-08-19 (session 42).** Six `/api/v1/me` routes, the editor's client, and **the caller** — "check my work" hands the work in. AC1 is a round trip over HTTP. See [UNI-006](../phase-67-nodegx-university/UNI-006-ASSIGN-GRADE-REVIEW.md) | ~~the bridge is a second client~~ — 🔴 **and the round trip runs into a wall that is not this task's:** the platform hosts **no curated lesson bundles** (`curriculum.ts`: *"There is no download, no install and no bundle"*; all 15 lessons `in-writing`). `org_shelf` works end to end; `curated` has nothing to pull. **UNI-007 §11's owed *curriculum hosting*, since 2026-07-25** |
| ~~**UNI-011**~~ (in-editor views) | ✅ **BUILT 2026-08-19 (session 37)** — the rail entry, four sections, the threshold as a readout. 🔴 **D21 reversed D16** at Richard's instruction; the panel ships empty and he fills it | ~~⚠️ ONE REMAINDER~~ — the rail **icon** drawn for a D15-refused viewer 🔴 **MOVED 2026-08-19 to P72 NAT-012 AC7**, the task that audits every door. An icon is a door, and the task auditing doors should close it |
| **UNI-008** | Online in one click, off in forty-five days | Hosting. Not in the closing sentence, and it is a product decision as much as a build |
| **UNI-010** (remainder) | A tutorial your own Claude can write — the remaining slice. ✅ **§8.2 CLOSED 2026-08-20 (session 46)**: the render harness renders **every routed page**, not the start page alone, so a defect on page two is no longer certified `Rendered clean` — **11 specs**, and F4 inherited it with no change to the grader. 🔴 Two things worth not re-deriving: the recorded mechanism (a 404 on named routes) was **not** what blinded F4 — the runtime routes on the *hash*, which never reaches a server, so **nothing ever navigated**; and rendering every page exposed a latent bug that scored a **correct** pinned control at **14 `empty-list` errors** until probes were scoped per page | 3/3 criteria met on the built slice; the remainder is scope, not debt |
| ~~**UNI-012**~~ | ✅ **BUILT 2026-08-20 (session 45) — all 4 ACs, measured on a packaged build.** The harness ships **inside `app.asar`**, not beside it: `ELECTRON_RUN_AS_NODE` reads and executes inside an asar, so the 14MB viewer bundle the editor already ships is **not duplicated**. 🔴 §3's "three data files" was wrong both ways — two of the three were already shipped, and `DefaultTokens.ts`, which it never lists, was not. See [UNI-012](../phase-67-nodegx-university/UNI-012-F4-ON-A-PACKAGED-INSTALL.md) §0 | ~~An editor-packaging check~~ |
| ~~**UNI-013 slice 4**~~ | ✅ **BUILT 2026-08-18 (session 36) — and it was NOT Richard's after all.** Reassigned to us that day and built the same day: twelve files generated from **four family marks and one tier rule** by `scripts/draw-badges.mjs` | 🔴 **This row said *"RICHARD'S, and not code"* and was wrong from 2026-08-18 onwards.** ⚠️ The files carry no colour — an `<img>`-loaded SVG inherits none, so the profile paints them through a CSS mask and both themes are right by construction |

---

## 🔴 Gaps found that were NOT on anyone's list

A and B were measured while closing phase 67 on 2026-08-18; **C was found on 2026-08-19** while
picking this phase up. They are the reason this phase should not be treated as leftovers. Every one
is a case where a thing reads as working and is not.

### A. ~~`outbound_emails` HAS NO DRAINER~~ — 🔴 **MOVED to [P72 NAT-014](../phase-72-nobody-has-to-leave/NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)** on 2026-08-19

⚠️ **Kept here, struck through, because the paragraph below contains a claim that was believed for
a day and acted on.** The work is NAT-014's; the correction is this phase's to record.

`src/lib/relay.ts` inserts into `outbound_emails` and reads it back. **Nothing sends it.** ~~Phase 67
closed E6 by giving `notification_deliveries` a real transport (Brevo), and that is genuinely the
queue behind *"someone answered you"* on the Bench — so D19's condition is met for the Bench.~~

🔴 **That last sentence is FALSE and was false when written.** A transport is not a delivery.
`drainOutbox` — claim, send, mark — exists and is tested against a real database, and **nothing in
production calls it**: two importers, both test files. So the Bench's *"someone answered you"* has
never been sent either, and D19's condition is met for **nothing**. This is *build the caller*
again, and the instrument that hid it was a green suite calling the function directly.

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

### B. ~~Backups are on the same box as the database~~ — ✅ **DONE 2026-08-19 (session 39). THE DATABASE IS OFF THE BOX.**

`ops/provision.sh` installed a daily `pg_dump` with 14 days of retention into
`/var/backups/nodegx-community`. ⚠️ **That survives "somebody dropped a table". It does not survive
"the box is gone"** — and the box is nexus-1, shared with `nodegx.io`,
`nexus.digitalbricks.io` and `digitalbricks.io`.

🔴 **AND IT HAD NEVER RUN ONCE.** Measured before touching anything: `/var/backups/nodegx-community`
was **empty**, `systemctl list-timers` showed `LAST` and `PASSED` as `-`. The timer was provisioned
that morning and first fires at midnight, so **nothing had ever established that `pg_dump` worked on
that host at all** — the item read as "we have local backups, they just need moving", and the true
state was "we have a timer". ⚠️ This is [[verify-the-consequence-not-just-the-mechanism]] on
infrastructure: *provisioned* and *ever having produced a file* are different claims, and only the
second one is a backup.

**What is built** (`nodegx-community@4c9c07d`, three scripts):

| | |
|---|---|
| `ops/backup.sh` | dump to a `.part` name → **prove it** → rename → upload → **read the object back** → prune both ends |
| `ops/restore-check.sh` | weekly: pull the newest **object**, decrypt, restore into a throwaway database, count, drop |
| `ops/install-backup.sh` | idempotent wiring, called by `provision.sh` **and by every deploy** |

🔴 **Three design points that are the actual content, not decoration:**

1. **The dump is proved twice, and the second proof is the one that matters.** `pg_restore -l`
   shows the archive *parses*; comparing its `TABLE DATA` count against the live schema shows it is
   *complete*. A dump holding 30 of 49 tables passes the first and fails the second — and because
   the dump is written to `.part` and only renamed once it passes, **a file with a real backup's
   name is a file that passed**. The old one-liner's `>` created the file before `pg_dump` ran, so a
   dump that died half-way left a plausible name with a fresh mtime.
2. **The restore check goes back to the object store, not to the local file.** Restoring the local
   dump would test `pg_restore` and nothing else. The copy whose readability is genuinely in
   question is the one that would still exist if the box did not.
3. **An unconfigured off-site EXITS NON-ZERO.** The local dump still runs and is kept; the unit
   fails, because a green timer meaning *"there is a file next to the database"* is precisely the
   defect this item is about. `OFFSITE_MODE=off` accepts local-only **as a decision on the record**,
   and still says so every day in `last-backup.json`, which `deploy.sh` now prints on every deploy.

**Measured on nexus-1 — six outcomes, not one:**

| | |
|---|---|
| unconfigured | dump ok **433,391 bytes, 49/49 tables**, unit **exit 1**, status file honest |
| full pipeline | encrypt → off-box → download → decrypt → **49 tables, 1 account** restored |
| control A | corrupted **encrypted** object → FAILS (*gpg: message has been manipulated*) |
| control B | wrong passphrase → FAILS (*bad session key*) |
| control C | empty prefix → FAILS — **not** "0 objects, fine" |
| control D | corrupted **plain** object → FAILS (*pg_restore: end of file*) |

⚠️ **The S3 leg is exercised through rclone's LOCAL backend**, so everything except Hetzner's
endpoint and its SigV4 signature is proven. Say that rather than "backups work".

🔴 **THE HOST IS DELIBERATELY LEFT FAILING NIGHTLY.** It has the new units and an *unconfigured*
destination, so from tonight `nodegx-community-backup.service` goes red every day until the keys
exist. That is the honest state and it was chosen over a quiet local-only pass.

## ✅ CONFIGURED AND RUNNING — 2026-08-19, with the real destination

Richard supplied the keys the same session. Measured against **Hetzner Object Storage `nbg1`,
bucket `nodegx`, prefix `nodegx-community/`** — not against a stand-in:

| | |
|---|---|
| Bucket reachable | ✅ SigV4 against `nbg1.your-objectstorage.com`, bucket listed, empty |
| First real backup | ✅ `nodegx_community-20260819-152058.dump`, **433,391 bytes, 49/49 tables**, verified by **md5 read back off Hetzner** (`37302e2b…`) |
| First real restore check | ✅ pulled that object **back down from Hetzner**, restored **49 tables, 1 account** into a throwaway database, dropped it |
| Timers armed | ✅ backup **daily ~00:03 UTC**, restore check **Sundays 04:00 UTC** |

🔴 **The claim is now "we can restore", not "we have backups"** — and the difference was measured
rather than assumed, on the copy that would survive the box.

### 🔴 DECIDED 2026-08-19 by Richard — the dump is UNENCRYPTED at rest, on purpose

Asked and answered the same session: *"leave it empty for now."* `BACKUP_ENCRYPT_PASSPHRASE` is
empty, so the object in the bucket holds real accounts and email addresses in the clear.

⚠️ **This is a decision on the record, not an unanswered question** — do not re-open it as though
nobody had chosen. What makes it defensible today: the bucket is private, and nexus-1 is already the
same trust boundary as the database itself, so encrypting the dump while the box holds the plaintext
would move the risk rather than remove it.

🔴 **What would change the answer**, so a future session recognises it rather than re-deriving it:
the bucket gaining a second reader (E7's artefacts are going into the same bucket under a different
prefix), the credentials being shared with anything outside this laptop and that box, or the account
table growing past the handful of people it holds now. **The mechanism stays built and tested both
ways** — turning it on is one line in `~/nodegx-community-deploy.env` plus a re-run of
`ops/install-backup.sh`, and the weekly restore check already exercises the decrypt path.

⚠️ **The cost that made it worth asking, kept here because it does not go away:** an encrypted
backup whose passphrase nobody can find fails on the one day nobody has time to debug it. The Sunday
check proves the passphrase still *works*; it cannot prove anyone else can *find* it. **If this is
ever switched on, the passphrase has to live somewhere that survives this laptop.**

**What was owed, and is now supplied** (same shape as E7 and E10):

```
# add to ~/nodegx-community-deploy.env, then: ops/deploy.sh 49.12.102.195
HETZNER_S3_ACCESS_KEY=...
HETZNER_S3_SECRET_KEY=...
HETZNER_S3_BUCKET=nodegx-community-backups
HETZNER_S3_ENDPOINT=https://fsn1.your-objectstorage.com   # or nbg1 / hel1
BACKUP_ENCRYPT_PASSPHRASE=                                 # optional — see the decision below
```

⚠️ **These are the same Hetzner Object Storage credentials E7's capture-upload path needs.** One
minting unblocks both. The bucket must exist before the first run (`--s3-no-check-bucket` is set, so
the script will not try to create it — creating a bucket needs a wider permission than writing to
one, and a backup job should not hold it).

🔴 **AN OPEN DECISION, AND IT IS NOT A TECHNICAL ONE.** The dump holds real accounts and email
addresses. `BACKUP_ENCRYPT_PASSPHRASE` turns on gpg AES256 before anything leaves the box, and it is
**built and tested both ways** — but *encrypting the backups and losing the passphrase is worse than
not backing up at all*, because it fails at exactly the moment nobody can afford to debug it. The
weekly restore check tests the passphrase every Sunday, which removes the *drift* failure but not
the *where is it written down* one. **Set it and record where the passphrase lives, or leave it
empty deliberately.** Not answering is the one option that is worse than either answer.

---

### F. 🔴 A malformed id was a 500 — and not even JSON — on nine API routes

Found 2026-08-19 (session 42) **by measurement, not by review**, while building UNI-006's
bridge. Every route that puts a path segment into a `uuid` column handed postgres `invalid
input syntax for type uuid`; nothing caught it; Next answered with its own error page. So the
first line of `docs/API.md` — *"JSON. `Content-Type: application/json` on every response,
including errors"* — was **false for all nine**. Six pre-dated the task; three were being added
by it, which is the only reason it came to light.

🔴 **The generalisable half, and it is about fixtures rather than about ids.** Every route spec
in that repo calls handlers with ids it seeded itself, so **every id is well-formed by
construction**. The fixtures and the code agreed about what an id looks like, and the only
party that could disagree was a client that got it wrong — which is to say, the population the
API exists for. ⚠️ *A test suite that manufactures its own inputs cannot test the shape of an
input.*

✅ Fixed with one shared `isId` answering the **same** `notFound()` a wrong id gets — a
distinguishable "malformed" reply would be a third body in a family that function exists to
keep at one. `tests/api-malformed-id.test.ts` derives the route list **off disk**, so a route
added next year is in the sweep the day it is written; verified red by removing one guard.

### G. ⚠️ A test harness pinned the spawned process to the DEFAULT database

Same session, and it cost the first full-suite reading. `tests/nat014-outbox-drain.test.ts`
seeds through `freshDb()` — which honours `DATABASE_URL` — and spawned the drainer with
`DATABASE_URL: DEFAULT_DATABASE_URL` hard-coded. On the shared database it passes 20/20 and
**cannot tell**. On a per-session database — the arrangement this repo uses so two agents can
work at once — it failed **11 of 20**, every failure reading as *"the drainer sent nothing"*.

🔴 **A harness fault wearing the feature's face**, and the file makes this exact argument about
the systemd unit one screen earlier: *"a drain pointed at a different database from the app is
a drain that reports success and sends nothing."* It was true of the harness as well. ✅ Fixed
to `databaseUrl()`; verified 20/20 on both.

---

### C. 🔴 A production hotfix existed in exactly two places, and neither was a repository

Found 2026-08-19 (session 39) on picking this phase up, not looked for. `nodegx-community` had an
**uncommitted** `src/lib/session.ts` in the working tree, `md5 d36b7936` — **byte-identical to the
copy running on nexus-1**. So the only two copies of a live sign-in fix were *a running box* and
*one uncommitted file in a checkout several sessions share*. ✅ **Now committed as `36748ae`**, as a
record rather than as new work.

⚠️ **What it fixes is not understood, and that is the part that stays open.** `createSession` and
`sessionCookie` now coerce `timestamptz` to a `Date` at the boundary, because the deployed server
returned a value carrying neither `toUTCString` nor `toISOString` and threw a 500 on a sign-in whose
account and session rows **had already committed** — a real account, a real session, and no cookie
to reach either with. Retrying just minted a second orphaned session. postgres.js is documented to
parse `timestamptz` into a `Date` and does so when probed in isolation *on that same box*, same
driver 3.4.9, same pool, same statement. The comments in the file say all of this and say plainly
that tolerance is not an explanation.

🔴 **The live remainder: roughly half this codebase wraps DB timestamps in `new Date(...)` and half
calls date methods directly** (`home.ts:133`'s weekly-call projection, `lists.ts:434`'s
`lastActiveAt`). **The defended half is evidence somebody hit this before and patched locally. The
undefended half is still live**, and two call sites already failed in succession — which is what a
type that is a *claim* rather than a *guarantee* looks like from the outside.

✅ **The generalisable half:** *deployed* and *committed* are independent facts, and nothing checked
the second. `ops/deploy.sh` rsyncs the working tree — it neither required a clean tree nor recorded
what it shipped, so a hotfix typed straight into a deploy left no trace anywhere a future session
would look. ✅ **BUILT 2026-08-19 (session 40) — see section E below**, which also records the two
defects it found within an hour of existing.

### D. 🔴 A queue that could not move the number it was built for — and the instrument that caught what it opened

Found and fixed 2026-08-19 while building UNI-017, and recorded here because the *shape* generalises
past that task. `unansweredQueue` selected `accepted_post_id is null`; the queue exists to move
D16's median **first reply**. A thread that has already been replied to **cannot improve a
first-reply median, ever** — so the surface built to move the metric was filling with rows inert to
it, and **the more the community answered without accepting, the more of the queue went inert.**
Nothing threw. No test failed. The number simply did not move.

✅ **The generalisable half:** *a surface built to move a metric should be filtered by that metric's
own denominator.* Ask what set of rows can still change the number, and check that the surface shows
that set — not a set that merely correlates with it.

🔴 **AND THE HOLE IT OPENED, caught by a different task's instrument.** The first draft of the
signal table had **no minor gate**, while every other Bench write is gated by `bench_author_gate` —
an org-minor who cannot ask or answer could have pressed a button that put a row of theirs into a
roadmap query. **UNI-005's data inventory found it**, because it censuses the *live schema* and
refuses to pass until every new free-text column is classified, and classifying `node_type` is what
forced *"who can write this row?"* to be asked out loud. ✅ **This is the payoff of
[[run-a-checker-over-the-artefacts-that-already-exist]]**: an instrument written for one criterion
caught a defect in a different one, a task later, with nobody looking for it. Two more fired the
same way — the typed schema mirror and UNI-011's route inventory.

⚠️ **And one about the suite, which is this phase's kind of defect:** `npm test` alone reports
**1006 tests with 8 skipped**, and the skipped file is the **only one that drives real HTTP** — it
skips when there is no `.next` build. So the default command reads as a full green pass with the
end-to-end file silently absent. **Build first.** 1010/0 either way once you do.

### E. ✅ A deploy can be named — and the refusal caught something real on its first run

Built 2026-08-19 (session 40), out of section C's closing paragraph, and it stopped being a
tidiness item within the hour.

**What `ops/deploy.sh` does now:** a dirty working tree **refuses, before the rsync**, naming the
files and the way out (`--allow-dirty`, or `NODEGX_ALLOW_DIRTY=1`); every deploy stamps
`/etc/nodegx-community/deployed.json` with commit, branch, dirty flag, time and who; what is live
is printed **before** the push replaces it, and the new stamp is **read back off the host** rather
than echoed from the variable that was just sent. Untracked files count as dirty — rsync sends an
untracked file exactly like a modified one, and a new migration is untracked before it is committed.

🔴 **Three things worth keeping, none of which was the feature.**

**1. The gate was too forgiving, and thirteen green tests proved nothing.** `ops/` was outside every
gate — nothing in `tests/` had executed a line of it — so the work came with
`tests/ops-deploy-provenance.test.ts`, which **runs** the script against stubbed `ssh`/`rsync`/`curl`
rather than grepping its source. It passed 13/13. **The first real deploy then died before pushing a
byte**, at `$SSH "cat $STAMP_FILE 2>/dev/null" | python3` — real ssh returns the remote command's
status, `cat` on a missing file is 1, and the script runs under `pipefail`. Reading a stamp that
does not exist yet is the normal case **exactly once**, on the first deploy after the feature ships.

The stub had answered `cat <missing file>` with *"print nothing, exit 0"*, which is not what `cat`
does — so `cat x 2>/dev/null` and `cat x 2>/dev/null || true` were **indistinguishable inside the
harness** while being the difference between a deploy that works and one that dies. ✅ **A stub more
forgiving than the real binary hides the bug it was built to catch.** The stubs now rewrite host
paths and **execute** the command, so `||`, `&&`, redirections and exit statuses come out right for
free; with the `|| true` removed again, **7 of 13 go red**. ⚠️ The same shape sat unnoticed in the
two *backup* status reads, where it made the `🔴 NO BACKUP HAS EVER RUN` branch — the entire reason
those blocks exist — **unreachable by the path that prints it**.

**2. The refusal's first catch was a peer's uncommitted work, not mine.** Between the pre-flight
`git status` and the deploy, the phase-72 session writing NAT-014 saved `scripts/drain-outbox.ts`,
`ops/install-mail.sh` and a modified `package.json` into the **shared checkout**. The deploy refused
and named them. Without it, another session's half-finished mail drainer would have gone to
production. 🔴 **`--allow-dirty` would have been exactly the wrong answer**; the right one is
**deploy from a pristine `git clone` of a named commit**, which satisfies the refusal honestly
instead of silencing it, and is how 0015 actually went out. ⚠️ **This generalises past this repo:**
`deploy.sh` ships the working tree of a checkout that more than one session writes to, so
*"my tree is clean"* is a claim with a lifetime measured in minutes.

🔴 **And the same afternoon, the inverse.** A later fix was committed as
`git commit -m ... -- ops/deploy.sh` — a pathspec **specifically to avoid sweeping a peer's
staged files**, which is the habit this repo already learned. It guards the wrong direction:
**a pathspec commit takes the WORKING TREE**, so it swept ~74 lines of the peer's *unstaged*
NAT-014 wiring into a commit titled as a one-line deprecation fix. The commit is incoherent on
its own — it invokes `ops/install-mail.sh`, which is still untracked, so a clone of it rsyncs and
then dies at 127 — while the **working tree is correct**. ✅ **Left alone deliberately**: the peer
committed the missing half within the hour, and rewriting history to un-sweep is worse than the
sweep. ⚠️ **`git add <paths>` and `git commit -- <paths>` protect against opposite hazards, and
neither protects against both.** The only thing that does is the index technique — build the
blob from `HEAD` plus your own hunks and `update-index` it — which is worth the four lines when a
peer is live in the same file.

**3. A test that asserts a message is not a test that asserts the deploy survived.** The
*"reports an unstamped host as unstamped"* case passed against the broken script, because the script
printed that exact line **and then died**. It now asserts the deploy carries on. Same shape as the
`NODEGX_ALLOW_DIRTY=1` case, which passed against a script with **no dirty check at all** — a script
that never checks also deploys a dirty tree and exits 0. Both were measured against the pre-fix
script rather than reasoned about: **12 red, 1 green, and the 1 green is the control** (a clean tree
still deploys) that has to stay green either way.

### ✅ 0015 IS DEPLOYED — 2026-08-19, session 40, at Richard's instruction

The live site had **none** of UNI-017 until this session; `0015` existed locally and had never been
applied. Deployed from a clean clone at `0cbd716`, and the readings rather than the exit code:

| | |
|---|---|
| migration | `already applied: 14` → `applied: 0015_uni017_queue_and_signal.sql` |
| stamp, read back off the host | ✅ `0cbd716fb011` on `main`, clean, `2026-08-19T17:37:06Z` |
| neighbours | `nodegx.io`, `nexus.digitalbricks.io`, `digitalbricks.io` — all `200 → 200`, unmoved |
| site / sign-in | `200` · `/api/auth/github/start` → `302` to github.com |
| off-site backup | ✅ ok, 2.3h old, 433,391 bytes, 49 tables, object on Hetzner |
| restore check | ✅ ok, **49 tables restored from the object** |

✅ **The consequence, not just the mechanism:** `POST /api/v1/bench/threads/:id/same-here` answers
**401** on the live site while a nonexistent sibling route answers **404** — a control pair, because
"the app returns 200" would have been true before this deploy too.

## Also landing here

**E7's second half.** Richard chose **Hetzner Object Storage** for artefacts on 2026-08-18. That
decision on its own unblocks UNI-020's *"Download the starter project"* button, because
`articles.project_url` already exists and a public object URL can simply be written into it —
**no code is owed for the button.** What *is* owed is the **capture image upload path**: a
`capture` attachment stores dimensions and consent and no image, so nothing has to be migrated.

✅ **BUILT 2026-08-19 (session 41) — all five pieces.** The two libraries landed in session 40;
the three surfaces and the `deploy.sh` line landed here. Nothing in E7 is blocked on Richard, and
nothing is owed to another task.

| | |
|---|---|
| `src/lib/objectstore.ts` | S3-compatible PUT/GET/HEAD/DELETE, **SigV4 by hand** — ~90 lines rather than several megabytes of `@aws-sdk`, on a codebase whose whole production dependency list is five packages. ✅ **Driven against the real bucket**: `e7-objectstore-http.test.ts` puts, heads, gets back **byte-identical** bytes and deletes, against `nodegx` at `nbg1` |
| `src/lib/captureupload.ts` | What may be stored and **whose it is**. Server-issued unguessable key + a **grant** (keyed HMAC over key and account) that intake must check |

🔴 **The hole `captureupload.ts` exists to close, because the obvious design has it.** *Upload
returns a key, the composer puts the key in the payload* lets anyone put **any** key in a payload —
including one they watched somebody else receive — and the thread would render a stranger's
screenshot under their name. The grant is stateless, follows `notifications.ts`'s unsubscribe token
**deliberately rather than by accident**, and is domain-separated so neither token can be replayed
as the other. ⚠️ Two more refusals worth keeping: the **bytes are sniffed, not the header** (a
`Content-Type: image/png` on a zip is one line for a sender to change), and a key **outside the
captures prefix is refused** — otherwise a payload naming a dump under `nodegx-community/` would
have the image route fetch and serve a database backup.

✅ **The visible half, built session 41:**

| | |
|---|---|
| `POST /api/v1/bench/captures` | Raw PNG in, `{key, grant}` out. 🔴 **May-you before can-we** — `board_actor_is_eligible` (the database function every board write uses, so D15's write rule has one copy) runs **before** the hosting check, or a read-only minor on a bucket-less deployment would be told `503 try later` when the answer is *never*, and a refusal would depend on whether a bucket was configured |
| **Intake** | `acceptCaptureImages` in both bench POST routes. 🔴 **The grant is STRIPPED before storage** — `attachmentsFor` serves the payload to every reader of the thread, so a grant left in it is a proof of ownership published to the people it exists to exclude |
| `GET /api/v1/bench/attachments/:id/image` | Serves through the app, never a public object URL. The join is the content: **the post AND its thread must both be unhidden**, the same filter `threadById` applies, so a moderated thread's capture stops being fetchable at the instant it stops being readable |
| `Attachment.tsx` | Renders the image, and a capture with none still renders its dimensions — the field is additive and nothing was migrated. A plain `<img>`, **not `next/image`**: the optimiser fetches the source itself and re-serves it from `/_next/image`, which would put an unauthenticated handler in front of the one route whose whole purpose is deciding who may see those bytes |
| `ops/deploy.sh` | The env line, **plus a `==> capture hosting (E7)` readout that greps the app env file ON THE HOST** |

🔴 **THE `deploy.sh` LINE WAS A LIVE BUG, AND EVERYTHING VISIBLE VOUCHED FOR IT.**
`install-backup.sh` wrote `HETZNER_S3_*` into `backup.env`; the daily `pg_dump` read them and
worked; every deploy printed a healthy off-site backup. The **app** reads a different file, so
`objectStoreConfig()` returned `null` on the live site. A working backup vouching for a broken
feature — [[a-project-level-drawn-count-vouches-for-a-broken-mechanism]] in ops clothes.
✅ **The test asserts the env file ON THE FAKE HOST, not the secrets file the harness wrote**: the
inputs were never the problem, so an input-side assertion would have passed for the whole time the
bug was live. Verified red-then-green — with the heredoc lines removed, all three E7 deploy tests
fail, the no-bucket control included.

⚠️ **The readout counts FOUR keys, not five.** `HETZNER_S3_REGION` is derived from the endpoint host
when unset, so counting all five would report a working deployment as broken — *a check has to
agree with the function it is checking.*

---

## The order, when this phase is picked up

⚠️ **Re-ordered 2026-08-19** — what used to be items 1 and 3 are partly in phase 72 now.

1. ~~**A** above — the relay drainer.~~ 🔴 **Now [P72 NAT-014](../phase-72-nobody-has-to-leave/NAT-014-THE-QUEUE-THAT-NOTHING-EMPTIES.md)**, and it is that phase's day-one task. Nothing here waits on it.
2. ~~**B** above — off-host backups.~~ ✅ **DONE 2026-08-19 (session 39), configured and running
   against Hetzner `nbg1`/`nodegx`** — first backup uploaded and verified by md5, first restore
   check restored 49 tables and 1 account back off the object store. ⚠️ **The dump is unencrypted
   at rest**; the mechanism is built and the passphrase is Richard's call. 🔴 **It was never "cheap" — it was never having run**, and the item
   would have been closed as "moved off-host" over a `pg_dump` nobody had ever seen produce a file.
3. ~~**UNI-017**~~ ✅ **BUILT 2026-08-19 (session 39), and ✅ DEPLOYED (session 40)** — see section E. (~~UNI-018~~ is P72 NAT-015.)
   ✅ **The warning below was already discharged** — NAT-006 carries it verbatim at its own line 75,
   written when phase 72 was scoped. Checked rather than assumed, and it cost one grep.
   ~~⚠️ When phase 72 designs the community API (NAT-006), triage and *"same here"* should not be
   designed *out* of it.~~ ⚠️ **What UNI-017 leaves for phase 72:** the *same here* press is an
   **API endpoint with no web control**, because this site's Bench is read-only by construction —
   every write is `/api/v1`, driven by the editor. **The button belongs in the editor**, and
   `POST/DELETE /api/v1/bench/threads/:id/same-here` is waiting for it.
4. The editor-side bridges (**UNI-006**, **UNI-007** intake) as one tranche — they share a client
   and a transport, and doing them separately means two sessions rediscovering the same seam.
   🔴 **P72 NAT-011 will build that client first.** Whoever picks these up builds *on* it; a second
   community client in the editor is the defect UNI-011 already paid for once.
5. **UNI-008**, **UNI-010**'s remainder, **UNI-012** — independent, any order.
6. ✅ **UNI-013 slice 4 is BUILT (session 36), and it was never going to be Richard's.** This line
   said it was his and not code; the artworks moved to us on 2026-08-18 and landed the same day.
   It blocked nothing then and blocks nothing now.
