# BLD-017 — The panel does not look like the mockup it was approved from

**Status:** ✅ **built and driven** (2026-08-09) — **F1–F6 closed, F7 + F8 deferred with measured
reasons** (see the register) · **Track A** · after BLD-002, BLD-003, BLD-005, BLD-008 · before
BLD-010

## Why this exists

Richard, looking at the shipped panel mid-phase-57 (2026-08-09):

> *"Why does the interface still look like a CS student's winter project? We have a mockup somewhere
> we're supposed to follow to make it look modern and beautiful."*

The mockup exists — [the approved
artifact](https://claude.ai/code/artifact/a37f0d32-b7f8-4104-97fd-2ee46a188c9f), linked from
[README.md](README.md#L19) — and **nine tasks were built against its structure without anyone
diffing its CSS against the panel's.** BLD-002 took its type scale, BLD-003 its control placement,
BLD-005 its pinned run header. Nobody took its *surfaces*.

⚠️ **This is a fidelity pass, not a redesign, and the distinction is the whole task.** The mockup
says so in its own stylesheet:

```css
/* NodeGX's own dark tokens — used verbatim inside every mockup so the
   mockups are honest about what the panel actually looks like. */
--gx-bg-1: #12161b;   --gx-primary: #4da3ff;   --gx-fg-hi: #eef2f6;   …
```

Those are `--theme-color-bg-1`, `--theme-color-primary` and `--theme-color-fg-highlight`. **There is
no new palette to adopt and no library to add.** What the mockup has and the panel does not is
*surface treatment*: chips, cards, footer bands, inset wells. That is what makes a dark panel read as
designed rather than as a stack of paragraphs, and it costs nothing but SCSS.

## The measured gap

Read from the mockup's stylesheet against the shipped modules on 2026-08-09.

| # | Mockup | Shipped | File |
|---|---|---|---|
| F1 | `.acts` — the collapsed run is a **filled chip**: `bg-2`, `1px` border, `radius 4`, `padding 6px 9px`, duration right-aligned with `margin-left:auto` | `.Run` is `background: none; border: 0;` — a bare text row, duration inside the summary string | `thread/BuildThread.module.scss` |
| F2 | `.card` / `.card-top` / `.card-acts` — the outcome is a **bordered card** whose actions sit in a footer band with a top rule and a faint lift | outcome text, then a bare `HStack` of buttons; no card, no band | `AiAuthoringPanel.tsx` `renderOutcome`, `ProjectReviewView.tsx` |
| F3 | `.receipt` — an accepted card collapses to a line with a **success-coloured left rule** | an `Icon` + `Text` row, `.Event` | `thread/BuildThread.module.scss` |
| F4 | `.runbar` — `position: sticky`, `bg-2`, a two-line header over a **3px segmented progress track** (`.track .done` / `.now`) | `RunHeader` is pinned (BLD-005 ✅) — **check whether the track exists** | `thread/RunHeader.module.scss` |
| F5 | `.think` — reasoning is italic with a **pulsing accent dot** and a right-aligned tabular clock | `ReasoningStrip` — BLD-004 built the clock and the pulse; **check the italic and the alignment** | `thread/ReasoningStrip.module.scss` |
| F6 | `.m-you` carries `border: 1px solid #2c3540` and `radius 8px 8px 2px 8px`, `max-width 88%` | `.User` has no border, `radius 10px 10px 2px 10px`, `max-width 85%` | `thread/BuildThread.module.scss` |
| F7 | `.btn-primary` / `.btn-ghost` / `.btn-quiet` — **three** button weights; Discard is `quiet` (no border) | two weights are used; Discard is a bordered `Ghost` | `AiAuthoringPanel.tsx` |
| F8 | `.chip` (pill, `radius 20px`) and `.scope-hint` (accent wash) under the composer | neither exists | `thread/BuildThread.module.scss` |

✅ **F9 — the question card is done.** BLD-008 built `.qcard` to the mockup: the accent wash over
`bg-2`, the mono eyebrow, the 560-weight question, the reason, the guess in an inset `bg-1` well with
its own mono label, and the answers in a footer band. It is the worked example for the rest of this
list — see `InterviewCard.module.scss`, whose header maps every raw hex in the mockup to the token it
stands for.

## The rule that makes this safe

> **Copy the intent; name the token. Never copy the hex.**

The mockup is dark-only. A copied `rgba(77, 163, 255, 0.13)` is an azure wash on a **white** panel in
light mode; `--theme-color-primary-bg` resolves to `rgba(21, 112, 239, 0.09)` there. Nearly every
value in the mockup has a token — the mapping is written out in `InterviewCard.module.scss`. A raw
hex in this phase's SCSS is a light-mode defect that no dark-mode screenshot will ever show.

⚠️ **One value has no token, and it appears in F2.** `.card-acts` lays
`rgba(255, 255, 255, 0.014)` over the footer band. White is a *lift* on a dark card and a **no-op**
on a light one, so copying it imports a treatment that exists in one theme only. BLD-008 dropped it
and let the top rule carry the band. If the lift is wanted, it needs a token in `colors.css` with a
light value that means the same thing — which is a design-system change, not a fidelity fix.

## Build

1. **Diff before you edit.** For each mocked state, put the mockup's rule beside the shipped rule and
   write down the difference. The table above is that work for eight of them; it is not exhaustive
   and it was read, not driven.
2. **F1 and F2 first** — they are the two the eye actually lands on, they are the mockup's own
   "biggest legibility win", and F2 is what makes a decision read as a card rather than as a
   paragraph with buttons after it.
3. **One SCSS module per surface**, no new components. Every gap above is a stylesheet change; if a
   fix needs a component, stop and ask whether the mockup really said that.
4. **Both themes, every change.** See the rule above.

## Acceptance

- [x] Each row F1–F8 is either closed or has a written reason it was not, in the register.
      **F1–F6 closed; F7 and F8 deferred**, reasons in R6 and R7.
- [x] Every colour introduced is a `--theme-color-*` token. `grep -E '#[0-9a-f]{6}'` over
      `AiAuthoringPanel/**/*.scss` returns **12 hits, all inside comments** — the token maps in
      `BuildThread.module.scss` and `InterviewCard.module.scss`. Zero in a declaration.
- [x] Reproduced from the **running editor**, in both themes, and swept 248→608px rather than
      spot-checked. See "How it was driven" below for what was and was not a live session.
- [x] No contrast regression — every role re-measured on its new surface, and the warning in this
      criterion turned out to be about the **mockup**, not about us (R1).
- [x] `test:main` **100 suites / 1383 tests**, zero failures (was 99 / 1365 — the delta is this
      task's new spec file). `typecheck:editor` and `typecheck:editor-tests` clean.
      `test:ci` **`2596 specs, 6 failures`, seed 39386** — the documented baseline exactly, all six
      inherited (AI model registry ×2, AIX-006 style vocabulary ×4), none in a suite that imports
      any module this task touched.

## How it was driven

⚠️ **Stated precisely, because "driven" has meant three different things in this phase.**

**No provider call was made and nothing was billed.** The thread was rendered from a hand-written
`.nodegx/threads/*.jsonl` fixture — a real load through `ThreadSidecar.readAll` → `ThreadStore` →
`BuildThread`, so **F1, F3, F5, F6 and `outcomeSentence` were measured on the components' own
output**. The fixture was deleted afterwards.

⚠️ **F2's card and F4's track were NOT.** Both need live session state — `canDecide` wants a staged
`AuthoringSession`, `RunHeader` wants a `PlanRunState` — which only a real run creates. Their
**stylesheets** were measured against DOM synthesised with the compiled class names (every one
resolved, so no rule is missing), at both themes and across the width sweep. That verifies the CSS,
which is what this task changed; it does **not** verify that the components emit that DOM, beyond
`tsc` and the structure being three nested `div`s. **BLD-010 must confirm both against a real run.**

## Register

| # | Finding | State |
|---|---|---|
| R1 | ⚠️ **The mockup's own colour for `.acts` and `.runbar-line2` fails AA, and this task's acceptance criterion was pointing at the wrong culprit.** Both are `--gx-muted`, which is `--theme-color-fg-muted` — **3.66:1 dark / 3.43:1 light on bg-2**, under the 4.5:1 that binds at 11.5px. It is the same figure POL-017 moved `Text`'s Shy role off and the same one BLD-002 cited when it refused `fg-muted` for this exact strip. Moving text onto bg-2 was safe; *the colour the mockup put there* was not. `fg-default-shy` used instead (**5.57 / 5.06**). **A mockup is not a contrast measurement.** | Closed — F1, F4 |
| R2 | **`#232a33` is `--theme-color-border-default`'s dark value, verbatim.** The mockup's hairline hex is our token exactly, which is the strongest evidence yet that it really was drawn from our palette and not eyeballed. Every rule in F1/F2/F4 uses the token. | Closed |
| R3 | ⚠️ **`#2c3540` has no single right token, and two neighbouring files now map it two ways on purpose.** It sits exactly between `border-default` (#232a33) and `border-strong` (#37404c), and is `bg-4`'s exact value — the clue that in the mockup it is not a colour but *the next step of the elevation ladder*. A **raised** edge (`.User`) takes `border-strong`; a **recessed** one (`InterviewCard`'s `.Guess`) takes `border-default`. One mapping would have drawn one of them inside-out. Written into `BuildThread.module.scss`'s header so it is a recorded decision rather than two silent disagreements. | Closed |
| R4 | ⚠️ **This repo has no global `box-sizing`, and the mockup relies on one.** The mockup opens with `.panel * { box-sizing: border-box }`; the editor has no counterpart — every `box-sizing` in the tree is a local declaration. So any chip copied from it that combines `width: 100%` with padding and a border overflows its container by exactly the border and padding. `.Run` and `.User` declare it locally. Same root cause as PrimaryButton's inset-shadow ring (POL-016), one panel over. | Closed |
| R5 | ⚠️ **The staged-outcome sentence already had two authors before this task touched it.** `OutcomeSummary` and `renderOutcome` each held a character-for-character copy, plural rules and two-branch tail included. Splitting it into the mockup's title and sub would have made **four copies of two strings**. It is now `outcomeCard.ts`, pure, with specs — the shape `runProgress.ts`'s header warns about and BLD-007 already paid for in this phase. **The fidelity pass found a duplication the feature work did not.** | Closed |
| R6 | ⚠️ **F7 is the row where the mockup contradicts a measured repo rule, so it is NOT built.** `.btn-quiet` is borderless, and POL-016 added `--theme-color-border-control` *because* a button whose fill measures 1.00–1.16:1 against every surface it lands on "reads as a label, not a button" without a ring at that weight. Adding a borderless variant to `PrimaryButton` would reach 143 call sites to import a treatment this repo has already measured and rejected. **The gap is real** — the card currently renders Cta + Ghost + Ghost, so two of the three decisions are identical azure outlines, and the mockup's descending ladder is lost. The fix is a *neutral* outline weight (the mockup's `.btn-ghost` is `gx-fg` on a neutral border; ours is azure on azure), which is a design-system change, not a stylesheet one. | ⛔ Deferred → design-system row |
| R7 | **F8 is new content, not fidelity.** `.chip` ("Preview open ↗") and `.scope-hint` ("◈ this component") are not restyled versions of anything shipped — they are two new indicators, and deciding *what* they say is a feature decision. The preview-open state is already spoken for by BLD-003's `ON_CANVAS_NOTE`, so a chip would be a second voice on it; the scope hint belongs with BLD-011/BLD-016's composer work, and BLD-012's chip is already blocked on BLD-011. | ⛔ Deferred → BLD-011 |
| R8 | ⚠️ **`.Toggle p` (0,1,1) beats a bare `.Elapsed` (0,1,0), in the same stylesheet.** The reasoning clock's `font-style: normal` was silently losing to the strip's italic — a rule that plainly says `normal` rendering italic. Invisible to `tsc`, to every spec, and to a screenshot unless you know to look at the slant of a number. Nested under `.Toggle`; verified live at `fontStyle: "normal"`. Third occurrence in this phase of a declaration that existed and did nothing. | Closed |
| R9 | **The footer band wraps rather than overflowing, at every width from 248px to 608px.** Swept: `buttonsOutsideBand` is 0 throughout and the row count goes 3 → 2 → 1 as the panel widens; horizontal overflow is 0 at every step. B8's lesson (a spot-check at the default proves nothing about the range) applied rather than cited. | Closed |
| R10 | **The mockup's `rgba(255, 255, 255, 0.014)` lift on `.card-acts` is still not copied**, and is now not copied in two places. Verified live: the band's computed `backgroundColor` is `rgba(0, 0, 0, 0)` in both themes. It remains the only value in the mockup with no token behind it. | Closed — as specced |
