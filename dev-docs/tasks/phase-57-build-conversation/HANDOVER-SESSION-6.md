# Phase 57 — handover after session 6 (2026-08-09)

**What ran:** **BLD-002 built, driven and closed. D4 is closed.** The thread has a type scale where it
had one size, activity runs collapse, and C5 is fixed — with a mechanism that turned out to be
**half wrong in the entry that filed it**, and which is a trap far bigger than the button it broke.

Phase 57 is **5 of 16 built** (BLD-001 ✅, **BLD-002 ✅**, BLD-003 ✅, BLD-007, BLD-012). ⚠️ **BLD-007
and BLD-012 are still undriven**, and BLD-012's is the one with a bill attached to getting it wrong.

## The one thing worth carrying

> **`Stack` sets `height: 100%` on every `HStack` that does not declare one**
> ([Stack.tsx:38](../../../packages/noodl-core-ui/src/components/layout/Stack/Stack.tsx#L38)).

That is C5's real cause, and BLD-003's entry — which named a stretch and said explicitly that its
numbers "do not fully close" — was right to distrust itself. In a **block** parent, `100%` resolves
against the *whole parent*, not the row's own line. The thread header is 104px because the
experimental flag above is 60px, so the row started 60px down, became 104px tall, and overflowed by
exactly 60. **The overflow equals the offset, necessarily** — which is the number the original entry
could not explain. The button's own 96px is the same declaration's second half: a 104px row with
`align-items: normal` stretches its children, so a 36px button grew to 104 − 8px of padding. One
word fixes both.

Two things generalise:

> **It is invisible whenever the row above is short.** An empty header hides this completely — the
> overflow is exactly the height of the content above. So it is not "a bug someone would have
> noticed"; it is one that appears when a *different* element grows.

> **I confirmed it by intervention before fixing it**, not by reasoning: setting `height: auto` live
> took the row from 104→44, the button from 96→**36**, and put the row's bottom at 195 — the header's
> bottom, exactly. Zero overflow. The measurement is what made the fix one line instead of a guess.

## What was measured

Driven in `ai-test` from a thread asserted empty, scripted provider, both themes, measuring each row
against **the first opaque background above it** rather than assuming `bg-1`:

| | Distinct sizes | Leading | `Secondary` vs `Default` | User message | Worst text ratio |
|---|---|---|---|---|---|
| Before (dark) | 12, 12.5 | `normal` everywhere | **both 7.70** | 7.70 — same as all | 5.57 |
| After (dark) | 11.5 / 12 / 12.5 / 13 | 16.7 / 19.5 / 20.5px | gone | **13.03 — highest** | 5.57 |
| Before (light) | 12, 12.5 | `normal` everywhere | **both 7.10** | 7.10 — same as all | 5.06 |
| After (light) | 11.5 / 12 / 12.5 / 13 | 16.7 / 19.5 / 20.5px | gone | **14.20 — highest** | 5.06 |

**Two things this settles.** `Secondary` and `Default` measured the *identical ratio* on screen, in
both themes — the ~40 alternating call sites expressed nothing, and that is now proven rather than
inferred from `colors.css`. And **nothing failed AA before the change**: README correction 1
("contrast is not the legibility problem, type scale is") is empirical now.

⚠️ **One row does fail, and it is not one this task owns.** `PrimaryButtonVariant.Ghost`'s label is
**4.33:1 in light mode** — measured at 4.33 *both before and after*, so pre-existing and untouched.
It is every Ghost button on a `bg-1` surface in the editor. Filed as **C7**, not fixed: a variant
change needs a full-surface pass.

## What is on the branch

| Commit | What |
|---|---|
| _(this session)_ | BLD-002 — five kinds, collapsed runs, C5 fixed |
| `3a5c8b58` | session 5's handover |
| `b2432761` | BLD-003 driven and closed |

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **88 suites, 1211 tests** — +25 over 1186, exactly the new spec |
| `test:ci` | **2582 specs, 6 failures** — read in session 7 on exactly this tree. The six are the inherited baseline: four `AIX-006 style vocabulary` and two `AI model registry`. Nothing new. |

⚠️ **Never `tail` a `test:ci` run you intend to read a verdict from** — redirect to a file and grep
`^Jasmine:`. ~20 minutes.

## What to do next

1. **BLD-005** — still nearly free, and now cheaper: `BuildThread` has a header row outside the
   scroll area, and this session's C5 fix means anything put in it will size correctly. ⚠️ **Declare
   a `height` on any `HStack` you add there** — there is a spec that will fail you if you don't.
2. **BLD-004** — surface `onActivity`. It also owns **C8**: the collapsed run says *"12 steps"* and
   deliberately claims **no duration**, because `AuthoringActivity` has no timestamp. Adding real
   timings means stamping activities where the three sessions push them, and then the strip can say
   how long the work took instead of only how much of it there was.
3. **Drive BLD-007 and BLD-012.** Both merged, neither driven.
4. **BLD-006** — persistence across a restart, plus the switcher.
5. **BLD-008** — `question` is already a kind on `AuthoringActivity` with its treatment built and its
   collapse rule decided (a question can never be absorbed into a run). **Add the author, not a fifth
   opinion about how it should look.**

⚠️ **Still true from session 5:** the docs route of BLD-003 has never been on screen. **BLD-010 owns
it, and it should not be assumed to work.**

## Driving this panel — additions to the recipe

Session 5's recipe holds (`AiClient.chatStream` + `isConfigured` hooked on a global, `git checkout --`
after; `stopReason` is `'tool_calls'`). Four additions:

- ⚠️ **Install the hook BEFORE opening the project.** Editing any source triggers a webpack rebuild,
  and the rebuild **reloads the editor back to the launcher** — losing the open project and the whole
  thread. Doing it in the other order costs a re-open every time.
- **A plan operation needs `intent`, not `description`.** Getting it wrong produces *"Operation op-1
  … has no intent"* and three silent retries.
- **To get a long activity run, return many read tool calls in one response** — any non-submit tool
  call becomes a `tool` activity. Twelve `get_node_type` calls is a twelve-line run.
- **To get a real failed submission, submit an invalid graph** (a node type that does not exist) and
  let the real gate reject it. Far better evidence than a hand-made activity: it proves the gate, the
  feed and the collapse rule together.
- ⚠️ **`cdp click` leaves the pointer hovering what it clicked**, so a measurement taken straight
  after reads the `:hover` colour. The run strip measured 7.70 hovered and **5.57 at rest** — click
  something else before measuring.
- ⚠️ **`[class*=BuildThread-module__Run]` also matches `RunCaret` and `RunItems`** — the same trap
  session 5 hit with `Turn`/`Turns`. Count run strips with `button[aria-expanded]`.

## A technique worth reusing

BLD-003 established "turn the human-run grep into a spec". This session extended it to a **layout**
defect, which is the harder case: C5 is invisible to `tsc`, invisible to every pure spec, and
invisible on screen whenever the row above happens to be short. The spec reads the header block out
of `AiAuthoringPanel.tsx` and asserts every `<HStack` in it declares a `height:` — so the next row
someone adds there is the one that would have reintroduced it. It is guarded by an assertion that the
block was actually found, because a regex that silently matches nothing is a spec that passes forever.

I also ran the new spec file **before** writing the fix: **18 passed, 6 failed**, the six being
exactly the six panel files still holding `TextType.Secondary`. The gate was proven to bite before it
was trusted.

## Concurrency

No sibling session was live: `ps` showed no editor at start, `git status` was clean, and `git log`
was re-checked immediately before committing. `ai-test` showed *"Edited 24 minutes ago"* on open —
**provenance established this time**, unlike session 5: 24 minutes before 14:48 is ~14:24, inside
session 5's own drive, which ended at 14:43. Every commit pathspec-scoped.

## Fixture and cleanup

`ai-test` opened, two candidates staged and both **discarded** — the project holds only `docs` and
`project.json`, nothing written. The temporary `AiClient` hook is reverted (`grep` returns 0). Dev
stack stopped (`dev:stop`, 25 processes, nothing left running). Screenshots are in the session
scratchpad, not the repo. No worktree created.
