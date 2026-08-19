# Phase 67b — next session

**Written 2026-08-19 (session 39), overwriting nothing (first one for this phase).**
Platform repo: `~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task files**;
its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **Phase 72 runs in parallel in the OpenNoodl checkout** (editor palette, NAT-003 as of this
session). Territory has been file-disjoint and stayed that way. **Announce source edits; both
sessions edit `dev-docs/`.**

---

## 1. Built vs. driven, per item

| Item | Built | Driven | Note |
|---|---|---|---|
| **B — off-host backups** | ✅ 3 scripts + provision/deploy wiring | ✅ **FULLY DRIVEN against the real destination.** Richard supplied the keys the same session: bucket reachable over SigV4 at `nbg1`, first backup uploaded and **verified by md5 read back off Hetzner**, first restore check **restored 49 tables and 1 account from the Hetzner object**. Timers armed (daily 00:03 UTC, restore check Sun 04:00) | ⚠️ **The dump is UNENCRYPTED at rest** — the one thing still open |
| **UNI-017 — the queue and the signal** | ✅ all 5 ACs, 35 specs | 🟡 **library + handler driven; no browser** — pages compile and render in specs, nobody has looked at `/bench` or a profile in a browser since the change | `d0ba01c` |
| **C — the uncommitted hotfix** | ✅ committed `36748ae` | n/a | Its **root cause is still unknown** |

🔴 **The phase's real debt in one number: TWO items built-but-undriven-in-a-browser.** Neither is
risky (both are server-rendered and spec-covered) but neither has been *looked at*.

🔴 **AND ONE UNDEPLOYED MIGRATION.** `0015` exists locally and **has not been deployed**. The live
site does not have the queue lens, the signal tables or the same-here route. Deploying is
`ops/deploy.sh 49.12.102.195` — **it rebuilds and restarts a live site sharing a box with three
others**, so it was deliberately left for a session that has been asked to do it.

## 2. Gate readings — 2026-08-19, `nodegx-community@d0ba01c`

| Gate | Reading | ⚠️ |
|---|---|---|
| `npm test` **after `npm run build`** | **1010 passed / 0 failed / 0 skipped** (37 files) | The number to compare against |
| `npm test` **alone** | 1006 / 0 / **8 SKIPPED** | 🔴 The skipped file is `uni015-bench-http.test.ts`, **the only real-HTTP one** — it skips with no `.next`. **BUILD FIRST** |
| `npx tsc --noEmit` | clean | |
| `npm run build` | clean, 22 routes | |
| Baseline at session start | 962 / **6** | The 6 were the P72 peer's in-flight `colors.css`; they cleared it in `ad21f97` |

⚠️ Postgres is **55432** (docker compose), not 5432. Full suite ≈ 5 min.

## 3. What this session settled — including where the task files were wrong

- 🔴 **The README's framing of item B was wrong, and understated it.** It said the dumps were on the
  same box and needed moving. **The dump directory was EMPTY and the timer had never fired** —
  `LAST` and `PASSED` both `-`. *Provisioned* and *ever having produced a file* are different
  claims. The item would have closed as "moved off-host" over a mechanism nobody had seen work.
- 🔴 **UNI-017's queue could not move the number it was built for.** `unansweredQueue` selects
  *"nothing accepted"*; the queue exists to move D16's median **first reply**, and a replied thread
  cannot improve that, ever. The lever filled with inert rows and **got worse as the community got
  healthier**. `awaiting` now has **no default**; `unansweredQueue` is untouched.
- 🔴 **I opened a hole and another task's instrument caught it.** `bench_same_here` shipped in draft
  with **no minor gate** while every other Bench write has one. **UNI-005's data inventory** found
  it by censusing the live schema. Expect **three** derived-from-disk guards to fire on any new
  table/column/route here (typed schema mirror · data inventory · UNI-011 route inventory) — they
  are right every time.
- 🔴 **The AC2 control failed a spec of MINE**, not the code: one `it` asserted ordering *and*
  matching, and a spec that mixes two mechanisms cannot say which broke. Split.
- ✅ **The README's instruction about NAT-006 was already discharged** — phase 72 wrote it at
  scoping. Checked with one grep rather than assumed.
- ✅ **A live hotfix existed only on the box and in an uncommitted file.** Committed as a record.

## 4. What to do next

### Richard's, and nothing here can proceed without him

1. ✅ ~~Mint the Hetzner keys~~ **SUPPLIED 2026-08-19** and in `~/nodegx-community-deploy.env`
   (bucket `nodegx`, endpoint `nbg1.your-objectstorage.com`). 🔴 **THE SAME KEYS UNBLOCK E7's
   CAPTURE UPLOAD** — that item is no longer blocked on anything of Richard's.
2. 🔴 **STILL OPEN — `BACKUP_ENCRYPT_PASSPHRASE`.** The dump sits in the bucket **unencrypted**,
   holding real accounts and email addresses. Built and tested both ways; one line plus a re-run of
   `ops/install-backup.sh`. ⚠️ Then **write the passphrase somewhere that survives the laptop** —
   the weekly check proves the passphrase still works, not that anyone else can find it.
3. ⚠️ **Whether to deploy `0015`** — see the undeployed-migration note above.

### An agent alone, in order

1. **Deploy, once 1 above lands** — and then *read* `last-backup.json` and
   `last-restore-check.json`, which `deploy.sh` now prints. Do not report backups as working off the
   exit code.
2. **UNI-006 + UNI-007's intake as ONE tranche.** They share a client and a transport. 🔴 **Build on
   P72 NAT-011's editor-side community client** — a second client in the editor is a defect UNI-011
   already paid for once. Check NAT-011's state first.
3. **UNI-008** (online in one click / off in 45 days), **UNI-010's remainder**, **UNI-012** (F4 on a
   packaged install) — independent, any order.
4. **E7's capture upload** — same shape as B: a form, then a small build, gated on the same keys.
5. ⚠️ **Optional, small, and it would have saved this session an hour:** make `ops/deploy.sh` refuse
   a dirty tree without a flag and stamp the deployed commit on the host. *Deployed* and *committed*
   are independent facts today and nothing checks the second.

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014**; UNI-018 is **NAT-015**; UNI-011's rail icon is
**NAT-012 AC7**. Do not re-litigate — the boundary was settled 2026-08-19.
