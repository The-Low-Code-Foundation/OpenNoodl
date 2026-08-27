# Next session — phase 75

_Written 2026-08-27 at the end of session 57, which closed **FIX-025 §7** by driving it, and built
and drove **the read half of FB-013 C4** — the launcher's Chat tab. Read `TASKS.md` for the rest of
the phase; this file is only about what that session left._

## What happened

Session 56 left exactly one thing owed — a drive — and the checkout was quiet, so that went first
and closed FIX-025 §7 outright. The rest of the session took the largest genuinely buildable item
the index offered: **FB-013 C4**, which §10 confirms is independent of the R-chat-mod ruling.

**Two commits on `cline-dev`, neither pushed** (`aa38a50c` the §7 drive record, and the C4 build).

## Start here

🔒 **The two things that need Richard, and they are now the gate on this feature rather than a
footnote:**

1. **R-chat-mod** — the moderation posture the ruling *required* be asked. `FB-013-SCOPE.md` §8
   lays out A/B/C with a recommendation of **B** (hide-by-moderator, no reader-facing report).
   C5 is blocked on it, **and so is the chat composer now** — see below.
2. **Deploying `nodegx-community`.** The chat routes are **built and not deployed**. Until they
   are, the launcher's Chat tab is a correct surface with nothing to talk to.

⚠️ **Everything else in the phase is unchanged**: FB-012 and FB-009 are the largest open items and
both wait on content from Richard, and FB-005's blocker is content too.

## 🔴 The chat composer moved, and the reason is the useful part

C4 built the **read** half: the river, the channel facet, the thread pane. It did **not** build a
composer, and that is a decision rather than a shortfall. Posting is what *creates* the messages a
moderation posture is about — shipping *"anyone can post from the editor"* before deciding whether
anybody can take a message down is precisely the ordering the ruling exists to prevent. **So the
composer belongs with C5, behind R-chat-mod, not in front of it.** If Richard rules B, both land
together and the feature is whole in one slice.

## 🔴 The platform half is not deployed, and here is how that was established

`/api/v1/community/chat` answers **404** on production. On its own that proves nothing — so:
`/api/v1/community/threads` answers **200** and an invented path
(`/api/v1/community/does-not-exist`) answers **404**. The positive control says the instrument
works; the negative one says a 404 really is *absent*. The chat commits (`c5be57b`, `91d8b0c`) are
on `main` in `nodegx-community` and have not shipped.

✅ **So C4 was driven against a LOCAL platform, and the recipe is cheap enough to repeat.** No
Docker — the daemon is not running on this machine, and the repo's compose default of port
**55432** is a red herring:

```
createdb -h 127.0.0.1 -p 5432 -U richardosborne <scratch>
cd ~/vscode_projects/nodegx-community
DATABASE_URL="postgres://richardosborne@127.0.0.1:5432/<scratch>" npm run db:migrate   # 0024 applies
PORT=3399 DATABASE_URL=... npx next dev -p 3399
```

Then point `models/community/communityorigin.ts`'s `COMMUNITY_URL` at `http://localhost:3399`
for the drive. 🔴 **It is a one-line compile-time constant with no env override — back it up and
revert it, and check the revert with `git diff` rather than by eye.** ⚠️ Seed `updated_at =
created_at`; the platform derives `editedAt` as `updated_at > created_at`, so backdated rows
otherwise draw as *edited*. And `listRiver` orders by `seq desc` (insertion), not `created_at`, so
backdated seeds appear out of time order — an artefact of seeding, not a defect.

## 🔴 What the drive and the sweeps found

✅ **The count-equals-rows identity was driven, not just specced.** Pills read **All 5 · #lounge 3 ·
#templates 1 · #tutorials 1 · #collab 0**; clicking `#lounge` returned **exactly 3** rows. And
`#collab 0` is a *visible pill*, which is the design claim — a quiet channel is a zero you can see
and decide about, never a room you fall into.

✅ **The cross-repository label agreement was MEASURED.** `chatThreadLabel` mirrors the platform's
`threadLabel` because that string is a permalink's `<h1>`, and the platform's own note says a label
two surfaces compute differently is one address whose title depends on which client you followed it
from. The launcher's heading and the web's `<h1>` for the same message came back **byte-identical**.
🔴 A mirrored algorithm is exactly the kind of claim that rots silently — re-measure it, do not
re-assert it.

