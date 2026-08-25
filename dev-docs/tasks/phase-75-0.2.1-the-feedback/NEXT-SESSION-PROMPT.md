# Phase 75 — next session

**State as of 2026-08-25 (session 36).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it bites.

**Committed this session:** FIX-027 **19 + 20** — the completion moment — built and driven, plus
the two defects the drive found (a blocker over the banner, and a contrast failure I introduced).

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout. Other names are other projects.
🔴 **`SendMessage` to a cross-session peer needs the `[ref]`** — the bare name is rejected with the
ref in the error, so just re-send.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **Two functions that reach nobody** | **S** | `refusalHeadline` *and* 🆕 `resetLessonFromPlatform`; see below |
| 2 | **FB-014** search that survives renames | **M** | design + prototype only, pgvector |
| 3 | **FB-005** templates | **S then L+** | **scope doc first** — that doc is the unblocked part |
| 4 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** Pulls in FB-014's 2nd corpus |

✅ **FIX-027 §17, §19 and §20 are CLOSED** — built, driven, acceptance criteria 4 and 6 met.
✅ **FIX-025 is fully driven** bar two items that are not ours to unblock (§5 needs Richard signed
*out* of his live community session; §7 needs a real answered thread *and* a platform data fix).

🆕 **Item 1 is now TWO functions, and they are the same shape.** `refusalHeadline` has four
headlines and no caller in `src/`. **`lessonplatforminstall.resetLessonFromPlatform` is the
same** — specced in two test files, imported by nothing in `src/`. Worse, it was *load-bearing in
a sentence*: `reset()` used to tell a learner "Resetting it needs the community panel", while
`models/community/tutorialsview.ts:26` says resetting "is the Learning section's business" and the
Learning section calls `reset()`. **Each surface pointed at the other and neither re-pulled.** The
sentence is now honest (it names the fact, not a door), and `uni-007/learningfolder.test.ts`
asserts it does **not** name a surface. Wiring the fetch is the actual fix and is still open —
`useTutorialInstall.ts` already builds the `PlatformInstallDeps` it needs.

**Blocked on Richard, do not start:** FB-012 and FB-009 (both need *content*), FB-017 scope 2's
`Source Set`, FIX-026 (a)/(b), FIX-027 14/15/16 + 22, tsfixme baseline, prod `ANTHROPIC_API_KEY`
(⚠️ **intro pricing ends 2026-08-31 — six days**), the 15 lessons' prose, Discord's row in the `?`
menu, `/rfps` search.

✅ **Nothing is waiting to deploy.** ⚠️ The *stamp on the box* is still relayed from s19's SSH read —
re-read it before any deploy claim.

## 🔴 The finding of this session: THE COMPLETION MOMENT WAS BEHIND A BLOCKER

The banner rendered correctly, said the right sentence, and its two buttons **could not be
clicked**. `PopupLayer` puts a full-screen dimmer behind every popout, and FIX-027 §17 — last
session's own fix — opens a step's instructions on the edge into it. So a learner finishing a
graded last step had those instructions still open over the bar.

`document.elementFromPoint` at the middle of the banner returned **`popup-layer-blocker`**.

✅ **Carry this: a surface is not delivered until you ask what is ON TOP OF IT.** Reading the DOM,
the props, or `innerText` all said the banner was there and correct. Only a hit-test found that it
was unreachable. `elementFromPoint` at the centre of every control you add is two lines and it is
now the cheapest check I know for "did this actually arrive".

⚠️ **And two orderings needed two fixes.** Finishing *in place* leaves a popout already open → the
layer closes it on the **edge** into completion. **Re-entering an already-finished lesson** draws
the banner first and the entry edge opens instructions a moment *later* → `instructionOpenDecision`
gained `lessonFinished`. **The close cannot reach a popout that does not exist yet, and the
suppression cannot close one that is already open.** Neither covers the other; I nearly shipped
only the first.

⚠️ Still open and **inherent to popouts, not to this banner**: a learner who *manually* re-opens a
finished step's instructions buries the banner again until they dismiss it. Measured. Every popout
in the editor behaves this way and one click clears it.

## 🔴 Second: A TOKEN NAME IS NOT A COLOUR — I introduced a 1.91:1

I put the banner on `--theme-color-secondary-dim`, reasoning that the one moment a lesson
congratulates someone should not look like the eight steps before it. **That token is
`rgb(139,149,161)` — a *light* grey.** Headline **3.04:1**; the refusal sentence **1.91:1**. The
sentence explaining why *Start again* was switched off was the least readable thing on the bar.

