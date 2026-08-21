# Next session — squash the rest of them

FIX-025 is committed and six of its items are confirmed in a running editor. Since then Richard
used the tutorials and filed **seven more** — researched in `FIX-027-THE-TUTORIAL-DOES-NOT-TEACH.md`,
and 🔴 **one of them is that *Log a thing* cannot be completed at all.** That is now the top of the
list, ahead of the three FIX-025 leftovers.

Read `FIX-025-THE-LAUNCH-LIST.md` first: several fixes deliberately reversed previously-specced
behaviour and the reasons are recorded there, not in the diffs.

## State you are inheriting

| repo | branch | state |
|---|---|---|
| `~/vscode_projects/OpenNoodl` | `cline-dev` | `0f97fcef` fixes, `3d8b1628` docs. ⚠️ Other sessions' uncommitted work is in the tree (`scripts/library/check.ts`, `AskAboutNodeDialog.module.scss`, several `dev-docs/` phases) — **not yours, do not sweep it** |
| `~/vscode_projects/nodegx-community` | `main` | `c5d3ad5`, **deployed to nexus-1** |

Measured 2026-08-21 — ⚠️ **re-measure, never quote a handover's**:

- `npm run typecheck:editor` exit 0 · `npm run test:main` exit 0, **300 suites / 4865 tests / 0 failures**
- platform `npx tsc --noEmit` exit 0 · `tests/uni007-intake-and-pathing.test.ts` **30/30**
- `test:ci` at seed 39393 — **2849 specs / 10 failures, the floor name for name** (see the appendix)

---

## 1. ✅ Bug 6 is CLOSED — the intake saves

Richard answered the three questions in the editor on 2026-08-21 and the row landed. Measured on
nexus-1: **1 row, `jsonb_typeof` = `object`** (not the double-encoded string scalar the first
attempt at the fix produced), `taken_at` 08:34:11Z. `learner_intakes` had been empty since the
table was created, so **this is the first intake that has ever saved in production.**

⚠️ **The mechanism is still not established** and the comment on `recordIntake` still says so.
What is now known is that removing the `Parameter` wrapper fixed it in the built bundle. If the
same `TypeError` ever appears on another route, that is the signal to convert the ~8 remaining
`sql.json()` call sites — grep for `ERR_INVALID_ARG_TYPE` with `Function.str` in the frame.

---

## 2. 🔴 FIX-027 — the tutorials, and the one that cannot be finished

**Read `FIX-027-THE-TUTORIAL-DOES-NOT-TEACH.md`.** Seven reports, already researched to root
cause; three of them are the same root cause. The short version:

**Nine reports now, not seven** — bugs 21 and 22 came from the learner path.

- 🔴 **21 — *"Explain this for me"* has never worked for anybody.** The button sends `step.slug`;
  the route matches `step.teaches`; ✅ **measured: they are equal for 0 of 15 lessons**, so every
  click 404s. The route itself is healthy (401 unauthenticated, same as the intake control).
  Recommend matching on `slug` server-side and keeping `teaches` for the prompt.
- 🔴 **22 — one intake question changes nothing observable.** ✅ Measured with the real `pathFor`
  over all 18 combinations: **6 distinct paths**, and `experience` produces byte-identical step
  lists for all three answers. Its only consequence is the projection prompt — i.e. bug 21. **A
  product decision for Richard**, not a patch.
- 🔴 **14/15/16 — *Log a thing* is unfinishable.** Its first task says *"Open the **Data** panel and
  create a collection"*; Data lives inside **Backend Services**; Backend Services is
  `isDisabled: isLesson === true` (`router.setup.ts:339`). A disabled rail click is a no-op, no
  lesson action can open a panel, and the database refusal message *names Backend Services as the
  remedy*. **⚠️ Do not just delete the `isDisabled` line** — the author reasoned case-by-case
  (see the `Settings` note at `:454`). Decide the narrow question: a lesson that teaches the
  database must be able to reach it. **This one needs Richard's call on which of the three
  options.**