🔴 **THE WEB'S NAV IS COPIED IN TWO PLACES IN THIS CHECKOUT, AND ONLY ONE IS FINDABLE BY READING.**
`communityTabs.ts`'s header quotes the nav and says outright that a copy drifts; I re-read the web,
found it *had* drifted (C3 added `/chat` **second** on 08-26), and corrected it. Then
`fb-006/community-tabs.test.ts` went red — **a second copy of the same list, as a literal**, which I
did not know existed. ✅ The mitigation worked twice over; the lesson is that a "quoted copy"
mitigation needs to name every copy, and this one now does.

🔴 **The UNI-001 session-reader sweep fired and was right to.** Any new `readCommunitySession`
caller must answer *"what does this read WITHHOLD?"* before it is listed, and the only acceptable
answer is *nothing*. For chat it is nothing: the token is a bearer header on reads the platform
serves to strangers, there is no branch on whether a session **exists** (`session === undefined`
waits for the *store*; `null` proceeds), and `chatview.ts` never sees a token. A structural
assertion pins that, with a control proving the checker can see a session when one is there, plus a
row that would fail if the guard were rewritten as `if (!session) return` — which reads almost
identically and would withhold the whole tab from everyone signed out.

⚠️ **One spec of mine survived its mutant before it killed it.** The word-boundary row asserted
`not.toMatch(/alph…$/)` — one *example* of a mid-word cut — and the mutant that deletes the
boundary logic happened to land on `…al…` instead, so it passed. Rewritten to assert the
**property**: whatever survives the cut must be a prefix of the original that stopped at a space.
🔴 **A spec that names a mechanism it never reaches is this phase's recurring failure**, and it
cost nothing here only because the mutation run was done at all.

## ⚠️ Found, measured, unowned — and now on a third surface

The shared `.FilterPill`'s selected state is carried by fill alone, measured live in the running
editor on the Chat tab:

| | measured | needs |
|---|---|---|
| active fill vs panel | **1.36:1** | 3:1 for a non-text state |
| active vs inactive fill | **1.94:1** | — |
| border, active vs inactive | **identical** (4.17:1 both) | — |
| label text | 8.46:1 | passes AA comfortably |

So *which* channel is selected is close to invisible. **FB-002 recorded this on the Bench and
FB-005 T4 already solved the same problem for template pills by moving the state onto the border.**
The community `.FilterPill` never adopted it, and Bench, People and Chat now all share the defect.
🔴 **It was left deliberately**: it is a shared component across three shipped tabs and a
design-token call, and restyling surfaces I was not driving at the end of a session is not a change
I could have verified. It is a small, precedented fix for whoever picks it up.

## Gates, as measured this session

- Editor `test:main`: **356 suites / 5879 / 0**. ⚠️ The first run read **2 failed**, and *both were
  the sweeps above doing their job* — not flakes, and not regressions.
- `noodl-core-ui`: **28 / 527 / 0**.
- `tsc -p packages/noodl-editor`: clean, and **proven to see the new files by a planted error**
  (1 → 0). ⚠️ It does **not** cover `tests-unit/`; ts-jest does, and that ran green.
- `test:ci` **not run by this lane this session.** A peer ran it solo twice (seeds 83318, 65707):
  **2860 specs / 6 failures** — this lane's documented **AIX-006 floor of 4, by name**, plus 2 new
  SB-017 specs red by design. 🔴 **Relayed, not measured here**, and the spec count has moved from
  2856 because the peer added specs — quote the tree, not the number.

## Standing facts for this area

- ⚠️ **A peer is active in this checkout** (P76 / SB-017). We traded the machine three times this
  session and it worked: they asked before `test:ci`, I dropped my stack, they cleared
  `.webpack-cache` on the tip from session 56 and both builds were clean. **Keep announcing.**
- ⚠️ **Not mine and still uncommitted, leave them**: `packages/nodegx-export/*` (P18),
  `tests/cloud/sb017-*` and `tests/cloud/fixtures/` (P76), and
  `AskAboutNodeDialog.module.scss`, which has been uncommitted since **08-20** and belongs to
  nobody in this lane.
- ⚠️ **`nodegx-community` was not touched by this session** — C4 is entirely editor-side. The
  deploy it needs is of work C1–C3 already committed there.
