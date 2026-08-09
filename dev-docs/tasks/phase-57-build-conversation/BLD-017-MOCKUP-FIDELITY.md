# BLD-017 — The panel does not look like the mockup it was approved from

**Status:** 📋 not started · **Track A** · after BLD-002, BLD-003, BLD-005, BLD-008 · before BLD-010

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

- [ ] Each row F1–F8 is either closed or has a written reason it was not, in the register.
- [ ] Every colour introduced is a `--theme-color-*` token; `grep -E '#[0-9a-f]{6}'` over the
      phase's SCSS returns only what was already there.
- [ ] The before/after at 400px is reproduced from the *running editor*, in both themes, and put
      beside the mockup's own before/after.
- [ ] No contrast regression: every text role measured on its new surface still clears AA. ⚠️ F1 and
      F2 both move text onto `bg-2`, which is where `fg-muted` measures **3.66:1** — the reason
      BLD-002 refused it for the activity strip. Re-measure rather than assume.
- [ ] `test:ci` and `test:main` unchanged.

## Register

| # | Finding | State |
|---|---|---|
| | | |
