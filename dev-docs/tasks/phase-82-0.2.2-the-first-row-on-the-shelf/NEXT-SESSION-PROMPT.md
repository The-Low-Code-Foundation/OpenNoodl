# Phase 82 — next session

_Opened 2026-08-31 (s1). Last updated **2026-09-01, session 10**, which built **items 1–4** of the
change list Richard asked for after ruling row 6 FINE. The row is **rebuilt and re-photographed in
both states** and waits on the same one thing: **him looking at it**. The decisions are still
[`RICHARD-RULINGS-2026-09-01.md`](RICHARD-RULINGS-2026-09-01.md); the change list is
[`REL-002c-WHAT-I-WOULD-CHANGE.md`](REL-002c-WHAT-I-WOULD-CHANGE.md)._

## 🔴 Read this first: this is the only board you open

Richard, 2026-08-31: *"can we work through the next session prompt in phase 82, rather than me
ending up driving unnecessary tasks in other phases by accident — just so we focus on the tasks we
need to launch, over several sessions all in phase 82."*

**So: every launch session opens THIS file, takes the next unstruck row from the run sheet below,
and finishes inside phase 82.** The look work that used to live in phase 81 (VIB-005, VIB-008) has
been **carried here** as REL-002a/b/c, with its verdict scale and close protocol **restated in
[`TASKS.md`](TASKS.md)** — you do not need to open phase 81 to build or close it.

🔴 **If a row is not on this board, it does not gate 0.2.2.** Do not open P75, P77, P78 or P81
boards "to check". Anything else you find is a **register row with an owner**, not this session's
job — see [`../../guidelines/PHASE-EXECUTION.md`](../../guidelines/PHASE-EXECUTION.md).

Then read [`README.md`](README.md) §1 and re-derive the board from `TASKS.md` and the artefacts.

## The run sheet — the whole path to launch

Take the topmost row that is not ✅. Strike it here when it closes.

| # | row | why here | needs |
|---|---|---|---|
| ~~1~~ | ~~**REL-007** price line + **REL-006** hold/doc fixes~~ | ✅ **BOTH CLOSED, s1** | — |
| ~~2~~ | ~~**REL-005** triage P75's four open rows~~ | ✅ **CLOSED, s2** — nine dispositions written into P75's board | — |
| ~~3~~ | ~~**REL-003** rebuild the stale bundles~~ | ✅ **CLOSED, s3** — DEF-023 and DEF-026 observed through bundles with control pairs | — |
| ~~4~~ | ~~**REL-002a** the ambush defaults~~ | ✅ **CLOSED, s4** — the defect was `settings.bodyScroll`; 0/7 → 7/7 reachable controls | — |
| ~~5~~ | ~~**REL-002b** fail closed + designed first run~~ | ✅ **CLOSED, s5** — `Denied` + `isSignedIn` + `waitingCard`; **37/37** on a real enforcing backend | — |
| 6 | **REL-002c** the members' area, redeemed | the redesign; **the phase's close condition** | 🟡 **REBUILT s10** — items 1–4 built; **1085/1085 mcp, 110/110 drives, 44 fresh shots**. **The ask is Richard's WORTHY ruling.** Items 5 and 6 are costed and unbuilt |
| 7 | **REL-001** publish + drive the install | shelf's first row; also closes P75's FB-005 | 🟢 **PREPARED, refreshed s10** — [`REL-001-SUBMISSION.md`](REL-001-SUBMISSION.md). **Richard runs it** |
| 8 | **REL-004** cut, tag and publish `v0.2.2` | last | 🟡 **PREPARED s9** — [notes](../release-0.2.2/RELEASE-NOTES-0.2.2.md) + [runbook](../release-0.2.2/PUBLISH-0.2.2.md). 🔴 **BLOCKED: `cline-dev` is 569 commits unpushed** |

## 🔴 The next job

**Ask Richard to rule row 6.** There is an artefact to rule on this time: 44 fresh shots at
`verdicts/vib-001/2026-09-01/` (door `md5=f969ad96`, living `md5=7164e4f6`), taken after the last
edit. ✅ **s9's lesson holds — a contact sheet, not 44 file paths.** His six page-states are `/` in
both states, `/setup`, `/join`, `/members`, `/directory`; the Judge grades the other seven and any
SHITTY verdict escalates to him.

