# Phase 82 — next session

## ✅ §A RICHARD'S LIST — one of the four is DONE, and he ruled twice on the way

Session 32's handoff opened with his verdict — *"I still can't add chat messages, still can't add
people. I feel like there's a lot of stuff not done from my original list."* Session 33 took
[§B](#) item 1 and closed it. **Three of his four remain**, and their research is unchanged.

🔴 **DO NOT RE-SURVEY §A. Read §D and build item 2.** Every item below already carries its findings.

| # | what he asked for | state |
|---|---|---|
| 1 | **Add a person / list yourself** | 🟢 **BUILT s33** — platform measured, editor button built, both his rulings taken. ⏳ Nothing is deployed. See [REL-015 §6](REL-015-THE-SHELVES-YOU-CAN-FILL.md) |
| 2 | **Add a chat message from the editor** | 🟢 **BUILT s34, FB-013 phase 75.** `postChat`/`replyChat` + a starter/reply composer in `CommunityChatView.tsx`, wired through `useCommunityChat.ts`. See [FB-013-SCOPE.md](../phase-75-0.2.1-the-feedback/FB-013-SCOPE.md) §10a. ⏳ Not committed, not deployed, not driven in a running editor |
| 3 | **Circle → a Shape/SVG node** | 🟢 **STAGE 1 BUILT s34.** [`NOTES-UNOWNED-NODE-WORK`](NOTES-UNOWNED-NODE-WORK.md) §1 — `shape` enum (circle/square/triangle), both gate traps taken, export deferred correctly. ⏳ Not committed, not driven. Stages 2 (`cornerRadius`, `points`) and 3 (`svgSource`) remain |
| 4 | **Dropdown — two defaults + a beginner "click plus and type" mode** | ✅ **RESEARCHED s34** — [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §3: a bare string array does NOT work (`Select.tsx` needs `.Label`/`.Value`), the existing `proplist` port type is the exact UX precedent, three build options laid out and NOT chosen between. ⬜ Still needs a design decision + build. The default-items half is a one-line, independently-shippable fix |

### §A4 — the smaller ones, all with findings

| what | state |
|---|---|
| **Video node — mp4 only, no YouTube anywhere** | 🟡 **THE SENTENCE IS WRITTEN AND CANNOT BE COMMITTED YET** — see §E1. `video.ts`'s Source description now names mp4/webm/ogg and says a YouTube page link will not play |
| **Filter properties bar** — contrast **1.00:1** in both themes | ⬜ [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §4. ⚠️ `SearchInput.module.scss` has **five** other consumers; scope under `.property-filter` |
| **"Add style variant" vs "Style → Variant"** | ⬜ [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §4. ⚠️ `refusalPlan.test.ts` asserts the literal `displayName: 'Variant'` |
| **Button `outline`/`ghost` icons** — correct only by inheritance | ⬜ a render gate over all five variants |
| **Design Tokens panel is `devMode`-gated, `TokenPicker` has zero call sites** | ⬜ FIX-015's successor phase. 🔴 in a packaged build the panel **is not registered at all** |
| **Default tutorial content** | ⬜ FB-012, phase 75 — blocked on his brief, on purpose |

---

## 🔴 §B WHAT SESSION 33 DID

### §B1 Richard ruled twice, and both reverse something recorded

Asked at the top of the session because REL-015 shipped **both as open consequences** and the first
decided whether the button would work for him on the day it shipped. Full text in
[`RICHARD-RULINGS-2026-09-04.md`](RICHARD-RULINGS-2026-09-04.md) **§8**.

| # | ruling |
|---|---|
| **D3** | **Drop `profile_meets_bar()` from `listDirectory`.** Approval alone lists you — a reviewer reading every row IS the evidence check. ✅ The FUNCTION is untouched; its four other callers (coaching, coach queue, `rfp_response_gate`, `profileBar`) are exactly as they were, so REL-015 AC3 holds |
| **D4** | **Gate `/u/<handle>` on approval too** — *nothing is VISIBLE until I allow it*, not merely *nothing is LISTED*. `publicProfile` **and** `hasPublicProfile`, because `fb010` drives them equal |

🔴 **D4 costs more than the question implied, and he should be told:** `listing_status` defaults to
`unlisted`, so **a member who goes public and never asks to be listed now has no page — including
for themselves.** UNI-003 AC1's *"the page is the owner's toggle and nothing else"* is no longer
true. `AccountForm`'s copy was rewritten in all four states because it told the opposite story.

### §B2 The editor's "list me" button

✅ **`POST /api/v1/me/listing` was NOT built, and building it would have been a defect.** REL-015's
sequencing named that route; `POST /api/v1/me/profile` **already carried `listing`** through
`serveCommunityWrite` with `editProfile`. What was missing was the **READ**, so the change is a
`GET` on the route that already owns the write. Two doors on one state is the arrangement
`communityapi.ts`'s own header warns about.

Built: the `GET`, three client methods, `composeListing` (pure), `CommunityListingCard` (no hooks,
text-only), the hook wiring, and the pane — rendered **above the search box**, because a control
placed after fifty rows is found by the people who least need it.

### §B3 The readings — every one an exit status

| gate | reading |
|---|---|
| community `tsc --noEmit` (include covers `tests/` + `scripts/` — checked) | **`EXIT=0`, 0 errors** |
| community **full suite** | **65 files, 1635 passed, 8 skipped, `EXIT=0`** |
| `rel015` re-run after the route arms landed, + `fb010` | **45/45 `EXIT=0`** |
| editor `tests-unit/rel-015` (**verbose — both files confirmed to RUN**) | **21/21 `EXIT=0`** |
| editor full `test:main` | **7027 passed, 8 failed, `EXIT=1`** — see §E2 |
| `catalog:check` | 🔴 **`EXIT=1` — and it was red before this session.** §E1 |

**The reverted arm, both halves.** Platform: put `profile_meets_bar` back and take
`listing_status` out of both readers → `rel015` **2 red**, `uni003` **1 red**, `fb010` **3 red**;
`nat006` stayed green **and that is correct** — its fixture is now *unapproved*, so it is absent
under both rules. Editor: drop `composeListing`'s signed-out branch and restore the falsified
*"already live"* sentence → **exactly one test each**. All restored **byte-identical by md5** and
re-verified green.

### 🔴 §B4 A gate in ANOTHER phase caught a real mistake, and it was right

`uni-001/session-readers.test.ts` AC4 counts `session?.token` in `useCommunityPeople.ts` and expects
it **once per client** — *"a third use is a third place a decision could hide."* The first draft
gated the listing read on `session?.token` (a signed-out caller's answer is a 401 nobody needs).
**The optimisation was defensible and the rule is better**: the read is now unconditional and every
decision about what to DRAW is made in `composeListing`, off `me`.

✅ **The gate was repaired by DERIVING the population, not by picking a better literal.** It read
`toBe(2)`; it now reads `toBe(clients)` where `clients` is counted from the source, with a
`toBeGreaterThan(0)` beside it so `0 === 0` cannot satisfy it. Mutant-checked: a token use that is
not a client reddens it (`Expected: 3, Received: 4`).

---

## ⬅️ §C WHAT SESSION 33 DID **NOT** DO

1. 🔴 **NOTHING IS COMMITTED.** Both repos are dirty. See §E3 for the exact pathspecs.
2. 🔴 **NOTHING IS DEPLOYED and `0025` has never run against production.** It sets every existing
   row to `unlisted`, so whoever is on `/people` today **comes off until approved** — and under
   **D4 their `/u/<handle>` 404s too**, which was not true when REL-015 wrote its deploy note.
   **Count first**: `select count(*) from profiles where visibility='public' and hidden_at is null;`
3. **The card has never been driven in a running editor.** It is graded by element-tree walk and by
   a round trip through the real route against a real database. Neither is a person clicking it.
4. ⏳ **REL-015 AC9/AC11 are still Richard's** — two YouTube links, one real tutorial.

---

## 🔴 §D WHAT THE NEXT SESSION BUILDS, IN THIS ORDER

**Build, do not survey.**

1. 🟢 **The chat composer** (§A item 2, **FB-013**, phase 75) — **BUILT session 34.** Post + reply
   from the launcher, mirroring the bench's `threadwrites.ts`/`composeReplyBox` pattern. See
   [FB-013-SCOPE.md](../phase-75-0.2.1-the-feedback/FB-013-SCOPE.md) §10a for the full build note.
   ⏳ Not committed, not driven in a running editor.
2. 🟢 **The Shape/SVG node**, stage 1 only (§A item 3) — **BUILT session 34.** `shape` enum, three
   paths, both gate traps taken, export deferred correctly, catalog patched (hand-applied and
   verified byte-identical to a `--out-dir` generation — see §E1 below, now closed). See
   [NOTES-UNOWNED-NODE-WORK.md](NOTES-UNOWNED-NODE-WORK.md) §1's "what actually shipped" block.
   ⏳ Not committed, not driven.
3. ✅ **The Dropdown research** (§A item 4) — **DONE session 34**, nothing built.
   [`NOTES`](NOTES-UNOWNED-NODE-WORK.md) §3 has all five answers, a working precedent (`proplist`)
   and three unchosen build directions, plus an independently-shippable one-line fix for the
   *"go back to two default items"* half. **Next: pick a build direction with Richard, or just
   ship the one-line default-items fix on its own** — it does not depend on the harder decision.
4. Then §A4, cheapest first.

⚠️ **None of these blocks the 0.2.2 cut.** [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) does
(a fresh install opens Learning empty) and it is built pending its drive.

🔴 **NOTHING FROM THIS SESSION IS COMMITTED.** Five packages carry uncommitted work:
`noodl-core-ui`, `noodl-editor`, `noodl-viewer-react`, `nodegx-export`, `noodl-types` (the chat
composer + the Shape node), on top of §A1's still-uncommitted icon-colour/video work already in
the tree. See each section above for the touched files; nothing here has been driven in a running
editor.

---

## 🔴 §E THE THREE THINGS THAT WILL BITE THE NEXT SESSION

### §E1 `catalog:check` is RED — Video is still blocked on §A1; the Shape node is NOT (patched by hand, verified)

`npm run catalog:check` → **`EXIT=1`, "Stale node catalog"**, unchanged since s33 measured it.
`generate.js --out-dir <scratch>` diffed against the working copy still finds the same two deltas
that are not this session's:

| delta | whose |
|---|---|
| the Video `Source` description | s33 |
| four `#FFFFFF` → `#000000` icon-colour defaults, one dropped default | 🔴 **§A1's uncommitted "every icon white" work, still uncommitted** |

So the Video sentence **still cannot be committed on its own** — committing `video.ts` without the
catalog makes the branch inconsistent, and regenerating in place bakes §A1's colour work into an
artifact under somebody else's commit. **It lands when §A1 lands.**

🔴 **s34 hit this wall too, building the Shape node (§D2), and ran `generate.js` in place without
`--out-dir` first** — the exact mistake this section warns about, sweeping §A1's colour deltas and
the Video sentence into the catalog alongside the new `shape` port. ✅ **Caught before it went
anywhere**: `git checkout --` reverted the file, then the three Circle-only JSON hunks
(`displayName`, the `shape` port object, the `dynamicports` group) were copied by hand from a
`--out-dir` scratch generation. **Verified, not assumed** — a script confirmed `Circle` is the
*only* node in the file differing from `git show HEAD:…`, and that its entry is byte-identical to
a fresh generation. So the Shape node's catalog delta is isolated and ships fine; **Video's is not,
and still needs §A1 to land first, unchanged from s33's finding.**

### §E2 The eight reds are NOT this session's — and there are **eight**, not nine

s32 recorded nine. The count is now **8**, and one of s32's three suites is gone:

| suite | reading |
|---|---|
| `sb-007` ×2 | §A1 added `site-builder` to `HELD_TEMPLATE_IDS`; the suite was owed an update and did not get one |
| `vfn-011` ×6 | the bench-vs-runtime drift gate for §A1's Visual Function edit. `values` and `statements` agree; only the error flag differs. ⚠️ **s32 called this inference and it still is** |
| ~~`REL-009b/projectFileWatcher`~~ | s32's flake — **green in both of this session's full runs** |
| ~~`uni-001/session-readers`~~ | 🔴 **was s33's, and is fixed** — §B4 |

🔴 **So the eight belong to §A1, whose author still owes them.**

### §E3 Committing — the pathspecs, and why they are two

Nothing was committed because nothing asked for it. Both sets are self-contained.

**`nodegx-community`** (all of REL-015, s32's build + s33's rulings and route):
```
git -C ../nodegx-community add scripts/approve-listing.ts scripts/publish-replay.ts \
  scripts/publish-tutorial.ts src/db/sql/0025_rel015_listing_approval.sql \
  tests/rel015-listing-approval.test.ts
git -C ../nodegx-community commit scripts/ src/ tests/ -m "…"
```

**`OpenNoodl`** — ⚠️ **`git add` the two untracked paths first ([a pathspec commit skips untracked
files silently](../../../)), and LEAVE `video.ts` out** (§E1):
```
git add packages/noodl-core-ui/src/components/community/CommunityListingCard.tsx \
        packages/noodl-editor/tests-unit/rel-015/
git commit packages/noodl-core-ui/src/components/community/ \
  packages/noodl-core-ui/src/preview/launcher/Launcher/views/Community.tsx \
  packages/noodl-editor/src/editor/src/hooks/useCommunityPeople.ts \
  packages/noodl-editor/src/editor/src/models/community/ \
  packages/noodl-editor/tests-unit/uni-001/session-readers.test.ts \
  packages/noodl-editor/tests-unit/rel-015/ \
  dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/ -m "…"
```
🔴 **Never `git add -A`.** The tree carries at least six other sessions' uncommitted work —
phase-70's whole `EL-00*` set, phase-71, phase-75's rulings, phase-81's verdict shots, and §A1.

---

## §F The board, re-derived from [`TASKS.md`](TASKS.md), 2026-09-04, session 33

🔴 **Re-derive it yourself.** Eleven handoffs have been overtaken by a ruling or a row landing after
they were written. ✅ **Read the FINDINGS a row owns, not only its status.**

| # | row | state |
|---|---|---|
| 6 / 6b | REL-002c · [REL-010](REL-010-AS-GOOD-AS-THE-PAGE-HE-RATED.md) | ⏳ **RICHARD'S LOOK.** Judgements 1 and 3 built; **2 and 4 still unbuilt** |
| 7 | REL-001 — publish the members' area | ⏳ **RICHARD.** *fix first, publish once*. Nothing stands against it |
| 8 | REL-004 — cut and tag `v0.2.2` | 🔴 `cline-dev` unpushed (**674+** at s29; re-derive at cut time), CI has run on none of it |
| 9c | REL-011c | 🟡 ⏳ AC3 is Richard's ruling. **Site builder is BACK ON HOLD** (his D1) |
| 11 | [REL-012](REL-012-THE-LESSONS-NOBODY-RECEIVES.md) | 🟢 ⏳ **BLOCKS 0.2.2.** AC1–AC4 built, 30/30. **AC5 is a drive** needing his `~/Library/Application Support/NodeGX` moved aside |
| 12 | [REL-013](REL-013-THE-TEMPLATES-TAB.md) | 🟢 40/40. ⏳ AC2's *"no request on cold start"* is proven structurally, not by watching the network |
| 13 | [REL-014](REL-014-THE-VALUE-THE-FIELD-DESTROYS.md) | 🟢 86/86 — **four copies, not two** |
| 14 | [REL-015](REL-015-THE-SHELVES-YOU-CAN-FILL.md) | 🟢 ⏳ **s33: measured, and the editor button built.** Residuals in §C |

---

## §G Working rules for this tree — carried forward, plus what s33 earned

0. 🔴 **A SPEC THAT FAILS TO *RUN* REPORTS A CLEAN TEST COUNT.** ✅ Gate on the EXIT STATUS and the
   SUITE COUNT, never on the absence of a `✕`.
   🆕 **AND `Tests: 0 total` CAN JUST MEAN THE WRONG DIRECTORY.** s33 read `10 failed, 0 total` and
   started debugging a broken spec; `npx jest` had been run from the repo root instead of
   `packages/noodl-editor`, picking up a different config. **A compound `cd … && …` persists the
   cwd into later tool calls.** ✅ `pwd` first, or use absolute paths.
1. 🔴 **AN UNQUOTED HEREDOC EXECUTES BACKTICKS INSIDE THE TEXT YOU ARE WRITING.** s33 wrote a
   comment containing `` `Video.tsx` `` through `python3 - <<PY` and the shell **ran it** — the file
   was written with that identifier silently missing. ✅ **`<<'PY'` always**, and never interpolate
   a path into the heredoc; pass absolute paths inside instead.
2. 🔴 **BACKTICKS INSIDE A TAGGED TEMPLATE LITERAL TERMINATE IT.** Ten `TS1005`s from writing
   markdown-style SQL comments inside `` sql`…` ``. ✅ SQL comments in this codebase carry no
   backticks, deliberately — match the file you are editing.
3. 🔴 **A GATE IN ANOTHER PHASE THAT GOES RED IS USUALLY RIGHT.** §B4. ✅ And repair it by
   **DERIVING** the population, never by picking a better literal.
4. 🔴 **REGENERATING A SHARED ARTEFACT IS AN UNPERFORMED MERGE.** ✅ `--out-dir` to a scratch
   directory and **diff** before writing in place — it is what told s33 that four of five catalog
   deltas belonged to somebody else.
5. 🔴 **A LITERAL IN A GATE IS NOT ONLY AN ID — A WORD THE PRODUCT PRINTS IS ONE TOO.** Import the
   product's vocabulary; never retype it.
6. 🔴 **AN OOM LOGS `0 error TS` AND READS EXACTLY LIKE A PASS.** Gate on the exit status; `134` is
   the V8 abort. ✅ And compile the UNEDITED file as the control.
7. 🔴 **A `tsc` EXIT=0 PROVES NOTHING UNTIL YOU CHECK WHAT THE CONFIG INCLUDES.** ✅ s33 checked:
   the community `tsconfig.json` is `**/*.ts` + `**/*.tsx` with only `node_modules` excluded, so
   `tests/` and `scripts/` are in — which is what made that `EXIT=0` worth reporting.
8. 🔴 **A SENTINEL MUST NOT COLLIDE WITH A REAL READING.**
9. 🔴 **WHEN THE USUAL CONTROL IS UNAVAILABLE, SAY SO AND FIND ANOTHER ONE.**
10. 🔴 **A LITERAL COUNT GATE ONLY WORKS IF SOMEBODY RUNS IT.** Touch either template artefact ⇒
    mcp jest + its drives + `test:main` **and** `test:ci`.
11. 🔴 **COMMIT BY PATHSPEC, NEVER `git add`** — except untracked paths, which a pathspec commit
    **skips silently**. See §E3 for this tree's live list of other people's work.
12. 🔴 **NEVER OPEN `templates/members-area` OR the site-builder template IN THE EDITOR.** Work
    through `npm run template:members` / `template:site-builder`.
13. ⚠️ **`test:ci`'s readout is `packages/noodl-editor/tests/test-results.json`**, not
    `packages/noodl-editor/test-results.json`.
14. ⚠️ **`electron/dist` in `ps` matches the MCP servers.** Read `ps -o command=` before attributing.
