# BLD-002 — The message hierarchy

**Status:** ✅ **built, driven and closed** (2026-08-09) · **Track A** · after BLD-001 · closes **D4**

## What the drive measured

Driven in `ai-test` with a scripted provider, from a thread asserted empty first. Every row in the
thread, on the surface it actually sits on, before and after:

| | Distinct sizes | Leading | `Secondary` vs `Default` | User message | Worst text ratio |
|---|---|---|---|---|---|
| **Before** (dark) | 12px, 12.5px | `normal` everywhere | **both 7.70** — identical | 7.70, same as everything | 5.57 |
| **After** (dark) | 11.5 / 12 / 12.5 / 13px | 16.7 / 19.5 / 20.5px | `Secondary` gone | **13.03 — the highest** | 5.57 |
| **Before** (light) | 12px, 12.5px | `normal` everywhere | **both 7.10** — identical | 7.10, same as everything | 5.06 |
| **After** (light) | 11.5 / 12 / 12.5 / 13px | 16.7 / 19.5 / 20.5px | `Secondary` gone | **14.20 — the highest** | 5.06 |

**The premise is confirmed on screen, not just in `colors.css`:** `is-type-secondary` and
`is-type-default` measured the *identical ratio* in both themes, so the ~40 call sites alternating
between them expressed nothing. And no text role failed AA before the change — README correction 1
holds empirically. **The defect was type scale, exactly as stated.**

A run of **12** tool activities renders as **one line** ("12 steps") and expands to **12**. Driven,
not asserted.

## The rule that got both a spec and a drive

A **failed** submission is never absorbed into a run — **specced** in
[`tests-unit/bld-002`](../../../packages/noodl-editor/tests-unit/bld-002/messages.test.ts) *and*
driven with a real rejection (an invalid node type, through the real gate): the feed shows `12 steps`
collapsed, then *"Submitted — rejected with 1 problem. Repairing…"* and the full `unknown-node-type`
error line **at full size**, then the repair.

It needed both, and the reason generalises. **A run that had swallowed the failure would look
identical on screen to one with nothing to hide** — there is nothing for a screenshot or a reviewer
to notice, which is why the rule is graded in a runner. But the runner cannot prove the real gate
produces the activity in the first place, which is why it was also driven. *Grade the invisible half;
drive the visible half.*

## ⚠️ Read this before touching a colour

**The dark-mode text is not a contrast problem.** Measured, on each surface the thread actually uses:

| Token | Hex | on `bg-1` `#12161b` | on `bg-2` `#181d24` | on `bg-3` `#222933` |
|---|---|---|---|---|
| `fg-highlight` | `#eef2f6` | 16.14 | 15.05 | 13.03 |
| `fg-default` | `#a6b0bb` | **8.26** ✅ | 7.70 ✅ | 6.66 ✅ |
| `fg-default-shy` | `#8b95a1` | **5.98** ✅ | 5.57 ✅ | 4.82 ✅ |
| `fg-muted` | `#6b7682` | 3.93 ❌ | 3.66 ❌ | 3.17 ❌ |

