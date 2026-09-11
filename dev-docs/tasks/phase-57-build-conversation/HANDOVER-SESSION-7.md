# Phase 57 — handover after session 7 (2026-08-09)

**What ran:** session 6's BLD-002 work committed and its `test:ci` verdict finally read, then
**BLD-005 built, driven and closed. Correction 2 is closed.** The run header is out of the scroll
area, the estimate refuses to lie three separate ways, and one dimming mechanism turned out to be
unusable at any value.

Phase 57 is **6 of 16 built** (BLD-001 ✅, BLD-002 ✅, BLD-003 ✅, **BLD-005 ✅**, BLD-007, BLD-012).
⚠️ **BLD-007 and BLD-012 are still undriven**, and BLD-012's image block has still never reached a
real endpoint.

## 🔴 Read this before you touch anything

**A sibling session was live on this checkout for most of session 7, and I disrupted it twice.**

- `4020ff80 fix(runtime): the expression error outlived the expression` landed mid-session, and
  `packages/noodl-core-ui/src/components/code-editor/{JavaScriptEditor.tsx,codemirror-theme.ts}` are
  **theirs, uncommitted**. Leave them alone. Every commit this session was pathspec-scoped.
- ⚠️ **`npm run dev:stop` killed their editor.** The script reaps by *checkout*, and a sibling
  session shares this one — "only touches processes belonging to this checkout" is not the same as
  "only mine". **Check `ps aux | grep "[e]lectron/dist"` and `git log` before stopping the stack**,
  and if something is running that you did not start, ask before killing it.
- ⚠️ **I misread their fixture as a stray write and reverted it.** The `ai-test` Home page held a
  Slider → Expression → opacity graph — obviously *their* Expression-node test the moment the commit
  message appeared, and not obviously anything before that. I had backed it up first and **restored
  it**; `ai-test/project.json` currently holds their graph, and that is correct. **Do not "clean" it.**

The general rule this earns: **a dirty fixture is evidence about someone else, not litter.** Read
`git log` on the *repo* before deciding what a change to a *test project* means.

## What BLD-005 measured

Four runs in `ai-test`, scripted provider, from a thread asserted empty (0 turns, **0 run headers**),
five operations paced 5s/5s/25s/5s/5s.

| scrollTop | header top | bottom | above the scroller | h-overflow |
|---|---|---|---|---|
| 0 | 151 | 198 | ✅ | **0** |
| 604 | 151 | 198 | ✅ | **0** |
| 1209 (bottom) | 151 | 198 | ✅ | **0** |

Identical to the pixel, at **364px** — narrower than the 400px the criterion names.

The estimate, as it behaved: **no estimate** at 1-of-5 (0 done) and 2-of-5 (1 done); appears at
3-of-5 as *"about 18s left"*; then 16 → 13 → 12 → **12 → 12**, holding at the two queued operations
while a 25s operation overran a 6s median, instead of reaching `0:00` and sitting there. On a
separate recorded run it predicted 30s against an actual **36s** — 17% under, inside ±40%.

One drive submitted components the gate rejected and the header read **`0 of 5 built`**, not `5 of 5`.

## ⚠️ The finding worth more than the task

> **There is no `opacity` that both reads as dimmed and clears AA in both themes.**

Pending rows shipped at `opacity: 0.55` — **3.27:1 dark, 2.53:1 light** — under a comment I had
written asserting the opposite *before measuring it*. Swept on real composited pixels:

| opacity | 0.55 | 0.65 | 0.70 | 0.75 | 0.80 | 0.85 |
|---|---|---|---|---|---|---|
| **dark** | 3.27 ❌ | 4.03 ❌ | 4.46 ❌ | 4.92 ✅ | 5.41 ✅ | 5.93 ✅ |
| **light** | 2.53 ❌ | 3.10 ❌ | 3.46 ❌ | 3.87 ❌ | 4.34 ❌ | 4.89 ✅ |

Three things generalise:

- **Light mode binds ~0.10–0.15 opacity stricter than dark**, so a dark-only check passes something
  that fails on ship. BLD-002 measured both themes; this is why.
- **Opacity moves contrast without appearing in any colour token.** `tsc`, every pure spec and a
  screenshot all pass. It is [the muted-button trap] reached by a different mechanism.
- Fixed with `fg-default-shy` (**5.57 dark / 5.06 light**, re-measured) plus the status icon that
  already differed. ⚠️ `fg-muted` still fails AA on all three surfaces — non-text affordances only.

## The other trap, which cost a whole re-drive

> **A CSS-module lookup for a class the stylesheet does not define returns `undefined`, so the
> element renders with NO class at all.**

