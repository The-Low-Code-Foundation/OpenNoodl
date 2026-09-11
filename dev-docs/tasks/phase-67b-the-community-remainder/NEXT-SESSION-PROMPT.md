# Phase 67b — next session

**Written 2026-08-20 (session 49), replacing session 48's.** Platform repo:
`~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task files**;
its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **Check for live peers yourself — that is a per-session fact, not this file's to assert.**
Session 49 had three peers live. One of them was **working inside `nodegx-community` itself**
(phase 72 **NAT-009** — `src/lib/apiwrite.ts`, `board-http.ts`, the RFP responses route,
`nat009-*.test.ts`). 🔴 **The platform repo is no longer a checkout only this phase touches.**

---

## 1. 🔴 THE `next dev` 500 WAS HUNTED AND NOT CAUGHT — read the exclusions before re-hunting

Session 48 made this the top item for an agent alone. It is **not resolved**, but **nine dimensions
are now excluded and none of them reproduce it**, so do not start from zero. The full table is in
**[UNI-007](../phase-67-nodegx-university/UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md)** — the
block *"THE 500 WAS HUNTED AND NOT CAUGHT"*. In short: repeated writes on one pool (so
per-connection prepared-statement caching is out), 8 sequential and 6 concurrent `POST`s, HMR
recompiles, interleaved `path`+`intake`, a 40-iteration stress, an ended pool (`CONNECTION_ENDED`),
`sql.json(undefined)` (`UNDEFINED_VALUE`), and **all 18 valid answer combinations**. All `200` or a
*different* error.

🔴 **The most useful thing found is a narrowing, not a repro.** `connection.js:959` +
`types.js:206` mean `serializers[3802]` is `JSON.stringify`, so `ERR_INVALID_ARG_TYPE` there needs a
serializer returning a non-string — which `JSON.stringify` does only for `undefined`/function/symbol,
and `undefined` is caught earlier as `UNDEFINED_VALUE`. **`recordIntake`'s parameters cannot produce
that error from any input `parseIntake` admits.** Session 48's attribution to `sql.json` is most
likely a `next dev` source-mapped stack naming the wrong frame. ✅ **Capture the RAW error next
time, not the dev overlay's attribution.**

### ✅ What was fixed instead — platform `edbe04c`

🔴 **Measured:** an unguarded throw in a Next route handler answers with an **EMPTY body and NO
`content-type` header at all**. (The route's own comment claimed *"Next's own HTML error page"* —
wrong, and corrected in the same commit.) **That is why the trigger was lost**: the route discarded
the error, leaving only a dev-console line. `serverError(where, cause)` in `apishape.ts` logs the
cause and returns a JSON `500` that does not name the schema; the intake route's read, write and
viewer lookup use it.

⚠️ **This does not fix the original 500.** It makes the next one diagnosable. Do not read `edbe04c`
as a resolution.

🔴 **The wider hole is deliberately UNSWEPT.** `isId` fixed this family from the other end on nine
routes (2026-08-19) by making the throw impossible — which only covers throws caused by the URL.
**There is no middleware in this app**, so every other route's domain-call throw is still a bodiless
500. That is a real finding and a real task; it was left undone rather than done unasked.

## 2. Gate readings — 2026-08-20, session 49

| Gate | Reading |
|---|---|
| `npx tsc --noEmit` (platform) | ✅ **0 errors**, no pipe, exit code read directly |
| `vitest tests/uni007-intake-and-pathing.test.ts` | ✅ **30/30**, including the new spec |
| Mutation test on the new spec | ✅ **reddens** when the guard is removed |
| Real-HTTP verification | ✅ real DB failure (template copy, `learner_intakes` dropped); controls read `200` |
| `vitest tests/nat006-api-contract.test.ts` | ❌ **3 failures — NOT mine, and NOT the phase's.** Proved by re-running with my change reverted. They name `/api/v1/community/rfps/[id]/responses`, the **NAT-009 peer's in-progress route**, which the disk-derived sweep finds with no seeded id. The peer was editing that test file by session end |
| `test:ci` (OpenNoodl) | ❌ **NOT RUN — three sessions now.** Two OpenNoodl peers were live |
| Editor drive (E5) | ❌ **NOT RUN — see §3** |

## 3. ⚠️ E5 is still unreached, and I chose not to reach it — the reason matters

E5 is *"the omissions block in the running editor."* ✅ **The spec side is already sound**:
`learnerpath-render.test.tsx` draws the block **and** carries the control that it is absent when
`omitted` is empty. So E5's remaining value is exactly the thing session 48 proved specs cannot
answer — *does it draw in production* — and **a spec is not a substitute for it.**

🔴 **Why I did not drive it:** there is **no env override for `COMMUNITY_URL`**
(`models/community/communityorigin.ts:16` is a hardcoded const), so a local drive requires editing a
**tracked, shared source file** — and commit `fe286dd8`, from **10:45 the same morning**, is a peer
cleaning up the mess left by exactly that edit. With two OpenNoodl peers live, repeating it to
confirm one UI block was not worth the hazard. **Do it when the checkout is quiet.**

✅ **The recipe, so nobody re-derives it:** point `COMMUNITY_URL` at the local `next dev`; the
session token store is **not `localStorage`** — `StorageNode` writes `<userData>/<key>.json`, so a
token can be planted from outside the editor (`models/community/communitysession.ts`). Template a
database from `nodegx_community_s48`, which still has a learner with a real intake.

## 4. What to do next

### An agent alone

1. **`test:ci`.** Not run for **three** sessions. Run it **alone**, check `vm.swapusage`, prove
   completion from the **summary line and the log mtime** — never from `$?`.
2. **E5**, per §3, when the checkout is quiet.
3. **The unswept 500 hole** in §1 — every non-intake route, no middleware.

### Needs Richard

4. **The fifteen unwritten lessons.** Unchanged. D17 ruled hosting 2026-08-16; **the editor now
   draws a real, personalised, ordered path to nothing installable**, which is UNI-007 §11 and the
   real blocker on *"a stranger learns NodeGX"*.
5. **UNI-008** — scope and build are ours; the **domain, the DPA and the go-live are not**.
   Unchanged from sessions 45–48.
6. **Phase 70's scoping** — still unscoped, and **11/12 of its files are still untracked**.

### 🔴 The deploy warning is UNCHANGED

nexus-1 is at **`0cbd716`**; everything since is undeployed, **now including `edbe04c`**. The next
deploy installs phase 72's mail timer and the first drain **will refuse** because the outbox backlog
is older than `MAIL_DRAIN_MAX_AGE_DAYS` (7). **That refusal is the guard working — do not route
around it.** Releasing weeks-old mail is Richard's decision. ✅ **Deploy from a pristine clone of a
named commit**: `git clone` to `/tmp`, `git checkout main` (the **branch**, not the bare sha), run
`ops/deploy.sh` there. ⚠️ A deploy also needs `ANTHROPIC_API_KEY`, or tier-1 projection answers
`unavailable` on every request.

## 5. ⚠️ Housekeeping and hazards

🔴 **I dropped `nodegx_community_s49`, and it was NOT mine.** It was not on session 48's list, so I
treated it as free; it was a live peer's, and their harness recreated it. **Both OpenNoodl peers
were told.** ✅ **The lesson: `drop database if exists` prints `DROP DATABASE` even when nothing
existed, so that output is NOT evidence the database was yours.** Check `pg_stat_activity` and the
row contents first, and **name your scratch databases distinctively** — mine was
`nodegx_community_p67b_s49`, since dropped.

⚠️ Isolated databases `nodegx_community_s42`, `s43`, `s45`, `s46` and `s48` remain. **`s48` is worth
keeping** — it has a learner with a real intake and is the fastest template for a drive. **`s49` is
a peer's; leave it alone.**

⚠️ Two **headless Chrome** processes orphaned since 2026-08-19 (PPID 1, `23135` and `46145`) and a
stray `render-from-disk.js` on **port 8901** (PPID 1) were still there at session 49's start.

✅ **`MEMORY.md` is back UNDER budget — 17,402 against 17,510** (was 17,838 at session 48's end).
🔴 **Done entirely by tightening and re-filing MY OWN lines; no peer's line was cut.** The two
densest Phase 67/67b trap lines moved verbatim into `phase-67-nodegx-university.md`, which the index
links, so nothing was retired and a transitive reachability check confirms nothing was orphaned
(44 unreachable files, the same pre-existing backlog). ⚠️ Measure with
`len(s.encode('utf-16-le'))//2`, never `wc -c`.

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014**, built and committed, **not deployed**. UNI-018 is
**NAT-015**; UNI-011's rail icon is **NAT-012 AC7**. Settled 2026-08-19, do not re-litigate.
