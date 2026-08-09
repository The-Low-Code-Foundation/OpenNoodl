# Phase 57 — handover after session 8 (2026-08-09)

**What ran:** **BLD-004 built, driven and closed.** With it, **D6, D7, C8 and BLD-005's R2**. The
Build panel now distinguishes a model thinking hard from a provider that has stopped answering, shows
the reasoning that was never actually being sent, and the collapsed run finally says how long it
took.

Phase 57 is **7 of 16 built** (BLD-001 ✅, BLD-002 ✅, BLD-003 ✅, **BLD-004 ✅**, BLD-005 ✅, BLD-007,
BLD-012). ⚠️ **BLD-007 and BLD-012 are still undriven**, and BLD-012's image block has still never
reached a real endpoint.

## 🔴 Concurrency — a sibling is live and was live for most of this session

- `packages/noodl-core-ui/src/components/code-editor/{JavaScriptEditor.tsx,codemirror-theme.ts}` are
  **still theirs, still uncommitted** — inherited from session 7, untouched again here.
- **Mid-session they began editing `packages/noodl-mcp/tests/fixtures/render/*.json`,
  `packages/noodl-mcp/tests/renderReportModule.test.ts` and `scripts/devtools/render-report.js`.**
  Untouched.
- Three untracked directories appeared that are not mine: `dev-docs/tasks/phase-59-logic-seam/`,
  `phase-60-values-and-signals/`, `phase-61-the-editor-teaches/`. **Left alone.**
- Every commit was pathspec-scoped; `git log` was re-read before each. **No `git add -A`, no stash.**
- ⚠️ I launched a dev stack. **`npm run dev:stop` reaps by checkout**, so check
  `ps aux | grep "[e]lectron/dist"` before stopping anything.

## ⚠️ The finding worth more than the task

> **The task's premise about `display: 'omitted'` was wrong, and the feature would have shipped
> inert rather than broken.**

The adapter requested `thinking: { type: 'adaptive', display: 'omitted' }` under a comment saying
that kept reasoning out of the response text the XML templates parse. It never did. **`display`
governs the thinking *block*; thinking has never been part of a `text` block on any setting**, and
the raw chain of thought is not returned at all. What `'omitted'` does is stream thinking blocks
whose text is **empty**.

So `onReasoning` would have been wired to a channel carrying nothing — and **every spec above it
would have passed**: the routing is correct, the isolation is correct, the callback is correct, and
nothing ever fires. A feature that is inert rather than wrong has no symptom at all.

`'summarized'` is **billed identically** (display controls visibility only, not whether the model
thinks). The isolation the task was worried about is enforced a different way: a second accumulator
(`fullReasoning`) that the returned response never reads, so a leak requires renaming a variable
rather than forgetting a branch.

**The generalisation:** when a task hands you a decision to preserve, check what the decision
actually does before building on it. A comment asserting a safety property is not the property.

## ⚠️ The two defects the drive found, and why nothing else could

Both are **the same shape as the defect BLD-004 exists to remove**, which is the part worth carrying
forward: building a fix for "a signal that outlives its subject" is an unusually good way to write
two more of them.

**1. A clock outlived what it measured.** The reasoning strip counted while `streaming` was set.
`streaming` clears when the *turn* ends — and a hung turn does not end until the deadline fires three
minutes later. A provider that thought for one second and then stopped answering displayed
**"Thinking… 3m 2s"**. Fixed with `lastAt`, moved by each delta; the label changes tense with it
("Thought for 1s"), because *"Thinking…" against a frozen number is how the same lie gets back in
through the wording after the arithmetic is fixed*.

**2. A state class collided with an animated modifier, at 1.16:1.** The heartbeat wrapper takes
`is-${state}` and the dot took `is-alive` for its animation — so an alive heartbeat inherited
`background-color: primary` and drew a solid blue bar behind the sentence.

> ⚠️ **It was found by measuring composited pixels, not by looking.** Every screenshot I had was
> taken in `waiting`, where the collision does not paint. **The bug was absent from every frame I
> captured and present the whole time.**

That is BLD-005's lesson arriving from the other side. There, a measurement contradicted a comment
written from reasoning. Here it contradicted my reading of the DOM — I traced the element's colour
and its background chain by hand, concluded "these are identical, the number must be an artefact",
and was wrong. **When a measurement and your reading of the DOM disagree, the measurement is the one
that composites.**

Re-measured after the fix, on real pixels, both themes — light binds stricter, as BLD-005 found:

| element | dark | light |
|---|---|---|
| reasoning strip | 5.57 | 5.06 |
| heartbeat "Working…" | 5.57 (was **1.16**) | 5.06 |
| silence sentence | — | 5.06 |
| run summary `2 steps — 3s` | 5.57 | 5.06 |

## What the drive measured

