# NAT-001 — The contrast floor the editor never had

| Field | Value |
|---|---|
| **Tier** | 0 |
| **Effort** | S/M |
| **Surface** | `core-ui`, `tests-unit` |
| **Rulings** | none — but it is the instrument D9 is decided with |
| **Depends on** | nothing — **do this first.** NAT-002 and NAT-003 change the palette and are unmeasurable without it |

## The job

`nodegx-community` has a palette gate. The editor does not.

`tests/uni013-contrast.test.ts` on the platform asserts ~30 named fg×bg pairs at 4.5:1 (3:1 for
non-text), in **both** themes, resolved out of the vendored `colors.css`. It was written because
the site had shipped sub-AA secondary copy on the lede of every page and two screenshots had said
it was fine.

The editor has the *parts* — [`tests-unit/support/themeTokens.ts`](../../../packages/noodl-editor/tests-unit/support/themeTokens.ts)
already resolves tokens from the canonical file and computes WCAG ratios — but only three narrow
specs use it (`vfn-013/badge-contrast`, `fix-005/dropdown-contrast`, `vfn-006/save-outline-contrast`),
each about one component. Nothing asserts a floor across the design system, which is exactly how
`--theme-color-fg-muted` sits at **3.93 dark / 3.62 light** while being the default secondary text
colour of the launcher.

Build the editor's equivalent: one spec, one PAIRS table, both themes, the pairs the product
actually renders.

## Acceptance criteria

1. A spec asserts every pair in a declared PAIRS table at its stated minimum, **for `dark` and
   `light` independently** — a pair that passes in one theme and fails in the other fails the spec.
2. Each row states its bar and *why*: 4.5 for words at normal size, 3.0 for non-text and large
   text. 🔴 The bar is **stated per row, never defaulted** — the site's spec learned this when three
   rows that looked like chrome turned out to be words ("19h", an accepted label).
3. **Control (known-broken input):** a deliberately bad pair added to the table **fails**, and a
   pair naming a token that does not exist **fails distinctly** rather than passing as `undefined`.
   Both are asserted. A gate that cannot reject a wrong answer has measured nothing.
4. The table covers, at minimum, every pair the community surfaces render — the launcher tab, the
   rail panel, `AskAboutNodeDialog` — plus the editor's own body/heading/link/disabled defaults.
5. The spec is registered in whatever barrel its runner requires and is **observed failing once**
   before the palette is fixed, with the failing ratios quoted in this file. 🔴 A gate added
   *after* the fix proves nothing; see the standing lesson about measuring after a fix.

## Traps

- 🔴 **`themeTokens.ts` drops alpha rather than compositing it** (its own header says so). A
  translucent token measured against an unknown parent is a made-up number. A PAIRS row whose
  background is translucent must name the **opaque surface underneath** — copy the site spec's
  `over` field rather than reinventing it.
- 🔴 **This is a second pipeline for a check that already exists on the platform.** Before writing
  it, confirm what it is *for*: the site gate reads the **vendored copy**, this one reads the
  **canonical source**. They will agree until someone edits the vendored copy by hand — which is
  the thing UNI-013's drift test exists to catch. Say this in the file's header, or the next reader
  deletes one of them as a duplicate.
- ⚠️ **`resolveToken` follows `var()` up to 20 deep and returns the literal on failure.** A typo'd
  token name resolves to the string `var(--typo)`, `parseColor` returns `null`, and a careless
  assertion skips the row. AC3 exists for this.
- ⚠️ This spec cannot see anything decided at paint time, anything overridden outside `colors.css`,
  or whether the element is painted at all. `scripts/devtools/icon-contrast.js` remains the
  authority for rendered pixels. Do not let a green spec close a *drive*-shaped question.

---

## Built — 2026-08-19

**The spec:** [`packages/noodl-editor/tests-unit/nat-001/palette-contrast.spec.ts`](../../../packages/noodl-editor/tests-unit/nat-001/palette-contrast.spec.ts)
— 36 pairs × 2 themes, plus six control tests. Runs under `npm run test:main` (jest matches
`tests-unit/**` by path, so **AC5's "registered in whatever barrel its runner requires" is a
no-op here** — unlike the jasmine suite, this runner needs no barrel export).