The run map reported **four** roles for five rows the moment the first operation staged, because
`done` styled nothing and `css['Operation-done']` was `undefined`. The row was fine; it had become
**unmeasurable**. A role that vanishes from the DOM exactly when it changes is one no spec, no drive
and no later task can see. All five roles are declared now, two with no declarations and a comment
saying why.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **89 suites, 1237 tests**, zero failures |
| `test:ci` | ⚠️ **not run this session.** Session 6's tree measured **2582 specs, 6 failures** — the inherited four `AIX-006 style vocabulary` and two `AI model registry`. BLD-005 landed after that. |

⚠️ The +26 over the 1211 baseline is **25 new specs plus one**: BLD-002's `it.each(FILES)` sweep
picked up the new `RunHeader.tsx` by itself. A count that is one off is not always a miscount —
check whether a spec enumerates the filesystem before you go looking for a ghost.

⚠️ **Never `tail` a `test:ci` run you intend to read a verdict from** — redirect and
`grep -E "^Jasmine:"`. And note the `FAILED:` list prints **after** the verdict line, not before, so
reading a fixed window above it finds only console noise.

## What to do next

1. **BLD-004** — it now owns **two** filed items, and they are the same shape. **C8**: the collapsed
   run says "12 steps" and deliberately claims no duration, because `AuthoringActivity` has no
   timestamp. **R2**: the current operation in the run map has accent and weight but deliberately
   **no motion** — a pulse driven by `busy` animates hardest exactly when the provider has hung,
   which is the failure correction 2 exists to fix. Stamping activities where the three sessions push
   them closes C8; a real `onActivity` heartbeat closes R2. `RunHeader.module.scss` already documents
   where the motion belongs.
2. **Drive BLD-007 and BLD-012.** Both merged, neither driven, and BLD-012 has a bill attached.
3. **BLD-006** — persistence across a restart, plus the switcher. Note `BuildThread`'s `header` slot
   is deliberately still free for this; BLD-005 took a **separate** `runHeader` slot precisely so the
   two would not fight over one node.
4. **BLD-008** — ⚠️ `question` is **already** a kind on `AuthoringActivity`, with its treatment built
   and its collapse rule decided. **Add the author, not a fifth opinion about how it should look.**
5. **BLD-010** owns two open debts: the docs route of BLD-003 has **never been on screen**, and
   BLD-005's **R5** — cost was never verified against a real provider, because a scripted hook
   returns fixed `usage` and every dollar figure in this session is an artefact of it.

## Driving this panel — additions to the recipe

Session 5 and 6's recipes hold. Four more:

- ⚠️ **`!counter` is true when the counter is `0`.** My hook used `!__driveRead || __driveRead !== i`
  and the first operation returned its context reads **forever** — the run sat on "Reading context…"
  and Stop could not land, because cancel is checked between provider calls and the hook kept
  supplying them. Initialise drive counters to `-1`.
- ⚠️ **An occluded window clamps the run clock.** The elapsed time froze at 6s then jumped to 47s.
  `useElapsedClock` is fine; the renderer was not painting. **Take a screenshot each poll** — it
  forces a frame and the clock ticks normally.
- **A bare `Group` fails the gate for a `Pages/*` target.** It stages fine as `Ui/*`. If every
  operation reports *"could not produce a valid component within its budget"*, that is the target
  kind, not the graph.
- **A source edit mid-drive rebuilds and reloads — but it kept the project open**, landing on the
  Components panel rather than the launcher. Re-open Build from the left rail (the
  `SideNavigation-module__SideNavigationButton` at `top: 196`) and re-`eval` the hook; the thread is
  empty but the project is not lost.

## A technique worth reusing

**Sweep the parameter instead of picking one.** The opacity defect was not found by reading the value
and it would not have been found by checking one value in one theme — it was found by asking the
running app for the ratio at nine opacities in both themes, in one `eval`, and reading a table. A
sweep costs the same as a spot check and it answers *"is there a good value at all"*, which turned
out to be the real question and to have the answer "no".

And the same discipline session 6 recorded, again: **the comment I wrote from reasoning was wrong,
and the measurement one line away was right.** Write the sweep before the justification.

## Fixture and cleanup

`ai-test` holds **the sibling session's** Slider/Expression graph — restored, correct, leave it. No
`Ui/*` component was ever applied; every plan was discarded. The temporary `AiClient` drive hook is
reverted (`grep __driveHook` returns 0). My dev stack is stopped; **the Electron processes now
running are the sibling's.** Screenshots and the fixture backup are in the session scratchpad, not
the repo. No worktree created.
