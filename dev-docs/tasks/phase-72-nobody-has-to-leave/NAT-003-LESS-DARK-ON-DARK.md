# NAT-003 — Less dark on dark

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | M |
| **Surface** | `design-tokens`, `core-ui`, `editor`, `platform` |
| **Rulings** | ✅ D1 |
| **Depends on** | **NAT-001**; lands with or after **NAT-002** |

## The job

Richard: *"for the dark mode, let's make it less dark on dark, it's really depressing. Dark mode
can still look friendly and welcoming."*

The measurable half of that is the elevation ramp. `colors.css` documents its intent as
*"page < bg-0 (canvas) < bg-1 (panels) < bg-2 (cards/inputs) < bg-3 (hover/active). Steps are
deliberately distinct."* They are not:

| step | dark | light |
|---|---|---|
| `bg-0` → `bg-1` | **1.06** | 1.13 |

`#0b0e12` → `#12161b` is four points of lightness. A card does not sit *on* the canvas, it dissolves
into it, and with NAT-002's sub-AA grey on top the result is one flat near-black rectangle with
faint writing on it. That is the depression, and it is arithmetic.

Open the dark ramp so each elevation step is visible as a step, and lift the dark end off
near-black so the product reads as *dim*, not *off*.

## Acceptance criteria

1. **Every adjacent elevation step is separated by a stated minimum**, asserted in NAT-001's spec
   as its own table (surface-vs-surface, not text-vs-surface). The minimum is chosen and written
   down with its reasoning — a 1.06 that nobody had a target for is how this happened.
2. The dark canvas is lifted off near-black. `--base-color-neutral-0` (`#07090c`) and `-50`
   (`#0b0e12`) are within 4 points of pure black; the raise is deliberate and the new anchor is
   stated.
3. **Every text pair still passes 4.5:1 after the grounds move.** Raising the backgrounds spends
   contrast that NAT-002 just bought. The two tasks are measured **together** on the final palette,
   never each against its own intermediate state.
4. 🔴 **A control that is not a text pair:** borders and dividers currently readable against
   `bg-0`/`bg-1` are re-measured at 3:1. Lifting the ground can erase a border as easily as it can
   rescue a card.
5. `npm run tokens:sync` re-run, both platform token specs green.
6. The editor is driven and looked at in **dark and light**, on the canvas, a panel, a dialog and
   the launcher — the four places elevation actually stacks. The canvas is the one surface where
   node colours sit on `bg-0` and were tuned against the old value.

## Traps

- 🔴 **The node canvas is the highest-risk consumer.** Node body colours, wire colours and the grid
  were all chosen against today's `bg-0`. This task can make the graph unreadable while every spec
  stays green, because no spec knows what a wire is. Drive the canvas; do not infer it.
- 🔴 **CodeMirror carries its own theme** (`core-ui/src/components/code-editor/codemirror-theme.ts`).
  It reads some tokens and hardcodes others. A ground that moves under a syntax palette that
  doesn't is a new dark-on-dark, in the one place people read the longest.
- ⚠️ **`--theme-color-bg-1-transparent` is `rgba(0,0,0,0.8)`** — a *black* overlay, not a token that
  follows the ramp. Lifting `bg-1` while its transparent sibling stays pure black splits the two
  apart. NAT-001's gate cannot see this (it drops alpha), so it is a reading job.
- ⚠️ "Friendly and welcoming" is not a measurement and this task must not pretend otherwise. The
  arithmetic (step separation, AA, off-black anchor) is the acceptance criteria; the warmth of the
  neutral ramp is **Richard's call on a rendered screen**, and the task ships a proposal for it,
  not a decision.
