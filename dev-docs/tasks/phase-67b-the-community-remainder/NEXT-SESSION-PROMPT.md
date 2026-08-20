# Phase 67b — next session

**Written 2026-08-20 (session 46), replacing session 45's.** Platform repo:
`~/vscode_projects/nodegx-community`. Task ledger:
`dev-docs/tasks/phase-67b-the-community-remainder/README.md` — the phase has **no per-task files**;
its work items are the `UNI-0xx` files in `phase-67-nodegx-university/`.

⚠️ **Check for live peers yourself — that is a per-session fact, not this file's to assert.**
Session 46 had **two** live: one on **phase 73 TUT-002** (`lessonformat.ts`, `lessonverify.ts`,
`lessonevalconditions.ts`) who ran `test:ci` at ~08:30, and one on **phase 72** (`useCommunityPeople.ts`,
NAT-008). Session 46 touched no file of either.

---

## 1. ✅ UNI-010's remainder is DONE — the harness renders every routed page

`OpenNoodl@fce4935c`. **11 specs**, each graded by disabling its branch. Full write-up in
**[UNI-010-CRITERION-3-RUN.md](../phase-67-nodegx-university/UNI-010-CRITERION-3-RUN.md) §8.2**.

The defect was **still live at HEAD**: `render-report.js` measured the Router's `startPage` and
nothing else, so a defect on any other page was invisible **and the report said `Rendered clean`
about it**. Three arms on a five-route project, the third present so the absence in the second means
something:

| arm | the same `dead-placeholder-text` on | before |
|---|---|---|
| A | nowhere | `Rendered clean … 0 placeholders` |
| **B** | **a routed page** | **`md5`-IDENTICAL to A** |
| C | the start page | `2 errors … dead-placeholder-text` |

After: A and B differ, B and C grade the same. **F4 inherited it with no change to the grader** —
page findings merge into the same `report.findings` that `renderDefectCodes` reads, driven through
the real function on a real report.

### 🔴 Four things to read before touching any of it

1. **The mechanism three task files recorded was WRONG.** UNI-010 §8.2, CN-001 and P70 EL-009 all
   said `render-from-disk.js` 404s named routes, *therefore* `urlPath` behaviour is unmeasurable.
   The 404 is real and is fixed. **It was never the blindness** — the runtime's default
   `navigationPathType` is `hash` (`router.tsx:_getLocationPath`) and a hash never reaches a server,
   so `/#thank-you` always rendered correctly. Nothing ever *navigated*. ⚠️ **Fixing the 404 alone
   changes no reading**, so a session that did only that would have re-measured, seen identical
   numbers and concluded the harness still could not see page two. *A correct measurement can carry
   an incorrect mechanism, and the mechanism is what a fix is aimed at.*
2. **Rendering every page exposed a gate that rejects the correct answer.** `listProbes` returns
   every repeater in the *project*, so each page was judged against repeaters it could not contain:
   `phase55-replay-sonnet` — the build phase 55 calls **correct**, a pinned control recorded as
   reporting *none* — came back with **14 `empty-list` errors**. Probes are now scoped per page and
   both pinned controls are restored. **A per-page check needs a per-page notion of what belongs on
   that page** — expect the same shape in EL-009's AC4.
3. **Arm A was never actually clean.** It now reports a real pre-existing `minimum-layout-width`
   warning on a routed page that nothing could see before.
4. **Cost, measured:** ~4.3s per extra page (two viewports); one page 7.3s → eight pages 40.9s. The
   MCP ceiling was 90s behind a comment claiming ~7.5s — a cliff at ~20 pages. Raised to 240s.

## 1b. 🔴 This work is ALSO P70 EL-009, and it is only PART of it

**[EL-009](../phase-70-the-course-is-an-app/EL-009-THE-EYES-MUST-SEE-EVERY-PAGE.md)** — *"the eyes
must see every page"* — owns this behaviour and is tier 0 in its phase. **AC2 met, AC1 mostly, AC3
and AC4 NOT.** Not met: rejecting an **unregistered path distinctly** (there is still no
caller-supplied path argument, so the tool-surface budget is untouched and the 57 free tokens are
intact), and asserting **kit injection per page** — a kit node on page 3 rendering on page 3, which
is the one with teeth. EL-009 carries the full table. ⚠️ **Phase 70 is still UNTRACKED** in git; my
status block is in the working tree only, because committing an unscoped phase is not this lane's
call.

