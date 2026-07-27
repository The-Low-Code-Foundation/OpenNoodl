# PNL-001: Panel Scroll & Box-Model Correctness

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-001 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 1 — correctness |
| **Priority** | 🔴 Critical (content is unreachable today) |
| **Difficulty** | 🟢 Easy (the diagnosis is done; the risk is the blast radius of a global `box-sizing`) |
| **Estimated Time** | 1–2 days |
| **Prerequisites** | none |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — "What's actually wrong", findings 1 and 2 |
| **Branch** | commit directly to `cline-dev` (no task branches in this repo) |
| **Recommended executor** | 🟢 **Sonnet 5** — small, well-specified CSS with one judgement call |

## Objective

Make every side panel scroll to its true last pixel, so that no panel content is unreachable at any
window height.

## Background

Reported as "a couple of panels where you can't scroll to the very bottom, it's cut off by a couple
dozen pixels — maybe because my 13 inch screen is short." It is not the screen. Two independent
defects stack, and the visible symptom of each is the same.

### Defect A — flex children squeeze instead of the container scrolling

`BasePanel`'s scroll area is a flex column (`.ChildrenContainer`, `flex-direction: column`,
`overflow-y: overlay`). Its children are `CollapsableSection` / `Section` roots, which carry
`overflow: hidden` and **no `flex-shrink: 0`**. Flex items default to `flex-shrink: 1`, so when the
content is taller than the panel the sections *shrink to fit* — the container never overflows, so it
never scrolls, and each section clips its own content behind its own `overflow: hidden`.

This is why the Appearance section's help text in Editor Settings dies at "…your running app's
appearance is unaffected" — the sentence isn't scrolled past, it's inside a box that got shorter.

### Defect B — the panel is 34px taller than the space it's given

`BasePanel .Root` is `height: 100%` + `padding: var(--spacing-panel-padding)` (16px) + `border: 1px`.
There is **no global `box-sizing: border-box`** anywhere in the editor's CSS — grep confirms only
scattered per-rule declarations in legacy stylesheets. So the root's border box is
`100% + 32px + 2px`, and `SideNavigation .Panel`'s `overflow: hidden` clips the excess. The bottom
34px of the scroll area sits below the clip.

### Why only some panels show it

Exactly four panels pass `hasContentScroll`: **App Setup**, **Project Settings**, **Editor Settings**
and **Backend Services**. Everything else either has short content or brings its own scroller, so the
two defects have nothing to bite on. That is why this reads as "a couple of panels" rather than a
systemic bug — and it is not a coincidence that all four of the panels Richard reported problems with
are on that list.

## Current State

| File | Line | Problem |
|---|---|---|
| `noodl-core-ui/.../sidebar/BasePanel/BasePanel.module.scss` | 1–18 | `.Root` `height: 100%` + 16px padding + 1px border, no `box-sizing` |
| ″ | 20–27 | `.Inner` is a flex column with no `min-height: 0` |
| ″ | 29–60 | `.ChildrenContainer` `overflow-y: overlay` (stale alias) and no `min-height: 0`; no bottom padding |
| `noodl-core-ui/.../sidebar/CollapsableSection/CollapsableSection.module.scss` | 1–8 | `.Root` `overflow: hidden`, no `flex-shrink: 0` |
| ″ | 69–71 | `.Body` `overflow: hidden overlay` |
| `noodl-core-ui/.../sidebar/Section/Section.module.scss` | — | check for the same shrink problem |
| `noodl-editor/.../views/SidePanel/SidePanel.model.scss` | 1–5 | `.PanelItem` `height: 100%` — fine, but verify against the fixed `BasePanel` |
| `noodl-core-ui/.../app/SideNavigation/SideNavigation.module.scss` | 124–136 | `.Panel` `min-height: 100%` (not `height`) + `overflow: hidden` — the clipper |

`overflow: overlay` is a **Chromium alias for `auto`** in current versions, not a distinct behaviour.
It is not causing a bug; it is stale and should be written as `auto` while you are in the file.

## Desired State

1. **`min-height: 0` on the whole flex chain** from the panel root down to the scroll container.
   A flex item's default `min-height: auto` is the other classic reason a flex scroll area overflows
   its parent instead of scrolling; fix it at the same time so the two failure modes can't recur
   independently.