**What changed since he last looked**, in one line each — this is what the ask should carry:

1. The **door landing has content instead of a void** — the "What members can see" band is ungated.
2. **`/members` ends in one call to action**, not four buttons that were all nav pills.
3. **`/join` makes its sign-in offer once.**
4. **Every page has a foot** — eleven of thirteen ended in undifferentiated white and now place
   `Members/Footer`.

**If he rules WORTHY, row 6 closes and the phase's close condition is met.** If he rules FINE again,
items 5 (the directory table's headers and column proportions) and 6 (a photograph on `/setup`) are
already costed in the change list and are the next build. **Item 6 is taste, not defect — ask before
building it.**

### Rows 7 and 8 are both Richard's, and neither needs another session first

**Row 7 — REL-001, the publish.** Everything is in
[`REL-001-SUBMISSION.md`](REL-001-SUBMISSION.md): the exact command, the four ruled fields, and
AC8's excluded-files check performed against the artefact — **re-performed this session** after the
artefact changed (`8af2aeec`, **94 files**; the three new ones are `Members/Footer`'s and the bundle
still contains only `components/`, `docs/START-HERE.md`, the project file and the policy).

🔴 **`readBundleDirectory` has no skip list of any kind**, so **`templates/members-area` must NOT be
opened in the editor before publishing** — opening writes `.mcp.json` (carrying absolute paths from
the publishing machine), `CLAUDE.md` and a `.gitignore` block, and all three would ship. Verified
clean right now.

**Row 8 — REL-004, the cut. Blocked on a push only Richard can make.**
`git rev-list --left-right --count origin/cline-dev...cline-dev` read `0 569` at s9 and this session
added to it. `origin/cline-dev` is at **2026-08-21**; **CI has run on none of this**, and the release
workflow triggers on a tag push. ⚠️ `packages/noodl-editor/package.json` still reads `0.2.0` and
must become `0.2.2` before tagging — `artifactName` interpolates `${version}`.

## What session 10 did — row 6, items 1–4

Full account in [`TASKS.md`](TASKS.md) §"REL-002c — what session 10 built". Items 1, 2 and 3 cost
what the change list said. **Item 4 did not**, and that is the session's finding.

## 🔴 What to carry out of session 10

1. 🔴🔴 **EVERY `Group` IN THIS TEMPLATE WITHOUT A `sizeMode` IS `flex-grow: 100`.**
   `addDimensions` defaults `sizeMode` to `explicit` and `height` to `100%`
   ([`node-shared-port-definitions.ts:1102`](../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts#L1102)),
   and [`layout.ts:98`](../../../packages/noodl-viewer-react/src/layout.ts#L98) turns a percentage
   height inside a **column** parent into `flexGrow` — *"along the parent's flex direction it becomes
   `flexGrow`"*. So **any container given real slack shares it out among its unpinned children**
   rather than keeping it at the bottom. ✅ Pin anything that must stay its content's height before
   giving an ancestor a floor.
2. 🔴 **"IT IS INERT" IS A CLAIM ABOUT A MECHANISM, AND IT WAS WRONG TWICE ON THE SAME LINE.**
   `PAGE_GROUND`'s `height: 100%` was recorded at s7 as inert *"because a percentage height resolves
   against the parent"*. It never resolved as a height at all — it was `flex-grow: 100` the whole
   time, doing nothing only because nothing above it had slack. The s7 note also called `minHeight`
   *"the one dimension port that takes `vh`"*; `height` takes `vh` too. ✅ **Read the port and the
   layout code, not the comment that quotes them.**
3. 🔴 **A FIX'S STATED MECHANISM CAN PAINT NOTHING — CHECK THE ARTEFACT FOR THE PROPERTY IT NEEDS.**
   Item 4 said `minHeight: 100vh` on `PAGE_GROUND` would give eleven pages a bottom edge. That Group
   carries **no `backgroundColor`** — read out of `components/Pages/Directory/nodes.json` — so
   growing it changes no pixel. ✅ **A page has a bottom edge when something is AT the bottom**; the
   answer was the footer the landing page has had since s7, as a component.
4. 🔴 **FOURTH TIME IN THIS ROW: A LAYOUT COMPLAINT HAD A CONTENT ANSWER.** The door landing's void
   was fixed by s7 with a footer, by s8 with `space-between`, by s9 with a diagnosis — and by s10 by
   **mounting a band that was already built**. The page did not fill because it had nothing to fill
   it with. ✅ And the gate that had closed that band was arguing about a page that no longer
   existed: *"it would sit above the setup card"* was true when it was a section in the old
   single-column page and stopped being true when it became a band **below** the hero.
5. 🔴 **A DECISION RECORDED IN A COMMENT IS STILL A CLAIM.** s9 wrote *"the three buttons below STAY
   — a nav and a call to action are not the same control"*. The principle is right; the reading of
   those three was wrong, because each named a **place** the band's nav names in the same word three
   inches higher. ✅ **Re-derive a recorded decision against the picture before inheriting it.**
6. ⚠️ **DELETING A CONTROL DELETES MORE THAN THE CONTROL.** Three buttons took with them three
   `RouterNavigate` nodes (one driver each), a `Columns`, the `inColumn` calls on the survivors and
   the `afterRuledList` helper whose only caller was the button above them. ✅ **Grep for the id
   after removing a node** — an orphaned navigator ships as a node nothing can fire.
7. ⚠️ **A GATE CAN BE A HARD COUNT IN THREE PLACES.** This row moved the mounted-gate census
   (54 → 53), the `Columns`-children census (15 → 12), the component count (29 → 30) and the file
   count (91 → 94). Each has a written argument above it; **update the argument, not just the
   number**.
8. 🔴 **A DELETED CONTROL BREAKS THE SPEC THAT USES IT AS A CONTROL, AND THE FIX IS TO RE-POINT IT,
   NOT TO DROP IT.** `tpl001-members-drive` §5 AC4 asserts the moderator IS offered
   `Post something` **and `Requests to join`** — a **control** for the two arms below it, which
   assert a pending person and a plain member are not. Deleting that button reddened the control
   only; the two negative arms stayed green, which is exactly the shape my memory warns about
   (*"three arms that all end on `/` are equally consistent with a gate that refuses
   unconditionally"*). ✅ **Re-pointed at `Requests`, the band's moderator-only pill** — the
   affordance that replaced the deleted button — so the pair still measures something.
9. 🔴 **THE WRAPPER'S "exit code 0" LIED AGAIN — s9's lesson, second occurrence.** The background
   task notification for the drives read *completed (exit code 0)* while the exit file I wrote
   myself read **1**. ✅ **Gate on your own exit file**, every time.
10. ✅ **The 92-second door-only harness paid for itself a third time.** `rel002c-look.look.ts` is 4
   pages × 4 viewports with no backend, against ~9 minutes for the both-states instrument. Two of
   this session's three corrections were found on it — including the one where the fix moved the
   gap **inside** the page.

## What did not get done

**Row 6 is not CLOSED** — it needs Richard's ruling, and there is now something to rule on.

**Items 5 and 6 of the change list were deliberately not built.** Item 5 (the `/directory` header row
and column proportions) is medium and was not in the "build 1–4" scope; item 6 (a photograph on
`/setup`) is taste rather than defect and is his call.

**The four unphotographed pages are still unphotographed** — `Announcement`, `Meeting`, `Post`,
`Unsubscribe`. `vib001-members.look.ts` asks for nine of thirteen, so this is a fact about the
request, not about how those pages look. Registered, owner `NONE`; adding them is a change to two
shot lists and a longer render.

⚠️ **The three tracked files modified from s4/s5 were AGAIN not swept** — their mtimes are still
08-31, their content was not read this session, and a pathspec commit would take an edit nobody
attributed: `packages/noodl-mcp/tests/renderReportModule.test.ts`,
`packages/noodl-mcp/tests/stagingDiagnostics.test.ts`,
`packages/noodl-mcp/tests/sb007Template.test.ts` (P80's known orphan; Richard confirmed it is not
his). **Read them before committing.**

🔴 **`git commit <pathspecs>`, never `git add`** — a sibling's commit sweeps staged files — except
for untracked paths, which a pathspec commit **skips silently** and which must be `git add`ed first
(`git status --porcelain | grep '^??'`, and check whether a `??` is a **directory**;
`templates/members-area/components/Members/Footer/` was one this session).
