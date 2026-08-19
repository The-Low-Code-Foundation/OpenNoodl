# Phase 67b — next session

**Written 2026-08-19 (session 42), replacing session 41's.** Platform repo:
`~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task
files**; its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **A phase-72 session was live in `OpenNoodl` at 21:50 and had NOT committed** — NAT-005 work:
`packages/noodl-core-ui/{.storybook/*,src/preview/launcher/Launcher/views/Community.tsx}`,
`packages/noodl-editor/src/editor/src/views/panels/CommunityPanel/CommunityPanel.tsx`,
`tests-unit/nat-001/palette-contrast.spec.ts`, and the untracked `nat-005/` test folders.
**Check whether it landed before touching any of those.** ⚠️ **Check for a live peer yourself —
that is a per-session fact, not this file's to assert.**

---

## 1. ✅ UNI-006 IS DONE. THE BRIDGE HAS A CALLER, END TO END

`nodegx-community@08d8e1c`, `OpenNoodl@7a21e5e0` + `79117c45`. UNI-006 had been *"built
platform-side"* since 08-16 with its own limit written down: *"there is no bridge and no session
issuer"*, *"every write is reachable only from a test."* Both are now false.

| | |
|---|---|
| `GET /me/assignments/:id` | the direct-URL twin the audience rule forgets |
| `GET /me/assignments/:id/lesson` | the bundle to install — **or why there is not one** |
| `POST /me/assignments/:id/start` | idempotent; reopening does not withdraw submitted work |
| `POST /me/assignments/:id/submit` | the evidence bundle, narrowed |
| `GET /me/gradings` + `POST /me/gradings/:id/seen` | AC2's notice, for members with no email address |
| the caller | `checkMyWork` hands in after grading — `models/lessoncheck.ts` |
| gates | **20** platform specs + **26** editor specs, controls included |

🔴 **The one thing to read before touching it:** the grade is recorded **before** the network is
touched, asserted by comparing source offsets in `session-readers.test.ts`. Swap those two lines
and a learner who pressed "check my work" offline silently loses a grade they earned.

## 1b. 🔴 THE ROUND TRIP RUNS INTO A WALL THAT IS NOT UNI-006'S

**The platform hosts no curated lesson bundles at all.** `src/lib/curriculum.ts`'s own header:
*"There is no download, no install and no bundle"* — and all **fifteen** lessons in
`curriculum.json` are `state: 'in-writing'`. So `lessonSource: 'curated'`, the ordinary
assignment, has **nothing to pull**.

✅ `org_shelf` works end to end — a school's own lesson travels as the shelf item's `payload`,
gated by `shelf_item_visible_to`. That is the school case UNI-006 exists for, and it is driven.

🔴 **This is UNI-007 §11's owed *curriculum hosting*, open since 2026-07-25**, and it is the
real blocker on "a stranger learns NodeGX from the platform". **Do not re-derive it as a
UNI-006 bug.** ⚠️ It is also two problems, not one: a *hosting route* and *fifteen lessons
nobody has written*. The second is the larger.

## 2. 🔴 Two defects found by measurement, both fixed, both worth the generalisation

1. **A malformed id was a 500 — and not even JSON — on NINE routes** (`b7789a1`). Six
   pre-existing. The reason it survived: **every route spec calls handlers with ids it seeded
   itself, so every id is well-formed by construction.** *A suite that manufactures its own
   inputs cannot test the shape of an input.* Fixed with `isId` answering the same `notFound()`;
   the sweep derives its route list off disk and was verified red.
2. **`nat014-outbox-drain.test.ts` seeded one database and drained another** (`f9e7151`). It
   hard-coded `DEFAULT_DATABASE_URL` for the spawned process. On the shared database: 20/20 and
   **cannot tell**. On a per-session database: **11 of 20 failed**, all reading as *"the drainer
   sent nothing"*. ⚠️ **If you use a per-session database — and you should — a red suite may be
   the harness, not you. Reconcile against the shared one before believing it.**

## 3. Gate readings — 2026-08-19

| Gate | Reading |
|---|---|
| `nodegx-community` `npx tsc --noEmit` | ✅ **0 errors**, exit measured without a pipe |
| `nodegx-community` `npm test` | ✅ **47 files / 1132 tests, 0 failures, 0 skipped** — after `npm run build`, so the real-HTTP file actually ran |
| `OpenNoodl` `npm run test:main` | ✅ **262 suites / 4152 tests, 0 failures** |
| `OpenNoodl` `typecheck:editor` + `typecheck:editor-tests` | ✅ **0 errors** each |
| `npm run lint` (platform) | 🔴 **STILL NOT A GATE** — no eslint configured |

⚠️ **`test:ci` (the electron suite) was NOT run.** Nothing this session touched a spec in it, and
the machine was at 7.8G swap. Not a claim about it.

✅ **The isolated database is `nodegx_community_s42`** on the same 55432 container; it still
exists. `DATABASE_URL='postgres://nodegx:nodegx@localhost:55432/nodegx_community_s42'`.

## 4. What to do next

### An agent alone — nothing needs Richard

1. **UNI-007's intake + pathing (AC1)** — the other half of the tranche session 41 named, and
   **not started this session**. It is the last unbuilt criterion of UNI-007: a conversational
   intake → a personalised path, tier-0 branching plus a tier-1 projection cached per
   (learner, concept). 🔴 **Read §1b first** — a path made of fifteen `in-writing` lessons is a
   path to nothing, so scope the intake against that fact rather than around it.
2. **UNI-008** (L+, carries a standing legal and ops burden — read D9 before starting).
3. **UNI-010's remainder**; **UNI-012** (needs a **packaged build** to verify anything).
4. ⚠️ **A deploy, whenever one is wanted** — see below. UNI-006's bridge is inert on the live
   site until then, exactly as E7 is.

### 🔴 The deploy warning is UNCHANGED and still applies

nexus-1 is at **`0cbd716`**. Everything since — NAT-014's mail drain, E7, NAT-006's read API and
now UNI-006's bridge — is undeployed. **The next deploy installs phase 72's mail timer, and the
first drain will refuse because the outbox backlog is older than `MAIL_DRAIN_MAX_AGE_DAYS` (7).
That refusal is the guard working — do not route around it.** Releasing weeks-old mail is
Richard's decision. ✅ **Deploy from a pristine clone of a named commit**: `git clone` to `/tmp`,
`git checkout main` (the **branch**, not the bare sha, or the stamp records `branch: HEAD`), run
`ops/deploy.sh` there.

### ⚠️ One open ruling this session touched rather than settled

UNI-006's three writes take **the same session scope as the browser** — a *default*, not a
ruling. Phase 72's **D5** (*what authorises a write from the editor?*) is open; its stated blast
radius is the **community** writes rather than this school surface. If D5 rules for a narrower
post-only scope, `start`, `submit` and `seen` are the routes to re-scope — named in
`docs/API.md` §5b so nobody has to go looking.

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014**, built and committed, **not deployed**. UNI-018 is
**NAT-015**; UNI-011's rail icon is **NAT-012 AC7**. Settled 2026-08-19, do not re-litigate.
