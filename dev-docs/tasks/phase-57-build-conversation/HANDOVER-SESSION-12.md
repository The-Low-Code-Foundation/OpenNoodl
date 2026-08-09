# Phase 57 — handover after session 12 (2026-08-09)

**What ran:** **BLD-017 built and driven.** F1–F6 are closed and measured in a running editor in
both themes; **F7 and F8 are deliberately not built**, each with a measured reason in the register.
This is the task Richard raised — *"why does the interface still look like a CS student's winter
project"* — and it is the first task in the phase where the finding worth keeping is about **the
mockup**, not about the panel.

Phase 57 is **11 of 17 built** (BLD-001…008 ✅, 012 🟡, **017 ✅**).

## 🔴 Before you plan anything

> **The editor has a real, verified Anthropic provider. A drive costs Richard money.**

Still true, still checked in the **file**, not localStorage:

```bash
node -e "const s=require(process.env.HOME+'/Library/Application Support/NodeGX/editorSettings.json').settings;
console.log(Object.keys(s).filter(k=>/^ai\./.test(k)).join('\n'))"
```

**No provider call was made this session and nothing was billed.** How the panel was driven without
one is in "The drive" below, stated precisely, because "driven" has now meant three different things
in this phase.

## ⚠️ The findings worth more than the task

### 1. A mockup is not a contrast measurement

This task's own acceptance criterion warned that F1 and F2 move text onto `bg-2`, "which is where
`fg-muted` measures **3.66:1** — the reason BLD-002 refused it". It was pointing at the wrong
culprit. **Moving text onto bg-2 was fine. The colour the mockup put there was not.**

The mockup's `.acts` and `.runbar-line2` are `--gx-muted`, which is exactly
`--theme-color-fg-muted`: **3.66:1 dark / 3.43:1 light on bg-2**, under the 4.5:1 that binds at
11.5px. It is the same figure POL-017 moved `Text`'s Shy role off, and the same one BLD-002 cited
when it refused `fg-muted` for this exact strip — so **the approved design contains, in two places,
a colour this repo has already measured and rejected twice.**

`fg-default-shy` is used instead (**5.57 / 5.06**), which is still a step below `fg-default`, so the
hierarchy the mockup drew survives at a colour a person can read.

**The reusable version:** *copy the intent, name the token, and re-measure on the new surface.* A
mockup is evidence about arrangement, never about contrast — nobody ran a contrast checker over it,
and the one place its own stylesheet is authoritative (it says it uses our tokens verbatim) is
exactly where it happened to pick the two we had banned.

### 2. `#2c3540` is not a colour in that mockup, it is an elevation step

