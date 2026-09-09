# FLD-005 — A column of Groups does not multiply out

A single-screen dashboard rendered **5231px tall** with **zero validation errors**. The default is
defensible; the shipped vocabulary that ignores it is not.

## 1. The person sentence

**Someone stacks five rows in a column using the style recipes the product ships, and the page is
as tall as its content.**

## 2. What was reported, and what the code says

[#35](https://github.com/The-Low-Code-Foundation/NodeGX/issues/35): `Group`'s `sizeMode` defaults to
`explicit`, meaning `height: 100%` of the parent, so a column of Groups multiplies out. Measured
2026-09-09:

- `nodes/visual/group.ts:492` — `addDimensions(GroupNode)` with **no options**.
- `node-shared-port-definitions.ts:1115-1117` — the mixin's own default is `defaultSizeMode = 'explicit'`;
  `:1175-1209` — `width` and `height` both `default: 100`, `defaultUnit: '%'`.
- Confirmed on the generated artefact, not the source: `noodl-types/src/node-catalog.json` gives
  `Group.sizeMode.default = "explicit"`. **Not per-axis** — one enum governs both.
- The reporter is right that `Text` differs: `nodes/visual/text.ts:166-169` passes `contentHeight`.
- 🔴 **The recipes claim is confirmed and is the real defect.** `StyleCompositions.ts` — `band`,
  `bandSurface`, `shell`, `sectionHead`, `card`, `raised`, `ruled`, `cardBody` and `statTile` all set
  `width` and **never** `sizeMode`. Four others (`ctaBand`, `footerBand`, `testimonialCard`,
  `imageGround`) **do**, which is the precedent to follow.

🔴 **This is already an open register row with an owner, and that owner has never been built.**
`StyleCompositions.ts:484-504` names it as **V1** with a measured instance **V17** —
`ui-image-scrim-band`'s un-`sizeMode`d `shell` became `flexGrow:100` and filled its 520px band.
Phase 81 `README.md:173` and `:188` record V1 as `🔴 open`, owner **VIB-005 "The Ambush Defaults"**
(`README.md:149`), which phase 81's own handoff lists as `⬜ startable now` and which owns
**V1/V2/V14/V17/V21/V38** (`NEXT-SESSION-PROMPT.md:73`).

🔴 **So FLD-005 and VIB-005 are the same defect in two phases.** Resolve the ownership before
building — either FLD-005 closes V1/V17 and phase 81's rows are ticked, or this task is dropped and
VIB-005 is scheduled. **Do not build both.**

⚠️ **A correction to an earlier reading, recorded so it is not repeated:** REL-002a in phase 82 is
*not* the owner. Its *"Registered, not built"* section (`REL-002a-THE-AMBUSH-DEFAULTS.md:211-226`)
registers an inert `scrollEnabled` and records `clip: true` as **NOT REPRODUCED** — different rows,
both owner `NONE`. It did not close a "scroll half" of V1.

⚠️ **What could not be reproduced statically is the arithmetic.** `layout.ts:60-62` assigns both axes
under `explicit`, then `:93-101` converts a percentage height in a column parent into `flexGrow`.
Whether five siblings multiply or share depends on whether an ancestor has a definite height — i.e.
on `bodyScroll`. The **shape** is confirmed and measured at V17; **the 5231px is not ours yet.**

## 3. Scope

- 🔴 **Do not flip `defaultSizeMode` on `Group`.** It is the mixin default for **every**
  `addDimensions` caller that passes no options, it is baked into `node-catalog.json` and the
  enriched catalog, and `layoutInertCombination.ts` already reasons *from* "every visual node's width
  defaults to 100%". Changing it silently re-lays-out every existing project and every template.
- Add `sizeMode: 'contentHeight'` to the nine recipes that lack it. `imageGround`'s own comment says
  the `shell` inside it needs exactly this.
- Add a diagnostic: a Group in a column parent, with siblings, with no `sizeMode` and no `height`.
  Warning severity, per the standing convention in that file.
- **Reproduce the reporter's number first, or record that we could not.** Build the five-row column
  from the shipped recipes and measure the page height. That measurement is AC1, and it is also what
  tells us whether `bodyScroll` is in the loop.

## 4. Acceptance criteria

1. **(person)** A page built by copying `card`/`statTile`/`cardBody` verbatim into a column renders
   at content height. The **before** measurement is recorded beside the after, from the same fixture.
2. Every shipped recipe that sets `width` either sets `sizeMode` or carries a comment saying why it
   does not. A spec enumerates the recipes and asserts this — so recipe number ten cannot arrive
   without one.
3. The diagnostic fires on the five-row fixture and **does not** fire on a column whose children set
   `contentHeight`. Both arms.
4. 🔴 **A presence control on the corpus:** re-render the existing template corpus and assert no
   page's height changes except the ones the recipes were wrong on. A recipe edit that moves an
   unrelated template is a regression, not a fix.
5. Phase 81's V1 and V17 are marked closed **in phase 81's register**, and VIB-005's own file records
   which of its six rows this task took. A row that outlives its fix is how this got rediscovered at
   full price — and a row closed in one phase while its owner sits open in another is worse.

## 5. Traps

- 🔴 **A recipe edit is a data edit that reaches every project using that recipe.** Regenerate to
  `--out-dir` and diff before committing anything.
- 🔴 **V17 is one template.** A zero on one template is not a closed seam — the module that records
  V1 says so itself.
- ⚠️ Do not re-derive V1/V17 from scratch. Read phase 81's rows and REL-002a's
  *"Registered, not built"* section first; the scroll half is **already disproved** as the cause and
  re-testing it wastes a session.
- ⚠️ The 5231px is the reporter's, on their project, on 0.2.2. If our fixture gives a different
  number, report ours and say so. Do not quote theirs as if we measured it.
