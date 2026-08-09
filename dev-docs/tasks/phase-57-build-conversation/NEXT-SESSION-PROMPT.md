# Next-session prompt — phase 57, after session 6

Paste everything below into a fresh session.

---

You are picking up **phase 57 (BLD — the Build panel as a conversation)** on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`.

Read `dev-docs/tasks/phase-57-build-conversation/HANDOVER-SESSION-6.md` first, then `TASKS.md`.

## 🔴 Do these three checks before anything else

1. **`git status` — session 6's BLD-002 work may be UNCOMMITTED.** That session ended while
   `test:ci` was still running and deliberately had not committed yet. If the tree is dirty with
   changes to `AiAuthoringPanel/`, `AiAssistant/thread/`, `AiAssistant/authoring/AuthoringSession.ts`
   and `tests-unit/bld-002/`, **that is finished, gated, driven work — commit it, do not redo it.**
   `typecheck:editor`, `typecheck:editor-tests` and `test:main` (88 suites / 1211 tests) were all
   green on exactly that tree. Pathspec-scope every commit and re-check `git log` immediately before.
2. **`test:ci` has never been read.** Session 6 started it and did not see the verdict. Re-run it,
   redirect to a file, and `grep -E "^Jasmine:"` — ⚠️ **never `tail` it**, that eats the verdict line.
   ~20 minutes. The expected baseline is **2582 specs, 6 failures**: the inherited AIX-006 (4) +
   model-registry (2). Anything else is new and yours to look at.
3. **`git branch -a`** and check no sibling session is live (`ps aux | grep "[e]lectron/dist"`).
   The editor is a queue.

## Where the phase is

**5 of 16 built.** BLD-001 ✅, BLD-002 ✅, BLD-003 ✅ (all driven and closed — D1, D2, D3, D4),
BLD-007 and BLD-012 merged but ⚠️ **neither has ever been driven**. BLD-012's image block has never
reached a real endpoint, and that is the one with a bill attached to getting it wrong.

## What to work on

Pick up in this order unless Richard says otherwise:

1. **BLD-005** — the pinned run header. Cheapest thing left: `BuildThread` already has a header row
   outside the scroll area, and session 6's C5 fix means anything put in it now sizes correctly.
   ⚠️ **Declare an explicit `height` on any `HStack` you add there** — see the trap below; there is a
   spec in `tests-unit/bld-002/` that will fail you if you forget.
2. **BLD-004** — surface `onActivity` (the heartbeat exists and nothing shows it). It also inherits
   **C8**: BLD-002's collapsed run says *"12 steps"* and deliberately claims **no duration**, because
   `AuthoringActivity` carries no timestamp. Stamping activities where the three sessions push them
   is BLD-004's to do, and then the strip can say how long the work took, not just how much of it.
3. **Drive BLD-007 and BLD-012.**
4. **BLD-006** — persistence across a restart, plus the switcher.
5. **BLD-008** — ⚠️ `question` is **already** a kind on `AuthoringActivity`, with its treatment built
   and its collapse rule decided (a question can never be absorbed into a run). **Add the author, not
   a fifth opinion about how it should look.**

## The trap session 6 found, which is bigger than the bug it caused

> **`Stack` sets an inline `height: 100%` on every `HStack` that does not declare one**
> (`packages/noodl-core-ui/src/components/layout/Stack/Stack.tsx:38`; `VStack` gets `width: 100%`).

In a **block** parent, `100%` resolves against the *whole parent*, not the row's own line. In the
Build panel's header that made a 44px row 104px tall while it started 60px down, so it overflowed by
exactly 60px onto the scrolling thread — and, because `Stack.Root` has no `align-items`, it also
stretched a 36px button to 96px. **Both failures, one declaration.**

Three things to carry:

- **The overflow always equals the offset.** If a filed measurement's numbers "don't close", the
  missing term is usually a property nobody thought to read.
- **It is invisible whenever the content above the row is short**, so it surfaces when a *different*
  element grows and reads as a regression somewhere unrelated.
- **It is filed as C6 on BLD-002, not fixed.** Fixing `Stack` reaches several hundred call sites in
  every panel of the editor — that is a UIX task with its own visual pass, not a panel edit. Also
  filed: **C7**, `PrimaryButtonVariant.Ghost`'s label measures **4.33:1 in light mode** (below AA) on
  every `bg-1` surface, pre-existing and unchanged by BLD-002.

## Working habits that paid off in session 6, worth repeating

- **Re-measure a filed mechanism before trusting it.** BLD-003 filed C5 with a hypothesis and said
  explicitly that its numbers did not close. It was half wrong, and re-measuring found the real
  cause in one pass. **Confirm by intervention, not reasoning** — setting `height: auto` live and
  re-measuring is what turned a guess into a one-word fix.
- **Put the decision about what may be HIDDEN in a pure module.** A collapsed activity run that
  silently swallowed a failed submission looks *identical on screen* to one with nothing to hide, so
  the rule lives in `models/AiAssistant/thread/messages.ts` and is graded in a runner — then the
  visible half was driven separately with a real rejection through the real gate. **Grade the
  invisible half; drive the visible half.**
- **Run a new spec file before writing the fix.** BLD-002's ran 18 passed / 6 failed, the six being
  exactly the files still holding the defect. The gate was proven to bite before it was trusted.
- **Turn a "a human is trusted to run this grep" acceptance line into a spec.** BLD-003 started this;
  BLD-002 extended it to a *layout* rule by reading the header block out of the `.tsx`. Guard it with
  an assertion that the block was actually found — a regex that silently matches nothing is a spec
  that passes forever.

## Driving the Build panel with no provider

The recipe is in `HANDOVER-SESSION-6.md` under *"Driving this panel"* — read it, it has six traps
that each cost real time. The three most expensive:

- ⚠️ **Install the `AiClient` hook BEFORE opening the project.** Any source edit triggers a webpack
  rebuild, and the rebuild **reloads the editor back to the launcher**, losing the project and the
  whole thread.
- ⚠️ **`cdp click` leaves the pointer hovering what it hit**, so a colour measured straight afterwards
  is the `:hover` value (7.70 vs 5.57 at rest, in session 6). Click something inert first.
- ⚠️ **`[class*=Foo]` matches `FooBar` too** — `Run` also matches `RunCaret`/`RunItems`, as `Turn`
  matched `Turns` in session 5. Count with a structural selector like `button[aria-expanded]`.

## Fixture state

`ai-test` is clean — session 6 staged two candidates and discarded both; the project holds only
`docs/` and `project.json`. The temporary `AiClient` drive hook is reverted. The dev stack is stopped.