The mockup uses one hex for every 1px edge that is not a divider, and it sits exactly between our
two border tokens — `border-default` (#232a33) below, `border-strong` (#37404c) above. It is also
`bg-4`'s **exact** value, which is the clue.

So there is no single right mapping, and this session deliberately produced **two**:

- `.User` is a bubble **raised** off the panel ground → `border-strong`, a lift;
- `InterviewCard`'s `.Guess` is a well **recessed** into its card → `border-default`, a groove.

BLD-008 had already made the second call without stating the rule. One mapping applied to both would
have drawn one of them inside-out. It is written into `BuildThread.module.scss`'s header so it is a
recorded decision rather than two silent disagreements between neighbouring files.

⚠️ **This is the general shape of the whole task**: the mockup's raw hexes are our dark values, so
"which token" is answerable — but three of them are answerable *two* ways, and the tie is broken by
what the surface is doing, not by which hex is nearest.

### 3. The fidelity pass found a duplication the feature work had not

`OutcomeSummary` (in `BuildThread.tsx`) and `renderOutcome` (in `AiAuthoringPanel.tsx`) each held a
**character-for-character copy** of

```
Staged: {name} — {n} nodes, {m} connections. Nothing is in your project yet.
```

plural rules and two-branch tail included. Nothing was visibly wrong, because they agreed.

The mockup's `.card` has **two** text roles, so building it meant splitting that sentence — and
splitting a string that already has two authors makes **four copies of two strings**. It is now
`outcomeCard.ts`: pure, one author, with specs, read by both renderers.

**Why this keeps happening:** it is the shape `runProgress.ts`'s own header warns about and the one
BLD-007 paid for earlier in this phase. What is new is *how it was found* — not by looking for
duplication, but by a visual task needing one of the copies to change shape. **A style change is a
good detector for a duplicated string**, because it forces exactly one copy to move.

### 4. A stylesheet rule that says `normal` and renders italic

`.Toggle p { font-style: italic }` is (0,1,1). A bare `.Elapsed { font-style: normal }` in the same
file is (0,1,0), and loses. The reasoning strip's new right-aligned clock would have rendered italic
against a stylesheet that plainly says it should not.

Invisible to `tsc`, to every pure spec, and to a screenshot unless you already know to look at the
slant of a number. Nested under `.Toggle`; verified live at `fontStyle: "normal"`.

⚠️ **Third occurrence in this phase of a declaration that existed and did nothing** — after
BLD-005's undeclared state class rendering *no* class, and BLD-004's `is-highlighted` inheriting a
modifier's paint. The pattern is now specific enough to state: **in a CSS module, a class you add
alongside an existing descendant selector is probably losing to it.**

### 5. This repo has no global `box-sizing`, and the mockup relies on one

The mockup opens with `.panel * { box-sizing: border-box }`. The editor has no counterpart — every
`box-sizing` in the tree is a local declaration. So **any chip copied from that mockup that combines
`width: 100%` with padding and a border overflows its container by exactly the border and padding.**

`.Run` and `.User` declare it locally. It is the same root cause as `PrimaryButton`'s inset-shadow
ring (POL-016 chose a shadow over a border precisely because "nothing in this repo sets a global
`box-sizing`, so a 1px border would grow all 143 call sites by 2px").

## 🔴 The row that is not built, and why it is the interesting one

**F7 is where the approved mockup contradicts a measured repo rule, so it was refused.**

The mockup has three button weights and makes Discard `.btn-quiet` — **borderless**. POL-016 added
`--theme-color-border-control` because a muted button's fill measures **1.00–1.16:1 against every
surface it lands on**, and "without a ring at THIS weight it reads as a label, not a button."
Adding a borderless variant to `PrimaryButton` would reach 143 call sites to import a treatment this
repo has already measured and rejected.

⚠️ **But the gap F7 names is real and is still on screen.** The card renders Cta + Ghost + Ghost, and
our `Ghost` is *azure text on an azure border* — so two of the three decisions are identical azure
outlines and the mockup's descending ladder is gone. The mockup's own `.btn-ghost` is **neutral**
(`gx-fg` on a neutral border), which is a weight we do not have.

**So the fix is a neutral outline weight, not a borderless one** — a design-system change, and it is
now the fourth row on that list.

## The drive — stated precisely

**No provider call. Nothing billed.** Two different levels of evidence, and they are not the same:

**Really rendered by the components** — F1, F3, F5, F6 and `outcomeSentence`. A hand-written
`.nodegx/threads/*.jsonl` fixture was loaded through the real path (`ThreadSidecar.readAll` →
`ThreadStore.restore` → `BuildThread`), so these are the components' own output, measured with
`getComputedStyle` in both themes. The fixture was deleted afterwards.

⚠️ **Stylesheet-only** — F2's card and F4's track. Both need live session state (`canDecide` wants a
staged `AuthoringSession`; `RunHeader` wants a `PlanRunState`) that only a real run creates. Their
**rules** were measured against DOM synthesised with the compiled class names — every class
resolved, so no rule is missing — but that does **not** prove the components emit that DOM.
**BLD-010 must confirm both against a real run.**

⚠️ **The thread-file fixture is the cheap way to drive this panel and it is worth knowing.**
`ThreadStore.consultSavedThreads` memoises per project id, so writing the file is not enough — the
**renderer has to restart** for the read to happen again. (`cdp reload` is still forbidden; restart
the stack.)

### What was measured

Both themes, every value a token:

| | dark | light |
|---|---|---|
| `.Run` chip fill | `#181d24` bg-2 | `#f7f9fb` bg-2 |
| `.Run` border | `#232a33` border-default | `#e0e5eb` border-default |
| duration colour | `#8b95a1` fg-default-shy | `#616c79` fg-default-shy |
| `.Receipt` rule | `#3ccb7f` success | `#12915b` success |
| `.User` border | `#37404c` border-strong | `#c9d2dc` border-strong |
| `.Track` ground | `#2c3540` bg-4 | `#e2e8ef` bg-4 |
| footer band lift | `rgba(0,0,0,0)` | `rgba(0,0,0,0)` |

That last row is the one the task asked for explicitly: the mockup's `rgba(255,255,255,0.014)` is
still not copied, and is now not copied in two places.

**Swept 248 → 608px** rather than spot-checked, per B8. Horizontal overflow **0 at every width**;
buttons outside their band **0 at every width**; the footer wraps 3 rows → 2 → 1 as the panel
widens. `.Track` fills exactly 3/7 for a two-staged, one-authoring, seven-operation run.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **100 suites, 1383 tests**, zero failures (was 99 / 1365 — the delta is this task's spec file) |
| `test:ci` | **`Jasmine: 2596 specs, 6 failures (failed). Randomized with seed 39386.`** — the documented baseline, all inherited |
| raw hex in phase SCSS | 12 hits, **all inside comments** (the token maps). Zero in a declaration. |

### ✅ The `test:ci` baseline is 6, and it is now measured rather than assumed

Run with the dev stack stopped, in a clean tree bar this task's own changes:

```
Jasmine: 2596 specs, 6 failures (failed).
Randomized with seed 39386.
```

The six, in full:

- `AI model registry has exactly one default per provider that owns models`
- `AI model registry treats openai-compatible as sharing the OpenAI catalogue`
- `AIX-006 style vocabulary a style suggestion never downgrades a valid authoring…`
- `AIX-006 style vocabulary offers one advisory style pass on a valid-but-raw candidate…`
- `AIX-006 style vocabulary AIB-009 F11: a provider that stalls during the style pass…`
- `AIX-006 style vocabulary with guidance off, a raw candidate is accepted immediately…`

**None of the six is in code BLD-017 touched** — checked by import graph: no failing suite imports
`thread/`, `BuildThread`, `RunHeader`, `ReasoningStrip`, `outcomeCard`, `messages`, `runProgress` or
`AiAuthoringPanel`.

### ✅ And it answers session 11's open question

Session 11 saw 15 failures, attributed 6 to its own regression, and flagged that the other nine —
**BEN-001 ×3**, registry ×2, AIX-006 ×4 — did not match a baseline of six, so "do not treat 6 as the
baseline without re-measuring it."

Re-measured: **BEN-001 ×3 is the order-dependent part.** It did not fail at seed 39386. The stable
inherited set is the **registry ×2 + AIX-006 ×4 = 6** above, and the documented baseline was right
all along. Record the seed when this changes.

⚠️ **And a harness trap worth naming:** the first `test:ci` run exceeded the 600s tool timeout, was
moved to the background, and the completion notification reported **exit code 0 while the log ended
in `lerna ERR! npm run test:ci exited 1`**. The wrapper's exit is not the command's. **Read the log,
not the notification.**

## Concurrency

⚠️ **A sibling session started mid-way through this one.** `dev-docs/tasks/phase-17-noodl-learn/`
(five files) and an untracked `LEARN-011-THE-FREE-LESSON-ENDPOINT.md` appeared after this session's
first `git status`. They are docs-only, so this session's gates are unaffected — but **every commit
here was pathspec-scoped to its own files**, and phase-17, the phase-59/60/61 directories and the
long-inherited `packages/noodl-core-ui/src/components/code-editor/{JavaScriptEditor.tsx,
codemirror-theme.ts}` were left untouched. No `git add -A`, no `git stash`.

`codemirror-theme.ts` is now **inherited for a sixth session** and has grown (+52 lines) — it is
being actively worked on by someone.

## What to do next

1. **Drive BLD-008.** It is still the largest un-driven surface in the phase and nothing in it has
   been on screen. Session 11's six points still stand — and it is now worth doing *after* BLD-017
   rather than before, since one drive measures both.
2. **BLD-010** owns six debts now: BLD-003's docs route never on screen; BLD-004's R4 (Ollama) and
   R5 (`reasoning_content`); BLD-006's R12; **all of BLD-008**; and **BLD-017's F2 and F4**, which
   have stylesheet evidence but no live-session evidence.
3. **The design-system row is four**: `MenuDialog` end slot, `HStack` `height:100%`, `Ghost` 4.33:1
   in light, and **now a neutral outline button weight** (BLD-017 R6) — which is the same `Ghost`
   row seen from the other side, since the reason Ghost cannot be the middle weight is that it is
   azure.
4. ~~Re-measure the `test:ci` baseline.~~ **Done** — 6 at seed 39386, and BEN-001 ×3 is the
   order-dependent part. The six that remain are two real bugs to fix one day: the **AI model
   registry** still expects `gpt-4o`/`gpt-4o-mini` where the catalogue now has `gpt-4.1`, and
   **AIX-006's style pass** is not emitting `STYLE LINT`.