✅ Moved to `--theme-color-bg-3`, the tone the fg tokens are designed against (the pairing
`.lesson-check` already uses), with the state signal on a primary rule along the top. Re-measured
in **both themes**: dark 10.84 / 6.81 / 5.85 / 6.94, light 13.33 / 5.07 / 4.61 / 4.57.

⚠️ `tokens:css` passes on this — it checks that a `var(--…)` **names a defined property**, not that
the pairing is legible. It would have passed the 1.91:1 too.

## ✅ What §19/§20 actually needed, in case it is revisited

- **The moment is decided, not authored.** `isLessonFinished` sits beside `stepFlowAction` in
  `lessonstepflow.ts` and takes the **same input type**, so the two cannot disagree about which
  step is last. 🔴 The two lesson shapes finish by **opposite** rules: a graded last step finishes
  when its conditions hold; a narrative one finishes **on arrival**, because `refresh()` sets
  `isComplete = false` on every conditionless step. A rule that just asked `isComplete` would
  report *Log a thing* unfinished forever **while looking correct against the graded lesson** —
  the one anybody would check.
- **Two surfaces, because the two shipped lessons end differently.** *State on a page* ends on a
  graded card with **0 popup buttons** → the bar's banner. *Log a thing* ends on a narrative step
  shown as a screen-centre **modal**, whose buttons were exactly `['EXIT LESSON']` → `START AGAIN`
  goes in the modal. A banner behind a modal dimmer is not an offer.
- **One statement of "can this reset".** `LearningFolderModel.canReset`, with `reset()` as its
  first caller. The specs assert the **agreement** — same sentence from both — not each answer
  separately, so a third refusal taught to one of them fails the pair.
- 🔴 **`Start again` closes the project BEFORE it resets.** `repairFrom` deletes
  `Learning/<slug>/` and copies a fresh bundle over it, and at the completion moment that
  directory **is the open project** — a live `ProjectModel` would write its graph back over the
  fresh copy. Stash the id, `leaveForLauncher`, reset on the launcher's mount. Consumed on read,
  so React 18's double-invoked effect cannot reset twice.

## Driving — what worked, exactly

✅ **Everything in last session's driving section still holds.** New this session:

🔴 **`document.elementFromPoint` at the centre of every control you add.** See above. The two-line
version that found it:

```js
const b = el.getBoundingClientRect();
document.elementFromPoint(b.x + b.width/2, b.y + b.height/2)   // → 'popup-layer-blocker'
```

✅ **Contrast, measured live rather than from the token file** — walk the element's own
`backgroundColor`, falling back to the ancestor when it is `rgba(0, 0, 0, 0)`, and flip themes with
`document.documentElement.setAttribute('data-theme','light')`. ⚠️ Read it back in a **second**
eval; the same one still reports the old palette. `ThemeManager.instance.setMode()` threw from the
renderer — stamping the attribute is what the manager itself does (`ThemeManager.ts:175`).

🔴 **DRIVING A LESSON WRITES TO RICHARD'S OWN PROGRESS, and this session proved the restore.**
`cp -R` the whole `Learning` directory **and** `learning_folder.json` + `lessonProgress.json`,
restore after, verify by checksum:

```bash
find "$L" -type f -exec md5 -q {} \; | sort | md5 -q     # 57 files → c346394c169f9bff0baf8237c777e824
```

Both lessons back at `stepIndex: 3` afterwards, checksum identical. ⚠️ Stop the stack **before**
restoring — the running editor holds the register.

⚠️ **Tag launcher cards by the NEAREST unambiguous ancestor, not by walking N levels.** Walking up
8 parents from a *Continue* button reaches a container holding **both** lesson cards, so the tag
lands on the wrong lesson and you drive something else entirely — which I did, and only noticed
because the step count was 4 instead of 8. Walk up until an ancestor mentions one lesson **and not
the other**. ⚠️ And the button text is not stable: after a reset the card says **"Start"**, not
"Continue" — which is also a free confirmation that the reset landed.

✅ **`window.confirm = () => true` / `() => false`** to drive a native confirm, recording the
message. Drive the **cancel** arm first on anything destructive; both arms took one call each.

✅ **`PopupLayer.instance.hideModal()` alone was not enough** on a popup-only step — the view's
effect re-shows it on the next render. `hideModal()` **and** `hidePopouts(true)`, then measure in
the next call.

⚠️ **HMR did not pick up a new method on `LessonLayer.prototype`** — the live instance keeps its
old prototype. `npm run cdp -- reload` and re-open, then re-wrap; budget ~20s per cycle.

## Gates, this tree (OpenNoodl, `cline-dev`) — 🔴 re-measure, never quote