2. **`flex: 0 0 auto` on every direct child of a scroll container.** Prefer expressing this once, on
   the scroll container's children (`.ChildrenContainer > *`), over patching each section component —
   a new section type added later must not be able to reintroduce the bug.
3. **`box-sizing: border-box`** so `height: 100%` plus padding means what it reads as.
4. **Bottom breathing room inside the scroll area** — 32px, so the last control is not flush against
   the panel edge when scrolled to the end.
5. **The scrollbar reaches the panel edge.** Today the 16px root padding pushes it inboard. Move the
   horizontal padding onto the content, not the scrolling ancestor, and use `scrollbar-gutter: stable`
   so content doesn't reflow when a scrollbar appears.

### The judgement call: global reset or scoped fix

A global `* { box-sizing: border-box }` is the correct end state and is what the mock uses. It is
also a change to every one of ~119 stylesheets' layout maths at once, in a codebase with substantial
legacy CSS. **Do not do it blind.**

Take the scoped fix first — `box-sizing: border-box` on the panel components this task owns — and
land that. Then, separately and reversibly, evaluate the global reset: apply it, walk the phase-23
screenshot corpus, and keep it only if the corpus is clean. If it isn't, record what broke in NOTES
and leave the scoped fix as the shipped state. **A green build proves nothing here** — this is a
visual change with no test coverage; the corpus is the evidence.

## Scope

### In scope
- The five files in the table above, plus `Section.module.scss` if it shares the defect.
- An audit pass: every registered panel, at a short window height, both themes.
- The regression gate below.

### Out of scope
- Panels that don't use `BasePanel` (15 of them) — PNL-005 moves them over. If one of them has its
  own version of this bug, **record it for PNL-005 rather than fixing it here**, so the fix lands
  with the migration and isn't done twice.
- Panel padding/spacing *design*. This task changes where padding lives, not how much there is.
- The horizontal overflow in the local-backend action row — that's PNL-004.

## Acceptance

Live-verified via the `run-editor` skill, in a window sized **1280×720** (shorter than Richard's
13-inch, deliberately), both themes:

1. **Editor Settings** — scroll to the end. The AI section's last control and the usage-log help text
   are fully visible, and the Appearance help text reads to the end of the sentence.
2. **Project Settings** and **App Setup** — same, to the last control of the last section.
3. Collapse and expand sections while scrolled; the scroll position stays sane and nothing clips.
4. Open every registered panel in turn at this window size; none has content below its reachable
   scroll extent.
5. Resize the window from 1280×720 to 1280×1200 and back with a settings panel open; no clipping in
   either direction.

**Automated gate** (this is the deliverable that stops the regression): a scripted CDP check that
opens each registered panel at a fixed short window height and asserts, for each panel's scroll
container, that the bottom of the last child is reachable — i.e. `scrollHeight - scrollTop -
clientHeight <= 1` after `scrollTo(0, scrollHeight)`, and that no descendant's `scrollHeight`
exceeds its `clientHeight` while its computed `overflow` is `hidden`. That second assertion is the
one that catches Defect A specifically, and it is worth more than the first. Wire it into the same
place the phase-23 corpus scripts live and note in NOTES how to run it.

Gates: editor `tsc` clean; `npm run test:ci` for `noodl-core-ui` and `noodl-editor` green; hex ratchet
unchanged.

## Notes for the executor

- **Reproduce before fixing.** Open Editor Settings at 1280×720 and confirm both symptoms — text
  clipped mid-sentence (A) *and* a bottom gap (B). If you only see one, the other may already have
  been fixed by another session; say which in NOTES and don't write a fix for a bug that isn't there.
- Verify the fix separately for each defect. It is entirely possible to fix B and believe you fixed A
  because the panel got 34px more room; shrink the window further until content is genuinely taller
  than the panel.
- `overflow-y: overlay` → `auto` is a cleanup, not the fix. Don't let it get credited as one.
- HMR does not reliably re-mount panel components; hard-reload the editor window between CSS changes
  or you'll be looking at the old tree.
- Commit with a pathspec limited to your files.