- **17 — a task step never shows its instructions until clicked.** The mechanism exists and is
  pointed the wrong way: `showPopupWhenSelected={hasConditions === false}`
  (`LessonLayerView.jsx:83`). 🔴 **Do not simply invert it** — trigger on step *transition*, not
  on render, or it will reopen while the learner works.
- **18 — "all 3 steps done" arrives with "21 problems".** ✅ Measured: `state-on-a-page` ships
  with **26 validator diagnostics, 6 of them errors**; `log-a-thing` ships **clean**. The learner
  did not cause them. ⚠️ The grade said 21 and the validator says 26 — **find the filter before
  quoting either**.
- **19/20 — there is no "well done", and where there is, exit is the only option.** ⚠️ A *Reset*
  at the completion moment must handle `reset()`'s refusals (see FIX-026).

---

## 3. The three undriven FIX-025 items — recipes, not vague pointers

✅ **`COMMUNITY_URL` is a hard-coded constant** (`models/community/communityorigin.ts:16`,
`https://community.nodegx.io`) with **no env override**. So every community drive from the editor
hits **production**. That is what makes bug 5 safe and bug 7 awkward; it is not a thing to
discover twice.

### Bug 12 — the wrong-typed wire (easiest, start here)

The warning is a `WarningsModel` entry keyed `con-type-unconverted`, raised in
`NodeGraphModel.getConnectionHealth` (`:840`) — it shows in the ⚠ badge / warnings panel, **not**
as a connection error.

1. Open `tut001-drive` from the launcher. Its `PuppyCard` component holds a **Visual Function**
   whose `myInput` port is declared **`number`** — already the exact shape Richard described.
2. Wire the `String` node's output into `myInput`.
3. **Must be true:** a **warning** (never an error) reading *"This connects a **string** to a
   **number** port, and …"*.
4. 🔴 **Run the control:** wire a *number* source into the same port and confirm **no** warning.
   A warning that fires on everything is the failure mode this was written narrow to avoid.

### Bug 5 — the signed-out intake questions (drivable, safely)

The last session recorded this as "not done — it needs signing out of Richard's live session."
**That was too cautious.** The session is one file and the recorded practice is to copy it first:

1. `cp ~/Library/Application\ Support/NodeGX/nodegx.community.session.json` to the scratchpad.
2. Delete it, launch, and look at the Learning tab **signed out**.
3. **Must be true:** the three questions do **not** look answerable — no live radio buttons and no
   enabled *Build my path* offering to save something that cannot be saved.
4. Restore the file and `diff` it back. See [[the-editors-userdata-is-NodeGX]].

⚠️ Confirm the signed-**in** rendering afterwards as the control; it was measured on 2026-08-21
and is correct (questions shown, no "Sign in" prompt).

### Bug 7 — the mirror reply (hardest; scope it before starting)

Needs a **really answered** thread, and the hard-coded origin means you cannot point the editor at
a local platform without editing `communityorigin.ts`. Two honest options, and **pick one before
writing code**: patch the constant behind a dev-only override (a real change, worth having for
every future community drive), or ask Richard to answer one of his own threads on production.
**Do not fake a reply row in the production database.**

---

## 4. FIX-026 — blocked on a decision, not on effort

`FIX-026-PUT-IT-BACK.md` is written. 🔴 **Its stated foundation was false**: `Learning/<slug>/`
is the learner's *working copy*; there is no pristine original beside it, and the only source
(`entry.source.path`) is a `/tmp` path for one of the two installed lessons. Three options and a
recommendation are in the file. **Richard decides before any code.**

---

## 5. Where to hunt next, when the list above is done