Two runs, **one variable**: same turn, same clock, same code path, differing only in whether pings
kept arriving.

| | keepalives only | stream killed |
|---|---|---|
| duration | **96s**, zero content | — |
| state | `alive` throughout | `alive` → `waiting` (≤2s) → `silent` (49–53s) |
| dot animation | `heartbeat-pulse` | **`none`** (read from the compositor) |
| words | "Working…" | *"No response for 53s — this turn ends by itself at 3m 0s of silence."* |

⚠️ **The consequence was verified, not just the mechanism.** That sentence makes a prediction, so the
run was left alone to see whether it came true: the turn ended by itself at **exactly 180s** with
*"The model stopped responding — nothing arrived for 180 seconds."*

**R2**, on a two-operation plan run, killing the pings mid-run: the run stayed **busy** (Stop
present) while `.Current` went `is-alive` → `is-waiting` and the dot's animation went to `none`. **A
`busy`-driven pulse would still have been animating.** That is the whole of R2.

**C8**: `2 steps — 3s` against a scripted 3000ms delay — with the plan run's own strip still reading
`2 steps` on the same screen, because `turns.ts` synthesises those from state with no per-entry
clock. Both paths visible at once is the demonstration: an unstamped producer loses a *fact*, it does
not invent one.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **92 suites, 1268 tests**, zero failures |
| `test:ci` | see the closing commit — run this session for the first time since BLD-002 |

⚠️ The +31 over session 7's 1237 is **29 new specs plus 2**: BLD-002's `it.each(FILES)` sweep
enumerates the panel directory and picked up `Heartbeat.tsx` and `ReasoningStrip.tsx` by itself. A
count that is off by a couple is not always a miscount — check whether a spec reads the filesystem.

⚠️ **BLD-012's golden request spec caught the `display` change** — a spec BLD-004 never touched,
pinning the *whole* request rather than the fields one task cared about. That is the second time this
phase that the specs *not* touched were the ones that caught something (BLD-007's defaulted
parameter was the first). Updated deliberately, with the reason written beside the byte.

## Driving this panel — additions to the recipe

Sessions 5–7 hold. Four more:

- **The `AiClient` seam needs a source line.** There is no global: add
  `(globalThis as any).__driveAiClient = AiClient;` to `AiClient.ts`, let it rebuild, then install
  everything else from `cdp eval`. Revert with `git checkout --`. (`grep __driveAiClient` returns 0.)
- ⚠️ **A fake provider that ignores `request.abortController` makes Stop look broken.** My first hook
  returned `new Promise(() => {})`; Stop did nothing, and it reads exactly like a panel defect. A
  real provider rejects on abort — the hook must too, or you will file a bug against the wrong layer.
- ⚠️ **`const` in a `cdp eval` persists across evals in the same context**, so re-running a snippet
  that declares `const b` fails with *"Identifier 'b' has already been declared"* and the click that
  follows silently targets nothing. Wrap every eval in an IIFE.
- **Check the composer button's label before clicking it.** It is Send *or* Stop depending on
  whether a turn is live, and a stalled turn from an earlier drive is still live minutes later — I
  clicked Stop believing it was Send, twice.
- **Read animations from `getComputedStyle(el).animationName`, not from the class list.** The class
  is what you asked for; the animation is what the compositor is doing.

## What to do next

1. **Drive BLD-007 and BLD-012.** Both merged, neither driven, and BLD-012 has a bill attached — its
   image block has never reached a real endpoint.
2. **BLD-006** — persistence across a restart, plus the switcher. `BuildThread`'s `header` slot is
   still deliberately free for it. ⚠️ **It now also owns R6**: the user's request renders **twice**
   in the thread (a retired turn carrying only the request, plus the live one). Visible in every
   screenshot this session; provenance predates these changes, so it is a thread-composition
   question rather than a regression.
3. **BLD-008** — ⚠️ `question` is **already** a kind on `AuthoringActivity` with its treatment built
   and its collapse rule decided. **Add the author, not a fifth opinion about how it should look.**
4. **BLD-010** now owns four open debts: BLD-003's docs route has **never been on screen**; BLD-005's
   **R5** (cost never verified against a real provider); and BLD-004's **R4** (the Ollama open-weight
   leg is inferred, not driven — no local endpoint was available) and **R5** (OpenAI-compatible
   `reasoning_content` deliberately not wired, because nothing here could verify it against a real
   endpoint and a speculative field-read is the fake pass this phase keeps paying for).

## Fixture and cleanup

`ai-test` was opened and driven; **nothing was ever accepted or applied** — every candidate was
stalled or stopped, so the fixture is unwritten. It still holds the sibling's Slider/Expression graph
from session 7. The temporary `AiClient` hook is reverted. Screenshots and the `test:ci` log are in
the session scratchpad, not the repo. No worktree created.
