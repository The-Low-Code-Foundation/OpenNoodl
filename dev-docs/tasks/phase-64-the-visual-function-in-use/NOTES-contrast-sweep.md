# NOTES — the copy and contrast sweep (lane D, 2026-08-13)

A sweep belongs to no single task, so it lives here. Two failures this register keeps finding were
looked for across every surface VFN-004, 006, 007, 008, 009, 011, 012, 013 and 014 added.

**Branch:** `vfn-h-copy`, forked from `cline-dev` at `4c7db87a`.
**Gate:** `cd packages/noodl-editor && npx jest` → **178 suites / 2650 passing**, from a baseline of
175 / 2622. `npx tsc -p tsconfig.json --noEmit` clean, and *proved to cover the changed files* by
appending `const __probe: number = "not a number"` to `BlockValueTrace.ts` and watching it go red.

---

## 🔴 Run `tsc` with `--noEmit` in this repo, always

`npx tsc -p tsconfig.json` **without** `--noEmit` emits **3096** `.js` and `.js.map` files into
`packages/*/src`, beside their sources. Jest then resolves `BenchRunner.js` in preference to
`BenchRunner.ts`, the ES-module import inside it is not transformed, and **158 of 178 suites fail to
run** — while `Tests: 246 passed` and no failures are printed, because a suite that cannot load
grades nothing. This is the register's "a run can exit having graded nothing" with a new cause, and
the artefacts are untracked, so nothing in `git status` looks alarming until you read the count.

Clean-up is `git status --porcelain | grep '^??'` filtered to `packages/.*\.(js|map)$` — never
`git clean`, which would take the new specs with it.

---

## 1. An icon host that sets `fill` sets nothing

**Result: zero in the phase's new surfaces.** The only two icon call sites this phase added —
`ProjectSettingsTab.tsx:227` and `GeneratedCodeModal.tsx:182` — both hand `IconName` to
`PrimaryButton`, which colours the glyph itself. The `fill:` declarations in
`BlocklyWorkspace.module.scss` are on `.blocklyFlyoutBackground` and `.blocklyScrollbarHandle`,
which are genuine SVG shapes and not glyphs.

🔴 **A sweep that reports an absence owes you its recall.** `scripts/devtools/icon-contrast.js` is
the authority and needs a running editor, so a source-side companion was written:
`scripts/devtools/icon-host-scan.js`, with a `--self-test` that plants one of each shape it looks
for — a stylesheet rule, a JSX prop, a `setAttribute` — and fails unless all three come back, plus
two clean cases that must **not** be flagged.

**The self-test immediately caught the scanner missing one of the three.** The icon-ish selector
test was `/(^|[^a-z])(icon|…)/i`, which does not match `.PanelIcon`, because CSS-module class names
here are PascalCase compounds and the `l` of `Panel` is a letter. That is the register's "a scanner
found one of three real sites" reproduced in miniature, found by the control rather than by reading.

Recall was then checked against **real** code, not only planted code: over `noodl-editor/src` and
`noodl-core-ui/src` the scanner reports **27 sites** (`.align-icon svg`, `DoItBalloons`' imperative
strokes, `ComponentNode.module.scss`, `MenuDialog`'s `.Icon path`, `Checkbox`'s `svg path`, …). None
of them are this phase's, most are legitimate SVG shapes, and they are not this lane's to fix —
but they are what proves the instrument can see.

⚠️ A clean scan is **not** a contrast pass. It says nobody used the property that does nothing. What
`color` resolves to where a glyph is mounted still needs `icon-contrast.js` against a live editor.

## 2. A theme token painted on a Blockly hue

**Result: one, and it is fixed.** VFN-006's save-preview outline — see
[VFN-006](./VFN-006-SHOW-ME-WHAT-I-AM-SAVING.md). Casing `--theme-color-bg-1` resolves to `#ffffff`
in the light theme and measured **2.58:1** against hue 60 and **2.72:1** against hue 55, the My
Blocks hue. Same number VFN-013 measured for `--theme-color-bg-2`, one token over.

Everything else on a block was checked and is clean or already ruled:

| surface | paint | verdict |
|---|---|---|
| `BlockValueBadges` badge fill / ink | `#0b0e12` / `#eef2f6`, no token | ✅ VFN-013 |
| `BlockValueBadges` hollow wash | `--theme-color-bg-2` at `fill-opacity: 0.62` | ⚠️ ruled by VFN-013 — it *dims* a block rather than sitting on one, and a 62% composite is outside what a token arithmetic can honestly measure. Its dashed stroke (`fg-muted`) reads against its own wash at 3.66/3.43. **Owed to the drive.** |
| `MyBlocksSaveOutline` | was `--theme-color-bg-1` / `--theme-color-primary` | 🔴 **fixed** |
| `.blocklyHtmlInput` ring | was `--theme-color-border-default` | 🔴 **fixed** — see [VFN-002](./VFN-002-THE-FIELD-YOU-CANNOT-READ.md); a separate failure (1.01:1 against its own fill) found by the same sweep |
| the rails, the strip, the toolbox, the dropdowns | chrome, not blocks | out of scope — theme tokens are correct there |

🔴 **No `--theme-color-*` tone clears 3:1 against the whole Blockly hue circle.** Dark `bg-1` is the
closest at 3.01, and it is dark-theme-only. Anything drawn on a block has to leave the theme behind;
`#0b0e12` (3.21:1 worst) is the value this phase has now standardised on, in two places.

## 3. The copy

See [VFN-011](./VFN-011-THE-BENCH.md). Six of the seven strip sentences clipped at the window's
640 px minimum; all seven fit now, gated in pixels rather than characters by a new instrument,
`scripts/devtools/text-advance.js`.

---

## What is owed to the drive

1. **A screenshot of the strip at a 640 px window.** The budget is arithmetic over the system font's
   default optical instance with no kerning — a ±5% band, held back in the budget but not proved.
2. **`icon-contrast.js` against a running editor**, in both themes, with the Logic Builder window
   open. The source scan cannot see what `color` resolves to.
3. **The field editor's ring, on a block, in both themes.** The ring's inner edge is proved at
   3.17/3.16; its outer edge is over a hue and measures 1.00.
4. **The hollow wash composite** — 62% `bg-2` over a block body is the one mark on a block that a
   token arithmetic genuinely cannot grade.
5. **That any of these rules win.** A declaration present and losing is invisible to a parser.