🔴 **How it was missed:** the sweep that should have found EL-009 was
`grep -rln 'startPage' tasks/ | head -20`, and it sat at **position 21**. *A bounded query reports
its bound, and the bound is invisible in the output.*

## 2. Gate readings — 2026-08-20, session 46

| Gate | Reading |
|---|---|
| `npx tsc -p packages/noodl-mcp --noEmit` | ✅ **0 errors**, no pipe |
| `packages/noodl-mcp` jest | ✅ **55 files / 648 tests / 0 failures** |
| `npm run test:main` | ⚠️ **280 suites / 4492 tests / 2 failed + 1 suite that would not compile — ALL THREE PEERS'.** Mine: `uni-010/render-harness-*` both PASS |
| `nodegx-render-measure` jest | ✅ 5/5 |
| Live control pair | ✅ arms A/B/C above, plus both pinned phase-55 controls restored |
| `test:ci` | 🟡 **NOT MINE, but informative.** The phase-73 peer ran one and reported **2849 specs / 10 failures @ seed 39393, same 10 by name as the floor** |
| `nodegx-community` | ⚠️ **Untouched this session.** Session 43's readings stand |

⚠️ **What the peer's `test:ci` does and does not establish about session 46's change.** This is a
**shared checkout**, so their run read the same working tree my harness edits were already sitting
in — and the floor did not move. That is worth something, but it is **not** a measurement of this
change: my specs are **jest** (`test:main`), the Jasmine suite has no spec that drives the render
harness, and the exact overlap between their run's start and my last two edits is unknown. ✅ Treat
it as *the floor is intact*, not as *the change is covered*. **Re-measure before quoting it as
either.**

⚠️ **The three `test:main` failures were attributed, not assumed**: `uni-001/session-readers` and
`nat-008/peopleview` are phase 72's untracked `useCommunityPeople.ts`; `uni-010/lessonprojectcontext`
failed to **compile** against the phase-73 peer's in-flight `lessonevalconditions.ts` — flagged to
them and **fixed by them during the session**. None of the three references any file this session
touched.

## 3. What to do next

### An agent alone

1. **EL-009's AC3 and AC4** — see §1b. The instrument is now most of the way there and the remaining
   half is where the teeth are. It is P70's ticket, not this phase's, but it is the direct
   continuation of what session 46 built.
2. **Wiring UNI-007 AC1 into the editor.** The platform end is complete and has **no caller** — the
   same shape UNI-006 was in before session 42 built its bridge, and *building the caller is what
   finds what a shipped thing does not do*. Routes in `docs/API.md` §5c. 🔴 **This overlaps phase
   72's editor surface directly** — `communityapi.ts`, `CommunityPanel.tsx` and `useCommunityThread.ts`
   are NAT-007's, and phase 72 had a live peer this session. Coordinate; do not assume.

### Needs Richard

3. **UNI-008** — scope and build are ours; the **domain, the DPA and the go-live are not** (D9's five
   obligations include a DPA). Unchanged from session 45.
4. **The fifteen unwritten lessons** — D17 ruled hosting on 2026-08-16 (*part of the platform API
   under D14; GitHub Pages as v0*). The hosting route has its answer; **the lessons are the wall**,
   and that is not an agent's to scope alone.

### 🔴 The deploy warning is UNCHANGED and still applies

nexus-1 is at **`0cbd716`**. Everything since — NAT-014's mail drain, E7, NAT-006's read API,
UNI-006's bridge, UNI-007's AC1 — is undeployed. **The next deploy installs phase 72's mail timer,
and the first drain will refuse because the outbox backlog is older than `MAIL_DRAIN_MAX_AGE_DAYS`
(7). That refusal is the guard working — do not route around it.** Releasing weeks-old mail is
Richard's decision. ✅ **Deploy from a pristine clone of a named commit**: `git clone` to `/tmp`,
`git checkout main` (the **branch**, not the bare sha, or the stamp records `branch: HEAD`), run
`ops/deploy.sh` there. ⚠️ A deploy now also needs `ANTHROPIC_API_KEY`, or tier-1 projection answers
`unavailable` on every request.

⚠️ Session 43's isolated databases `nodegx_community_s43` and `nodegx_community_s42` still exist on
the 55432 container. Tidy up when nobody needs them.

### Not this phase's

Gap A (the mail drainer) is **P72 NAT-014**, built and committed, **not deployed**. UNI-018 is
**NAT-015**; UNI-011's rail icon is **NAT-012 AC7**. Settled 2026-08-19, do not re-litigate.