- 🔴 **`tsfixme` is the last open red on the 0.2.0 ratchets, and it is a decision** — +37 `TSFixme`,
  +125 `any` across **45 files** (the "~20" was the ratchet's display cap). 68% is test files; 32
  of the 52 shipped-source additions are in **one** `.d.ts`. ✅ Smallest useful move: type that
  file, raise the baseline for the rest **visibly**. Do not silently ratchet it.
- 🔴 **The 0.2.0 draft must not be published until it is verified on CLEAN machines** — Windows is
  unsigned and has never been past SmartScreen; a dev machine masks it.
- ⚠️ **`Test (editor)` in CI is UNSTABLE, not merely at its floor** — three runs, one finished.

---

## 🔴 Traps this phase paid for — read before driving

- **`npm run dev:debug` runs against the LIVE `NodeGX` userData.** Same lesson folders, register,
  and community session as the shipped app. **Back up `Learning/`, `learning_folder.json` and
  `lessonProgress.json` before a lesson drive; `diff -rq` to prove the restore.**
- **The running editor rewrites `learning_folder.json` from memory** — editing it on disk to move
  a lesson's resume point does nothing while the app is up.
- **A popup-only lesson step opens a modal nothing in the CDP helper can dismiss** (no `key`
  command; a synthetic `Escape` on `document` does not reach `KeyboardHandler`). To reach the
  canvas, resume the lesson on a **card** step instead.
- ✅ A synthetic `keydown` with `key: 'Delete'`, or `key: 'z'` + `metaKey`, **does** drive node-graph
  commands — `KeyboardHandler` maps via `KeyCodeUtils.fromString(event.key)`.
- ✅ **`window.__nodeGraphEditor` is a real global**: `forEachNode`, `selectNode`, `findNodeWithId`.
  It takes **view** nodes (`n.model.label`), not model nodes. It is how to select a node without
  canvas coordinates.
- ✅ **Tag-then-click** for anything computed: `eval("…setAttribute('data-drive','x')")` then
  `cdp click "[data-drive=x]"`.
- 🔴 **Driving a fix finds what reading it cannot.** FIX-025's thirteenth bug was *created* by
  fixing its eleventh. Ask **"what runs now that never ran?"** — see
  [[fixing-a-grader-makes-new-states-reachable]].

---

## Appendix — `test:ci` floor, re-measured 2026-08-21 on tree `3d8b1628`

```
Jasmine: 2849 specs, 10 failures (failed).      seed 39393
```

✅ **At the floor, and confirmed name for name** — not merely by count. FIX-025 introduced
nothing. The ten, and they are the same ten the 08-19 floor recorded:

| n | spec family |
|---|---|
| 4 | `AIX-006 style vocabulary` — guidance-off raw candidate · AIB-009 F11 stalling provider · one advisory style pass · suggestion never downgrades |
| 2 | `AI model registry` — openai-compatible shares the OpenAI catalogue · exactly one default per provider |
| 1 | `AIX-011 — update mode is judged against its own base` (AAQ-005 pre-existing warning) |
| 3 | `SUB-011 expression parameters — the validator stays silent` — no diagnostics · after round-trip · in strict mode |

🔴 **Read the count from the SUMMARY LINE and the failure names from
`packages/noodl-editor/tests/test-results.json`, never from `$?`.** This run is the trap in both
directions at once: the suite genuinely exited **1** (`lerna ERR! npm run test:ci exited 1`) which
is what a *clean floor* looks like, while the harness reported the backgrounded command as **exit
0** — because the chain ended in an `echo`, so the compound's status was the echo's.

✅ **Delete `packages/noodl-editor/tests/test-results.json` before the run and require a fresh
mtime after** — it is the readout, not the log, and a stale one reads as a perfect pass. This
one: `10:10:53`, ~13 minutes after the start.

⚠️ **Run it alone.** Check `memory_pressure`, not `vm.swapusage` — swap read 11.8G of 13.3G on
this machine while memory was **79% free**, because macOS does not reclaim swap. The swap figure
alone would have wrongly postponed this run.
