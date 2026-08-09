# Next-session prompt — phase 57, after session 7

Paste everything below into a fresh session.

---

You are picking up **phase 57 (BLD — the Build panel as a conversation)** on `cline-dev` in
`/Users/richardosborne/vscode_projects/OpenNoodl`.

Read `dev-docs/tasks/phase-57-build-conversation/HANDOVER-SESSION-7.md` first, then `TASKS.md`.

## 🔴 Do these checks before anything else

1. **`git status` and `git log` — a sibling session was live through session 7 and may still be.**
   Two files under `packages/noodl-core-ui/src/components/code-editor/` were left modified and
   **they are not yours**. If the tree still holds them, leave them; if new commits you did not make
   are on the branch, a sibling is working now. **Pathspec-scope every commit; never `git add -A`;
   never `git stash`.**
2. **`ps aux | grep "[e]lectron/dist"` before you launch or stop anything.** ⚠️ `npm run dev:stop`
   reaps by *checkout*, and a sibling shares this one — session 7 killed their editor with it. If
   something is running that you did not start, **ask Richard before stopping it**.
3. **`ai-test`'s `project.json` is dirty and that is correct.** It holds the sibling's
   Slider → Expression → opacity test graph. **Do not "clean" the fixture.** A dirty test project is
   evidence about someone else, not litter — read the repo's `git log` before deciding otherwise.
   (Session 7 got this wrong, reverted their graph, and had to restore it from a backup.)
4. **`test:ci` has not been run since BLD-002.** Session 6's tree measured **2582 specs, 6 failures**
   — the inherited four `AIX-006 style vocabulary` plus two `AI model registry`. BLD-005 landed
   after that, so the number is unverified on the current tree. ~20 minutes. ⚠️ **Redirect to a file
   and `grep -E "^Jasmine:"`; never `tail` it.** The `FAILED:` list prints *after* the verdict line.

## Where the phase is

**6 of 16 built.** BLD-001 ✅, BLD-002 ✅, BLD-003 ✅, BLD-005 ✅ (all driven and closed — D1, D2, D3,
D4, correction 2). BLD-007 and BLD-012 merged but ⚠️ **neither has ever been driven**, and BLD-012's
image block has never reached a real endpoint — the one with a bill attached to getting it wrong.

## What to work on

Unless Richard says otherwise:

1. **BLD-004** — and it is now a *pair* of filed items with the same shape, which is why it is first.
   - **C8**: the collapsed activity run says *"12 steps"* and deliberately claims **no duration**,
     because `AuthoringActivity` carries no timestamp. Stamping activities where the three sessions
     push them is what closes it.
   - **R2**: the current operation in the run map has accent and weight and **deliberately no
     motion**. ⚠️ Do not "fix" this with a CSS animation on `busy` — `busy` stays true when the
     provider has hung, so that pulse animates hardest exactly when nothing is happening, which is
     the failure correction 2 exists to fix. It needs a real `onActivity` heartbeat.
     `thread/RunHeader.module.scss` already says where the motion belongs.
2. **Drive BLD-007 and BLD-012.**
3. **BLD-006** — persistence across a restart, plus the switcher. `BuildThread`'s `header` slot was
   deliberately left free for it; BLD-005 took a **separate** `runHeader` slot so the two would not
   fight over one node.
4. **BLD-008** — ⚠️ `question` is **already** a kind on `AuthoringActivity`, with its treatment built
   and its collapse rule decided (a question can never be absorbed into a run). **Add the author, not
   a fifth opinion about how it should look.**
5. **BLD-010** owns two open debts: the docs route of BLD-003 has **never been on screen**, and
   BLD-005's **R5** — cost has never been verified against a real provider, because the scripted
   drive hook returns fixed `usage` and every dollar figure so far is an artefact of it.

## The two traps session 7 found, both bigger than the bugs they caused

> **There is no `opacity` value that both reads as dimmed and clears AA in both themes.**

Measured on real composited pixels, `fg-default` on a panel surface:

| opacity | 0.55 | 0.65 | 0.70 | 0.75 | 0.80 | 0.85 |
|---|---|---|---|---|---|---|
| **dark** | 3.27 ❌ | 4.03 ❌ | 4.46 ❌ | 4.92 ✅ | 5.41 ✅ | 5.93 ✅ |
| **light** | 2.53 ❌ | 3.10 ❌ | 3.46 ❌ | 3.87 ❌ | 4.34 ❌ | 4.89 ✅ |

Everything that reads as dimmed fails AA in light; the first value passing both (0.85) is too subtle
to read as dimming. **Light mode binds ~0.1 stricter than dark**, so a dark-only check ships a
failure. And opacity moves contrast **without appearing in any colour token** — `tsc`, every pure
spec and a screenshot all pass. Use `fg-default-shy` (5.57 dark / 5.06 light) and let an icon carry
the rest. ⚠️ `fg-muted` fails AA on all three surfaces; non-text affordances only.

> **A CSS-module lookup for a class the stylesheet does not define returns `undefined`, so the
> element renders with NO class at all.**

A five-row run map reported **four** roles the moment one row changed state. The row was fine — it
had become *unmeasurable*. When a class encodes **state**, declare every value, even the empty ones.
If a drive's element count drops as state advances, suspect this before suspecting the render.

## Driving the Build panel with no provider

The recipe is in `HANDOVER-SESSION-7.md` (and sessions 5 and 6). The four that cost session 7 real
time:

- ⚠️ **Install the `AiClient` hook BEFORE opening the project** — a source edit rebuilds and reloads.
- ⚠️ **`!counter` is true when the counter is `0`.** A drive hook keyed on `!__driveRead` looped on
  context reads forever and **Stop could not land**, because cancel is checked between provider calls
  and the hook kept supplying them. Initialise drive counters to `-1`.
- ⚠️ **An occluded window clamps the run clock** — elapsed froze at 6s then jumped to 47s. Take a
  **screenshot each poll**; it forces a frame.
- **A bare `Group` fails the gate for a `Pages/*` target but stages fine as `Ui/*`.** If every
  operation reports *"could not produce a valid component within its budget"*, that is the target
  kind, not the graph.

## The habit that paid off most

**Sweep the parameter instead of picking one.** The opacity defect was not found by reading the value
or by spot-checking one theme — it was found by asking the running app for the ratio at nine
opacities in both themes in a single `eval` and reading a table. A sweep costs the same as a spot
check and answers *"is there a good value at all"*, which turned out to be the real question, with
the answer "no".

Corollary, twice-earned now: **the comment written from reasoning was wrong and the measurement one
line away was right.** Write the sweep before the justification.
