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
