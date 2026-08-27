# Next session — phase 75

_Written 2026-08-27 at the end of session 58, which closed the one item in this phase that was
measured, precedented, unowned and **not** waiting on Richard: the invisible selected filter pill.
Read `TASKS.md` for the rest of the phase; this file is only about what that session left._

## What happened

Session 57 left the phase with everything open blocked on Richard except one thing it had
deliberately declined to fix at the end of a session: the shared `.FilterPill`'s selected state,
recorded as a defect three times across three shipped tabs. That is now done, driven and closed.

**One commit on `cline-dev`, not pushed** (`1768c72d`).

## Start here

🔒 **The two things that need Richard are unchanged and are still the gate on FB-013:**

1. **R-chat-mod** — the moderation posture the ruling required be asked. `FB-013-SCOPE.md` §8 lays
   out A/B/C, recommending **B** (hide-by-moderator, no reader-facing report). **C5 and the chat
   composer are both behind it** — posting is what creates the messages a posture is about.
2. **Deploying `nodegx-community`.** The chat routes are built, on `main` there (`c5be57b`,
   `91d8b0c`), and **not shipped** — `/api/v1/community/chat` is still 404 on production while
   `/threads` is 200 and an invented path is 404. The launcher's Chat tab is a correct surface
   with nothing to talk to.

⚠️ **FB-012, FB-009 and FB-005 are all still blocked on content from Richard**, and they are the
largest open items in the phase. There is now **no substantial unblocked build work left in P75**
that does not need one of the above. A session picking this up should probably confirm that with
Richard rather than invent something.

## ✅ What session 58 closed, and the part worth keeping

The pill's selected state was carried by **fill alone** — 1.36:1 against the card, with the border
**identical** in both states. Labels were all fine at 8.46:1, which is exactly why it survived:
**state visibility is not text contrast**, and every check anybody had run was a text check.

It reached three surfaces because the seven-line pill markup was **copied into three view
components over one shared class** — one home for the defect, three for the fix. It is now one
`CommunityFilterPill`, and a spec asserts the class is named in exactly one file.

🔴 **The numbers were produced twice, by two instruments, and they agree to the second decimal.**
`tests-unit/fb-002/filter-pill-state.test.tsx` computes them from the stylesheet; the drive
measured painted pixels in the running editor. The arithmetic says the contrast is *available*; the
paint says the rule *wins*. Neither says both.

| pair | dark | light |
|---|---|---|
| active border vs card | **5.60:1** | **4.57:1** |
| active border vs its own fill | **4.13:1** | **3.74:1** |
| active **fill** vs card | 1.36:1 | 1.22:1 — *unchanged, deliberately* |

⚠️ **The fill was left exactly as it was.** The state simply stopped depending on it; delete the
`background` line and the selection survives. That is the property the spec pins.

## 🔴 The finding that was worth more than the fix

The first mutant — `is-active` losing its `border-color`, i.e. **the exact regression that
shipped** — scored **`Tests: 0 total`**, not a named red. `tokenFor` called `expect()` at module
scope, so a deleted declaration threw during *collection*: no sentence naming the defect, and the
other fourteen rows in the file silently stopped running with it.

🔴 **A spec that cannot run is not a spec that failed, and a summary line makes them look alike.**
`tokenFor` returns `null` now and the rows grade it; the same mutant produces six named reds and
everything else still runs. **Any spec that derives its subject from a file should be mutated by
deleting that subject**, not only by corrupting it — deletion is the case that takes the file out.

## ⚠️ Left undone, on purpose

- 🔴 **`--theme-color-border-default` is still Richard's, and is a DIFFERENT defect.** FB-005 T4
  measured it at **1.07:1 dark / 1.15:1 light** against the panel, which makes an **unselected**
  card or pill boundary invisible. This session moved the *selected* state and touched no resting
  boundary. It is a token decision that reaches every surface in the editor.
- ⚠️ **Chat's pills were not driven** — its routes 404 on production, so driving them needs the
  local-platform recipe in session 57's handoff (scratch Postgres + `next dev` on 3399, and a
  one-line revert of `COMMUNITY_URL`). Bench and People were driven; Chat draws the identical
  component and is covered by the spec's rendered row.
- ⚠️ **The people directory's `ChipRow` has no `role="group"`/`aria-label`**, where the Bench and
  Chat both do. Noticed while extracting the component, out of scope, unowned, tiny.

## Gates, as measured this session

- `tsc -p packages/noodl-editor`: clean, and **proven to see the new component by a planted error**
  (1 → 0). ⚠️ It does not cover `tests-unit/`; ts-jest does, and that ran green.
- Editor `test:main`: **0 failures**. First run **357 suites / 5897** — exactly session 57's
  356/5879 plus this session's 1 suite and 18 rows.
- `noodl-core-ui`: **28 / 527 / 0**, unchanged.
- 🔴 **A second `test:main` twenty minutes later read 358 / 5898 and I could not fully account for
  it.** A peer's `tests-unit/sb-017/` appeared between the runs (1 suite, **6** tests), which
  explains the suite but leaves **five tests missing** — and that peer was actively editing
  `registeradapters.ts` and `cloudDynamicPorts.ts`, which specs enumerate. **Quote the tree, not
  the number.** Both runs were 0 failures, which is the claim that survives.
- `test:ci` **not run by this lane.** No source spec under `packages/noodl-editor/tests/` references
  the community components (the only match is a build artefact), so it does not cover this change.
  The P76 lane started a `test:ci` as this session was writing up.

## Standing facts for this area

- ⚠️ **Four peer sessions were live and the machine was traded cleanly.** All four cleared the
  launch, two by checking `ps` rather than recollection. **Keep announcing launch AND teardown.**
- ⚠️ **P76 asks that the local backend "sb015 site backend" (port 8588) be left alone** in the
  Backend Services panel — staged for SB-017 acceptance. Not touched this session.
- ⚠️ **P76's expected `test:ci` shape is 2862 specs / 6 failures** — the AIX-006 floor of 4 by name
  plus 2 deliberately-red SB-017 parity specs. And **`rm -rf packages/noodl-editor/.webpack-cache`
  before running it**: a poisoned cache fails the *build* with ~47 unresolved-alias errors in files
  nobody touched, and reads as your own regression.
- ⚠️ **Not mine and still uncommitted, leave them**: `packages/nodegx-export/*` (P18),
  `tests/cloud/sb017-*`, `tests-unit/sb-017/`, `registeradapters.ts` (P76), and
  `AskAboutNodeDialog.module.scss`, uncommitted since **08-20** and belonging to nobody in this lane.