- `npm run test:main`: **339 files / 5478 specs / 0 failures** (was 338/5457; +1 file, +21 specs).
- `npm run typecheck:editor`: **0 errors**, three times.
- `npm run tokens:css`: clean — 319 stylesheets. ⚠️ **It cannot see a contrast failure**; see above.
- `npm run test:ci`: see the session's own note below — **quote the summary line, never `$?`**.
- 🔴 **`tsc -p packages/noodl-editor/tsconfig.tests-main.json` is NOT a gate and reports 31 errors**
  — unchanged, none ours. It is only ts-jest's `tsconfig`; no npm script or workflow runs it.
- 🔴 **No gate in this repo compiles `LessonItem.jsx` or `LessonLayerView.jsx`.** They are `.jsx`,
  `tsconfig.json` has no `allowJs`, and neither is in the jasmine tests graph. **Running the app is
  the only thing that reads them** — which is why §19/§20's rules live in `lessonstepflow.ts` and
  `lessoninstructionopen.ts`, where jest can grade them.
- 🆕 ⚠️ **This repo's `tsconfig.json` sets no `strict`**, so `strictNullChecks` is off and a
  **boolean discriminant does not narrow a union**. `ResetAvailability` started as
  `{available:true} | {available:false; reason}` and a caller reading `.reason` would not compile.
  Use a **string** discriminant, as `ResetLessonOutcome` beside it already does. The specs found
  this, which is what they are for.

## Still open, owned by nobody

- **Two functions that reach nobody** — queue item 1 above.
- ⚠️ **A manually re-opened popout still covers the completion banner.** Inherent to popouts.
- 🔴 **FB-002's selected pill is 1.16:1 against the panel** — the active fill, and 1.24:1 between
  the active and inactive label, while the border is **identical** in both states. Every individual
  label passes AA (7.9–8.5:1); *which pill is on* does not. It is NAT-008's shared `.FilterPill`,
  so the **people directory has the same invisible selection**. ✅ Cheapest real fix: move the
  state onto the **border**, the one edge already at 3.57:1. ⚠️ Measure in **both** themes.
- ⚠️ Two small things FB-021 leaves undriven: the gated block is no longer given `canRedirect`, and
  the **mixed-group** case. Every group on a `Group` node was homogeneous.
- ⚠️ **The platform sends `firstReplyMinutes: null` on a thread with `replyCount: 1`**, so the
  accepted thread reads *"no reply yet"* everywhere, web included. It is **FIX-025 §7's second
  cause**. 🔴 Do not patch `replyLatency` without deciding the other half — the tab's count is
  wrong by the same data, and fixing only the row leaves the two disagreeing on screen.
- ⚠️ **`MIRROR_THREAD_WINDOW = 100` is a copy of the platform's limit and nothing checks it.**
- ⚠️ `.property-port-gate-target`'s outline and `.Bench`'s gutter are unmeasured in pixels.
- ⚠️ **Only `Group` was driven** for FB-021; the other 174 types are covered by the catalog sweep,
  which grades *sentences*, not rendering.
- ⚠️ FB-022's crosshair settled by mechanism, not pixels; **one commit in three dropped focus,
  uncharacterised**; FB-016's auto-margin branch never exercised in a running app.
- ⚠️ **`AskAboutNodeDialog.module.scss` uncommitted — sixteenth session.** Belongs to no session;
  Richard's call. Same for the phase-70/71/72 working files and the phase-50/68 notes.
- The highlighter's disposal bug: a **selected** node whose element has gone is never removed from
  `selectedNodes`, so it is revisited and `remove()`d every frame.
- Unchased: `SidebarModel.switch('PortEditor')` crashes the panel; Settings clips two rows; a
  `Number` node draws a group literally called `ADVANCED` beside the synthetic `Advanced CSS`;
  `getConnectionSourceLabel` returns nothing for the checkbox row; `check:css` in `nodegx-community`
  has one pre-existing non-ours violation.
- ⚠️ **Pre-existing, not ours**: the projects page logs `Encountered two children with the same key`
  for one project id, and `feed.json` 404s.
- ⚠️ **A wire warning is silent for two seconds after you draw it.** `EVALUATE_HEALTH_DEBOUNCE_MS`
  is 2000 and the urgent lane is 50; `con-type-unconverted` is deliberately on the lazy one.
- ⚠️ **A tooltip has no `max-width`,** so a long health message draws a very wide box — 1074 px in a
  1368 px window. `.popup-layer-tooltip-content p` caps at 268 px; bare inline markup is capped by
  nothing.
