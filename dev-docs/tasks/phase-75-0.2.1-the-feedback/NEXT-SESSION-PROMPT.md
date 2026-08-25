# Phase 75 — next session

**State as of 2026-08-25 (session 37).** Richard's brief is still **speed: keep knocking out phase
75**, so this file leads with the queue. Take the top unblocked item; dip into the rest when it bites.

**Committed this session:** queue item 1 — **both functions that reached nobody now reach
somebody**, built, specced and driven in a real editor.

⚠️ **Peers.** `3878` is **opennoodl-78**, this checkout. Other names are other projects.
🔴 **`SendMessage` to a cross-session peer needs the `[ref]`** — the bare name is rejected with the
ref in the error, so just re-send.

## The queue — unblocked, cheapest-first. Take the top one.

| # | item | size | state |
|---|---|---|---|
| 1 | **FB-014** search that survives renames | **M** | design + prototype only, pgvector |
| 2 | **FB-005** templates | **S then L+** | **scope doc first** — that doc is the unblocked part |
| 3 | **FB-013** chat | **L** | 🔴 **ruled 08-22: OVERRULED, build it.** Pulls in FB-014's 2nd corpus |

✅ **The "two functions that reach nobody" item is CLOSED.** Both are wired, specced at the
*caller*, and driven. Detail below — read it before touching either surface.

✅ **FIX-027 §17, §19 and §20 are CLOSED** — built, driven, acceptance criteria 4 and 6 met.
✅ **FIX-025 is fully driven** bar two items that are not ours to unblock (§5 needs Richard signed
*out* of his live community session; §7 needs a real answered thread *and* a platform data fix).

## ✅ Item 1, closed: the two functions now reach somebody

**`refusalHeadline`** — `ConnectionBar` derives it, `DocsPopup` renders it above the detail
sentence. 🔴 **The derivation went into `refusalPlan.ts`, not the component.** That module exists
because two earlier halves of this same UI rotted in `ConnectionBar`, which needs the node library
singleton and a drag in flight, so no spec can construct it. A third rule in there would have been
the same mistake a third time.

**`resetLessonFromPlatform`** — `canReset` gained a **third arm, `'needs-network'`**: a *yes* that
the synchronous register cannot act on. `models/lessonreset.ts` routes it to the fetch and
`ProjectsPage.repullFromPlatform` supplies the client. 🔴 **A string discriminant, not a boolean —
this repo sets no `strict`.** Every surface that decides whether to *offer* Start again now asks
`isResetOffered`, never `=== 'available'`: that literal was correct with two arms and silently
became "hide the button for every Community lesson" when the third arrived.

⚠️ **Left open, and it is inherent rather than sloppy:** a learner whose network is down is told so
**at the launcher, after** the lesson has closed. Whether the platform is reachable cannot be
answered on disk, and the reset can only run once the project is closed. `resetLessonFromPlatform`
guarantees nothing was deleted, so they land on an intact lesson with the card's Reset one press
away — but the confirm now says *"downloaded from NodeGX Community"* so the trip is not a surprise.

## 🔴 The finding of this session: A CALLER-GREP IS A GATE NOTHING ELSE PERFORMS

Both functions were **green, specced, and in one case mutation-checked** — while reaching nobody.
`resetLessonFromPlatform` had **two** spec files and every row passed throughout the entire period
the feature did not exist. FB-021 already recorded the shape and it is worth restating: *mutation
testing proves the spec reads the function; only a caller-grep proves the function reaches a user.*

✅ **So the new specs grade the CHOICE, not the function** — `refusalHeadlineFor` and
`resetLesson`, both of which fail if the wiring is pulled out. A spec that only exercised
`resetLessonFromPlatform` would have stayed green through the whole outage, and did.

## 🔴 Second: TWO DEFECTS MY OWN SPECS FOUND IN MY OWN FIX

1. **`|| ''` for a missing source type** rendered *"A `<strong></strong>` output cannot drive a
   number input"*. I had argued the case was unreachable. **An argument about reachability is not
   a guarantee about output.** Fixed in `refusalHeadline`, which owns the branching — in the caller
   it would have had to restate which reasons need a source type, and the copies would drift.
2. **`!== 'available'`** in `reset()` would have refused with `reason: undefined` — a toast reading
   "undefined" at the one moment a learner is already stuck — because the new arm carries no
   `reason`. The compiler then caught the *same shape* in a neighbouring spec whose guard stopped
   narrowing. Spell the arms out when a union grows.

## ⚠️ The session-readers gate has a rule, and it is not "add the row"

`uni-001/session-readers.test.ts` went red because `ProjectsPage.tsx` now reads the community
session. Its comment forbids making it green without first answering *does this change what the
editor can do without an account?* **Answer: no** — the read is unconditional, a signed-out editor
gets `token: null`, and the re-pull goes out the same. That is recorded in the row, and backed by
three new behavioural assertions (not gated / token read once / a control proving the checker can
see a gate on that file at all).

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

✅ **Everything in last session's driving section still holds.** New this session (s37), driving the
**connection popup**, which is harder to reach than most surfaces:

🔴 **Stage the drag instead of aiming at connector pixels.** `window.__nodeGraphEditor` is live;
`ed.connectionPopups` is on it. Set `ed.interaction.draggingConnection = {fromNode, toNode}` (node
*views* from `ed.forEachNode`, which ⚠️ **stops on a truthy return** — push in a statement, never
`return out.push(...)`) then call `ed.connectionPopups.open()`. Real components, real props, no
canvas arithmetic. `open()` is inside a `setTimeout`, so wait ~2s.

⚠️ **The target panel is INERT until a source port is picked** — that is the product's design, not a
blocker. Before picking, the only refusals are `gated` ones (the gate pass runs outside the drag
guard); after picking, the two folded blocks appear. Both are worth measuring; they exercise
different `refusalHeadline` branches.

🔴 **Half the DOM is a measuring copy.** `[class*=refusedSummary]` returned **12 nodes, 4 real** —
the duplicates sit at `y≈1317` in a window `781` tall. Filter to `r.top>=0 && r.bottom<=innerHeight`
*and* re-query immediately before clicking; the list reflows under you between evals. The real rows
carry `aria-expanded`; the measuring copies do not, which is the cheaper discriminator.

✅ **`elementFromPoint` again, and it earned its place twice** — once catching that the target
panel's own disabled overlay was on top (correct behaviour), once confirming a row was reachable
after a reflow had moved it. ⚠️ Guard for `null` before `el.contains(top)`; it throws otherwise.

✅ **Hover via a dispatched `mouseover`,** not `cdp drag` — a real press on a refused row fires the
**redirect** and edits the project. `new MouseEvent('mouseover',{bubbles:true})` reaches React's
root listener; then wait ~2s for the async catalog lookup before reading `.popup-small-docs`.

⚠️ **`cdp click` wants a selector, not `"x,y"`.** Tag the element in an eval
(`el.setAttribute('data-drive','x')`) and click `[data-drive=x]`.

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

- `npm run test:main`: **340 files / 5495 specs / 0 failures** (was 339/5478; +1 file, +17 specs).
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
