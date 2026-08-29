# DEF-001 — The defaults fail accessibility on the two controls every app has

**Rank 1.** Sources: phase 78 **D11** and **D13**. Both **NONE**-owned since they were measured.

🔴 **This is the only task in the phase whose harm lands on someone who never chose NodeGX** — the
visitor to an app somebody built here. Every other row costs a builder time; this one ships a
product that a person with low vision cannot use.

## 1. What was measured, at HEAD, 2026-08-29

### The button — `--primary-foreground` on `--primary`, against the 4.5:1 AA floor

| preset | ratio | |
|---|---|---|
| `modern` | **3.68** | 🔴 the wizard's default |
| `playful` | **4.23** | 🔴 |
| `soft` | **4.47** | 🔴 — misses by 0.03 |
| `minimal` | 17.72 | ✅ |
| `enterprise` | 17.85 | ✅ |

🔴 **And the row is wider than phase 78 recorded it.** `ModernPreset.ts:15` ships `tokens: {}` —
*"Modern IS the defaults"*. So **3.68 is not Modern's ratio, it is `DefaultTokens.ts`'s**:

```ts
{ name: '--primary',            value: '#3b82f6' },   // DefaultTokens.ts:15
{ name: '--primary-foreground', value: '#ffffff' },   // DefaultTokens.ts:29
```

**Every project inherits it, including every project whose author never opened the preset picker.**
The claim is not "3 of 5 presets fail"; it is "**the product's default primary button fails**, and
two presets fail as well".

### The field edge — `--border` on `--background`, against the 3:1 of WCAG 1.4.11

`net.noodl.controls.textinput`'s `variantStyles.default` is
`{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }` → **1.33:1**.

⚠️ **The product already knows and wrote it down.** `outlineButton`'s own description says *"A
control border needs 3:1 and no `--border*` token reaches it (best 1.48:1), so this uses
`--muted-foreground` (4.76:1)"*, and **`--border-control` exists in every preset for exactly this**.
The knowledge is one composition away from the element that needs it and never made the trip.

## 2. Scope

1. **Fix the default palette** so `--primary-foreground` on `--primary` clears 4.5:1 — by moving
   `--primary`, `--primary-foreground`, or both. `DefaultTokens.ts` is the ground; the three failing
   presets follow.
2. **Point `textinput`'s `default` variant at `--border-control`**, the token that already exists
   and already passes.
3. **A ratchet in `test:ci`** over *every* shipped preset **and the defaults**, asserting the pairs
   the product actually renders.

⚠️ **Only the pairs that are really rendered.** The rule on record is *pairs: min 3 | 4.5 only* —
a ratchet that grades every token against every other token produces noise and gets switched off.
Derive the pairs from the variant/composition definitions, not from the token list.

⚠️ **A changed `--primary` moves other rows.** `--primary` is a background for foreground text
elsewhere; a fix that clears the button and reddens a badge has moved the defect, not removed it.
The ratchet must cover the moved rows in the same run — a moved ground **corrects** rows rather
than exempting them.

## 3. Acceptance criteria

1. **A person's sentence:** *a visitor with low vision can read the label on the button the app
   asks them to press, in a project created by accepting every default.*
2. `DefaultTokens.ts`'s primary pair ≥ 4.5:1, measured by the ratchet and not by hand.
3. All five presets ≥ 4.5:1 on the same pair.
4. `textinput` `default` border ≥ 3:1 against its own background.
5. The ratchet is **red on a planted regression** in (a) the defaults, (b) one preset, (c) the
   textinput variant — three arms, each demonstrated in the suite.
6. Registered in the spec barrel. **An unexported spec never runs.**

## 4. Traps

- 🔴 **A mockup is not a contrast measurement** (P67). Compute from the shipped token values.
- 🔴 **A second copy of a palette drifts silently.** `--primary` appears in `DefaultTokens.ts`, in
  four preset files, and in each preset's `primaryColor` legacy field. Fix the ground and assert
  the copies agree, or the next session measures the wrong one.
- ⚠️ **`ModernPreset` ships `tokens: {}`, and `styleTools.ts`'s `entries.length === 0` branch
  *clears* the block** — so "apply Modern" and "apply nothing" are indistinguishable. Any fix that
  routes through Modern's token map does nothing. Fix the defaults.
- 🔴 Grade **known-good against known-broken**. A ratchet green on both arms has measured nothing.

---

## 7. ✅ DONE — 2026-08-29, `30eb92b2`

### The ruling

**Richard, 2026-08-29:** *`--primary` moves, white text stays.* Asked with the candidates measured,
because a preference between two colour schemes is not a thing to guess at.

### 🔴 The task named 2 rows. The derivation found 62.

The scope above said "the primary pair and the `textinput` border", and §2's own warning said the
ratchet must be **derived from the variant/composition definitions, not from the token list**. Doing
that literally — walking `ElementConfigRegistry` (every config, every variant, every interaction
state) and `STYLE_COMPOSITIONS` — produced **50 pairs × 6 palettes = 300 readings**, of which **62
failed** across **9 distinct pairs**:

| pair | floor | worst | palettes failing |
|---|---|---|---|
| `--border` on `--accent` | 3 | **1.04** | all 6 |
| `--border` on `--background` | 3 | **1.23** | all 6 |
| `--primary-foreground` on `--primary` | 4.5 | 3.68 | defaults, modern, playful, soft |
| `--primary` on `--background` | 4.5 | 3.68 | defaults, modern, playful, soft |
| `--destructive-foreground` on `--destructive` | 4.5 | 2.69 | soft, playful, defaults, modern |
| `--destructive-foreground` on `--destructive-hover` | 4.5 | 3.67 | soft |
| `--destructive` on `--background` | 3 | 2.67 | soft |
| `--secondary-foreground` on `--secondary` | 4.5 | 2.72 | soft, playful |
| `--secondary-foreground` on `--secondary-hover` | 4.5 | 4.23 | soft |

