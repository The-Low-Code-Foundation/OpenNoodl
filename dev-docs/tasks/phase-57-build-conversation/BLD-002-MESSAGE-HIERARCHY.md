# BLD-002 — The message hierarchy

**Status:** 📋 not started · **Track A** · after BLD-001 · closes **D4**

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
   | `tool` | 11.5px | `fg-muted` | **collapsed into a run** — see 2 |
   | `submit` | 11.5px | `fg-muted` + semantic icon | inside the run |
   | `question` | 13px | `fg-highlight` on a primary-tinted card | the loudest thing in the thread (BLD-008) |

2. **Consecutive activity collapses to one strip.** *"Read 6 node types · validated once — 14s"*,
   expandable. This is the single biggest legibility win and it is where the 20-minute build stops
   being unreadable.
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

- [ ] Screenshot of the same conversation before/after at 400px, dark **and** light.
- [ ] A run of 12 tool activities renders as one line by default and expands to 12.
- [ ] No `TextType.Secondary` remains in the Build panel (option b), **or** a full-surface contrast
      pass is attached (option a).
- [ ] Measured: every text role in the thread is ≥ 4.5:1 on the surface it sits on, in both themes.
      ⚠️ Measure on the actual background — `bg-2` and `bg-3` are not `bg-1`.
- [ ] The user message is the highest-contrast element in the turn.

## Register

| # | Finding | State |
|---|---|---|
| | | |