**Support added:** `parseColorAlpha`, `composite` and `toHex` in
[`tests-unit/support/themeTokens.ts`](../../../packages/noodl-editor/tests-unit/support/themeTokens.ts).
`parseColor` is left exactly as it was — three specs depend on its behaviour and its header
already states that it drops alpha. The new functions are what make an `over` row gradeable
instead of guessed.

### AC5 — observed failing, on the unmodified palette

```
Tests: 22 failed, 69 passed, 91 total
```

🔴 **Not one hex value had been changed when this was taken.** All six controls passed, so the
22 are the palette, not the instrument.

| # | pair | dark | light | bar |
|---|---|---|---|---|
| 1 | launcher tab body copy (`fg-muted` on `bg-0`) | **4.18** ✗ | **3.19** ✗ | 4.5 |
| 2 | launcher Refresh label (same tokens, separate declaration) | **4.18** ✗ | **3.19** ✗ | 4.5 |
| 3 | launcher "Try again" (`primary` on `bg-0`) | 7.37 ✓ | **4.03** ✗ | 4.5 |
| 4 | launcher button border (`bg-3` on `bg-0`) | **1.32** ✗ | **1.01** ✗ | 3 |
| 5 | selected row label (`primary` on `primary-bg` over `bg-3`) | **4.48** ✗ | **3.56** ✗ | 4.5 |
| 6 | composer Shy copy (`fg-default-shy` on `bg-4`) | **4.09** ✗ | **4.33** ✗ | 4.5 |
| 7 | composer sign-in error (`danger` on `bg-4`) | **4.46** ✗ | **3.92** ✗ | 4.5 |
| 8 | `fg-muted` on `bg-1` | **3.93** ✗ | **3.62** ✗ | 4.5 |
| 9 | `fg-muted` on `bg-2` | **3.66** ✗ | **3.43** ✗ | 4.5 |
| 10 | `fg-muted` on `bg-3` | **3.17** ✗ | **3.16** ✗ | 4.5 |
| 11 | link on `bg-2` (`primary`) | 6.45 ✓ | **4.33** ✗ | 4.5 |
| 12 | link on `bg-3` (`primary`) | 5.58 ✓ | **3.99** ✗ | 4.5 |
| 13 | success message on `bg-2` | 8.10 ✓ | **3.81** ✗ | 4.5 |

### 🔴 Four findings the scoping pass did not have

1. **The launcher's grey is worse than the README says.** README §1 measured `fg-muted` on
   `bg-1` (3.93/3.62). The launcher's content area is `bg-0` — `Launcher.module.scss:22` — so the
   colour of nearly every word on the Community tab is **4.18 dark / 3.19 light**. The light
   figure is the worst text ratio in the product.
2. **The accent fails in light above `bg-1`.** README §1 noted `primary` clears by 0.07 on `bg-1`
   (4.57). It does not clear on `bg-0` (4.03), `bg-2` (4.33) or `bg-3` (3.99) — and those are the
   grounds links, the "Try again" affordance and selected rows are actually painted on. This is
   **not** fixable by moving `fg-muted`; it is a second, independent palette defect and it lands
   in NAT-002's lap.
3. **`--theme-color-success` fails in light** (3.81 on `bg-2`), and `danger` fails on `bg-4` in
   **both** themes (4.46/3.92). The platform hit exactly this and answered it by splitting the
   status roles per theme (`--site-fg-warn` / `-alert` / `-good`). The editor has no such split.
4. **The ghost-button border is invisible** (1.32/1.01). It is `bg-3` on `bg-0` — an elevation
   step used as a boundary, which is NAT-003's ramp problem showing up inside an AA row.

### What was deliberately left out, and why

- **The elevation ramp itself** (`bg-1` on `bg-0` = 1.06 dark / 1.13 light; `bg-2` on `bg-1` =
  1.07/1.06; `bg-3` on `bg-2` = 1.16/1.09) is measured and recorded here but is **not** in PAIRS.
  A card's edge against the page is decorative elevation, not a control boundary, so asserting
  1.4.11's 3:1 on it would be a gate rejecting a correct answer — the exact failure mode the
  register warns about. **NAT-003 owns those rows and must state its own bar as a design choice,
  not borrow WCAG's.**
- **Disabled text is in PAIRS at 3, not 4.5**, with the row saying so: 1.4.3 exempts inactive
  controls outright. NAT-002 AC3 owns the separate question of whether `fg-disabled` should go on
  aliasing `fg-muted`.