🔴 **Two of the three controls were never in the write-up.** DEF-001 named the TextInput. The same
walk found the **Checkbox** on the identical 1.23:1 edge, and **Button/outline** — whose `hover`
state (`--border` over `--accent`) is the worst reading in the whole set at **1.04:1**. A
hand-written pair list would have fixed one control and shipped two.

🔴 **And `--primary` is not only a background.** `Button/link`, `Checkbox:hover`'s border, `--ring`
and the `eyebrow` composition all use it as *ink*. The task's own warning — *"a fix that clears the
button and reddens a badge has moved the defect"* — was live: the same move that fixed the button
fixed those five rows, and the derivation is what showed they existed.

### What moved

All values one Tailwind step darker; hover one step further; `--ring` follows `--primary` because a
focus ring that is not the brand colour is a different bug. `preview.primaryColor` moved with each
preset — **a second copy of a palette drifts silently**, and that legacy field is the second copy.

| palette | token | was | now | was → now |
|---|---|---|---|---|
| **defaults** | `--primary` / `-hover` / `--ring` | `#3b82f6` | `#2563eb` | **3.68 → 5.17** |
| **defaults** | `--destructive` / `-hover` | `#ef4444` | `#dc2626` | **3.76 → 4.83** |
| **playful** | `--primary` / `-hover` / `--ring` | `#8b5cf6` | `#7c3aed` | **4.23 → 5.70** |
| **playful** | `--secondary` / `-hover` | `#ec4899` | `#db2777` | **3.53 → 4.60** |
| **playful** | `--destructive` / `-hover` | `#f43f5e` | `#e11d48` | **3.67 → 4.70** |
| **soft** | `--primary` / `-hover` / `--ring` | `#6366f1` | `#4f46e5` | **4.47 → 6.29** |
| **soft** | `--secondary` / `-hover` | `#a78bfa` | `#7c3aed` | **2.72 → 5.70** |
| **soft** | `--destructive` / `-hover` | `#fb7185` | `#e11d48` | **2.69 → 4.70** |

`minimal` and `enterprise` already cleared every floor and **did not move**.

### The borders cost no palette change at all

`--border-control` already ships in `DefaultTokens.ts` (`#7c8894`) **and in all four overriding
presets**, and it already clears 3:1 in every one of them — 3.62 to 4.83 against `--background`,
3.30 to 4.40 against `--accent`. Pointing `TextInputConfig`, `CheckboxConfig` and
`ButtonConfig.outline` at it cleared all 12 border failures with no new colour.

⚠️ **`outlineButton`'s comment was stale and said so honestly.** It recorded that `--border-control`
*did not exist*, that `ui-split-hero` wrote it anyway, and — precisely — *"if a `--border-control`
token is ever added, this is the line to change."* It was added. The line changed. That comment is
the reason this row cost minutes instead of a re-derivation.

### The ratchet

`packages/noodl-editor/tests-unit/def-001/design-token-contrast.test.ts` — 12 specs.

- **Pairs are derived from both sources**, and the spec asserts both contribute.
- **The control/non-control classification is asserted TOTAL** in both directions: no node type it
  meets is unclassified, and no name in the control list is unreachable. An exclusion list that
  cannot fail is how the next control ships ungraded.
- **`modern` and `defaults` must read identically** — `ModernPreset` ships `tokens: {}`, and if they
  ever diverge one has been patched and the other has not.
- **Every colour must resolve.** An unresolvable token would otherwise read as a silent pass.
- **Four mutation arms**, each with its control pair beside it: (a) the defaults, (b) one preset
  only, (c) an element config, (d) a composition.

🔴 **Graded by sabotage, not by reasoning** (AC5):

| sabotage | result |
|---|---|
| `failures()` returns `[]` | **all 4 arms red**, floors stay green — which is exactly why the arms exist |
| `--primary` reverted to `#3b82f6` **in source** | floor red (10 readings named), plus arms (a)(b)(c) |

⚠️ **It is not `nat-001/palette-contrast.spec.ts`, and the header says why.** That spec reads
`colors.css` and grades the **editor's chrome**; this one reads `DefaultTokens`/the presets and
grades **what a built app ships a visitor**. No token, file or population in common. Said in the
file because *a check in a second pipeline is a duplicate first*.

### Gates

| gate | result |
|---|---|
| `test:main` | **6266 / 6266** |
| `test:ci` | **2889 specs, 4 failures** — all `AIX-006 style vocabulary` **by name**. The floor, unmoved |
| `typecheck:editor` | exit 0 |

Three specs pinned the old `#3b82f6` and were moved with it: `tests/models/StyleTokenCoverage`,
`tests-unit/sbr-003/token-contract`, and a now-stale comment in `tests/ai/authoring-style`.

### 🔴 Not done, and not claimed — AC1's last inch

**Nothing here observed a rendered button.** The two halves of the path are each graded — the token
reaches `:root` (`sbr-003/token-contract` asserts `generateProjectTokenCss` emits
`--primary: #2563eb;`) and `ButtonConfig` stamps `backgroundColor: var(--primary)` at creation — but
a **source-text pass is not a paint-time measurement**, and this repo has the scar to prove it.

A drive that drops a Button in a default project and samples the rendered pixels would close AC1's
sentence outright. **It is owed.** Folded into DEF-008's re-drive rather than left as a footnote.