Every token the panel uses clears AA on every surface it sits on. (`fg-default-shy` on `bg-1` = 5.98
is POL-017's own figure, independently reproduced — the arithmetic is right.)

**Brightening anything makes this worse**, because it removes the last distinction the feed has. The
defect is that nothing has a *size*, and that two roles are the same colour.

⚠️ **`fg-muted` fails AA on all three surfaces** — this is exactly what POL-017 found when it moved
`Text`'s Shy role off `fg-muted`. This task proposes `fg-muted` for the collapsed activity strip
(11.5px). **That is below AA and must not ship as-is**: use `fg-default-shy` for activity text and
reserve `fg-muted` for non-text affordances (rules, glyph outlines, disabled states). If a dimmer
text role is genuinely wanted, that is a token change and belongs in a UIX task with its own
full-surface pass — see step 3.

## The defect, measured

1. **Everything is 12px.** `Text` renders `.is-size-default { font-size: 12px }`
   ([Text.module.scss](../../../packages/noodl-core-ui/src/components/typography/Text/Text.module.scss))
   with no line-height rule at all — leading is inherited. The feed is a wall.
2. **`TextType.Secondary` and `TextType.Default` are the identical hex.**
   `--theme-color-fg-default: neutral-800` ([colors.css:277](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css#L277))
   and `--theme-color-secondary-as-fg: neutral-800` ([:299](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css#L299)).
   **The same collision exists in light mode** ([:506](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css#L506)
   and [:521](../../../packages/noodl-core-ui/src/styles/custom-properties/colors.css#L521), both `#4a5663`).
   The panel alternates between the two across ~40 call sites believing they express a hierarchy.
3. **The user's own message reads as subordinate.** `.User` is a left-bordered box on `bg-2`
   ([AiAuthoringPanel.module.scss:1-6](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.module.scss#L1))
   — the visual language of a *quote*. It is the thing you scroll to find; it should be the
   strongest element in the thread.
4. **Tool activity has the same weight as prose.** During a seven-operation project build the thread
   is hundreds of lines of "Read node documentation", at the same size and nearly the same colour as
   the sentences that matter.

## Build

1. **Five kinds, five treatments.** Extend `AuthoringActivity` from four to five (`question` is
   added by BLD-008; reserve the shape here).

   | Kind | Size | Colour | Treatment |
   |---|---|---|---|
   | `user` | 13px | `fg-highlight` | right-aligned bubble on `bg-3`. Not a quote |
   | `assistant` | 13px / lh 1.58 | `fg-default` | prose, with a small mono `ASSISTANT` label |
   | `tool` | 11.5px | ~~`fg-muted`~~ **`fg-default-shy`** | **collapsed into a run** — see 2 |
   | `submit` | 11.5px | ~~`fg-muted`~~ **`fg-default`** + semantic icon | inside the run |
   | `question` | 13px | `fg-highlight` on a primary-tinted card | the loudest thing in the thread (BLD-008) |

   **As built**, with two deviations. `fg-muted` was **not** used — this task's own warning above says
   it fails AA at 11.5px, and the measured result confirms the substitution lands at 5.57 dark / 5.06
   light instead of 3.93. And the `ASSISTANT` label is rendered **once per turn, not once per
   paragraph**: the alignment already says who is speaking now that the request is a bubble on the
   right, so a repeated label would cost a line per message to restate what the layout has said, at
   the width where lines are scarcest. `question` is reserved on `AuthoringActivity` and given its
   treatment here; **BLD-008 adds the author, not a fifth opinion about how it looks**.

2. **Consecutive activity collapses to one strip.** *"Read 6 node types · validated once — 14s"*,
   expandable. This is the single biggest legibility win and it is where the 20-minute build stops
   being unreadable.

   **As built:** `collapseActivities` / `summariseRun` in
   [`thread/messages.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/thread/messages.ts),
   pure and specced, with the component rendering only what it returns. Three deviations, each with a
   reason: a **failed** submission never collapses (it is the signal, not the noise); the summary is
   counts only, *"12 steps · validated once"*, with **no duration** (C8); and a lone activity is not
   given a disclosure, since one line of information replaced by one line of no information plus a
   click is a loss (`MIN_RUN_LENGTH = 2`).
3. **Decide `Secondary` vs `Default`.** Two options, pick one and do it properly:
   - **(a)** Give `secondary-as-fg` a genuinely different value and audit what else uses it, or
   - **(b) (recommended)** Stop using `TextType.Secondary` in this panel and let size carry the
     hierarchy, leaving the token alone.
   ⚠️ `secondary-as-fg` is used well outside this panel. **Option (a) is a design-system change and
   needs its own contrast pass across every surface that uses it** — do not do it casually inside a
   panel task. If (a) is chosen, it becomes a UIX task, not this one.
4. **Set leading explicitly** on prose. Inheriting line-height into a 13px paragraph inside a 12px
   panel is how the wall happened.

## Acceptance

- [x] Screenshot of the same conversation before/after at 400px, dark **and** light.
- [x] A run of 12 tool activities renders as one line by default and expands to 12. **Driven.**
- [x] No `TextType.Secondary` remains in the Build panel (option b) — 37 sites across 6 files, and a
      spec that reads all 8 panel `.tsx` files keeps it that way.
- [x] Measured: every text role in the thread is ≥ 4.5:1 on the surface it sits on, in both themes.
      Measured on the actual painted background by walking up for the first opaque one. Worst text
      role: **5.57 dark, 5.06 light**. ⚠️ **One exception, and it is not a text role this task
      introduced or owns** — see C7.
- [x] The user message is the highest-contrast element in the turn (13.03 dark / 14.20 light, against
      7.70 / 7.10 for everything else in the turn).

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **88 suites, 1211 tests** — +25 over 1186, exactly the new spec file |
| `test:ci` | **2582 specs, 6 failures** — the inherited baseline (four `AIX-006 style vocabulary`, two `AI model registry`). Read from the log with `grep -E "^Jasmine:"`; ⚠️ the FAILED list prints *after* the verdict line, so read the whole block, not a fixed offset. |

## Register

| # | Finding | State |
|---|---|---|
| **C5** | ✅ **The override button's 96px box painted 52px over the first turn — and the mechanism in BLD-003's entry was a hypothesis that was half wrong.** Re-measured live rather than trusted. The cause is **[`Stack.tsx:38`](../../../packages/noodl-core-ui/src/components/layout/Stack/Stack.tsx#L38): every `HStack` that does not declare a height gets `height: 100%`.** These rows sit in a **block** container, so `100%` resolved against the *whole header* (104px) instead of the row's own line (44px) — and the header is 104px precisely because the experimental flag above is 60px. So the row started 60px down, was 104px tall, and overflowed by exactly the flag's height; `overflow: visible` painted the excess over the thread. The button's own 96px is the second half: a 104px row with `align-items: normal` stretches its children, so a 36px button grew to 104 − 8px padding. **Both halves come from the one declaration.** Confirmed by intervention before fixing: `height: auto` → row 44px, button **36px**, row bottom 195 = header bottom exactly, zero overflow. | **fixed** — `height: 'auto'` on both header rows, plus a spec that reads the header block |
| **C6** | ⚠️ **The `height: 100%` above is a trap at every `HStack` inside a block parent, not a defect of this panel.** It bites whenever the parent is taller than the row — and it is *invisible whenever the parent is not*, so an empty header hides it completely. Two of this panel's four `HStack`s were affected; the other two sit inside `VStack`s and are fine. **Not fixed here:** changing `Stack` reaches several hundred call sites in every panel of the editor and needs its own visual pass. | **filed — a UIX task**. Blocker named: it is a design-system change, not a panel change |
| **C7** | ⚠️ **`PrimaryButtonVariant.Ghost`'s label measures 4.33:1 in light mode — below AA.** Found by measuring, not by reading; `Ghost` paints `--theme-color-primary` on a transparent background, so this is every Ghost button on a `bg-1` surface in the editor, in light mode. **Measured 4.33 both before and after this task** — it is pre-existing and unchanged by it. Not fixed here for the same reason as C6, and for the reason this task's own step 3 gives: a token/variant change needs a full-surface contrast pass and is a UIX task. | **filed — a UIX task**, with the measurement |
| **C8** | ⚠️ **The task's example strip claims a duration (*"— 14s"*) the model cannot support.** `AuthoringActivity` carries no timestamp and neither does `Turn`, so any duration would be invented at render time from when React happened to mount — which is not how long the work took. The summary is counts only, and a spec asserts it never prints a time unit. Real timings mean stamping activities where the three sessions push them. | **not built, deliberately** — rule 5. Filed for BLD-004, which owns the heartbeat |
| **C9** | ℹ️ **The plan run's per-operation feed is deliberately *not* collapsed.** It looked like the biggest win — a seven-operation build is where the wall is — but AIB-002 already folds each operation's feed behind its own *"Show activity (N)"*, so a run inside it would be a disclosure inside a disclosure, opened by someone who has just asked to see everything. Collapsing applies to the thread's own turn feed, which had no disclosure at all. | **decided, not a defect** |
