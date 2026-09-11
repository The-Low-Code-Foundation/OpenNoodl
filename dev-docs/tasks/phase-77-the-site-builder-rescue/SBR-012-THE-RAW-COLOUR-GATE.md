# SBR-012 — The raw-colour gate

**Workstream B's enforcement.** The rule that keeps SBR-003..009 true after this phase ends.
🧭 Scoped down from the screens artifact's "no component may set a raw value" (unenforceable as
stated) to what a gate can actually hold: **no raw colour anywhere in the template, and every
consumed token resolves** — plus a named-exemption audit for non-token dimensions.

**The person sentence** — added by [SBR-013](SBR-013-THE-DOCTRINE-RULE.md) AC3, which requires this
phase to comply with the rule it wrote. Unnumbered on purpose: `SBR-012 §1`–`§4` are cited from
`packages/noodl-mcp/tests/sbr012RawColourGate.test.ts` and from `TASKS.md`, so the sections must not
renumber.

> **A person who changes their site's accent colour finds NOTHING left behind** — no button, no
> border, no hero scrim still wearing the old one — and the next person who adds a section that
> would break that is told so before it ships, by name.

## 1. What exists to build on

- `DiagnosticCode.RawColorLiteral` (`validation/parameterValues.ts:976`, regex at `:578`) —
  already detects `#hex`/`rgb()`/`hsl()` in color-typed ports; **warning by design** (the wider
  corpus carries 553 and imported content is not wrong for being untokenised). The template
  gate promotes it to FAIL **for this template's populations only** — do not touch the global
  severity.

## 2. Scope

- A gate (jest, beside the sb-007 family) that fails on:
  1. any raw colour in the site-builder **component sets**;
  2. any raw colour in the **generated artefact** (two populations — both, always);
  3. any `var(--x)` whose `--x` resolves in neither `DefaultTokens` nor the template's
     `designTokens` block nor the Theme-record schema (the typo'd token renders as *nothing* —
     an absence the RawColor check cannot see);
  4. 🔴 the hole shaped like the defect: RawColorLiteral only reads **color-typed ports**. A
     hex smuggled through a `*`-typed port, a Script body, or `applyTheme`'s own literals
     evades it — the artefact-level scan is therefore textual over parameter values AND script
     sources, with the `designTokens`/preset-data blocks as the one allowed home for literals.
- The dimension audit: non-token spacing/width values are listed in a named exemption constant
  with a reason each — additions red the gate until named (the REMOVED_BY_SB018 pattern: an
  exemption, not a relaxation).

## 3. Acceptance criteria

1. Green at the phase's end state; **red on a planted hex** in (a) a color port, (b) a script
   body, (c) the artefact only (regeneration drift) — known-good and known-broken must
   disagree, demonstrated in the suite itself.
2. Red on a planted `var(--tpyo)`.
3. The exemption list is empty or every entry carries a reason.
4. Runs in `test:ci` (registered in the spec barrel — an unexported spec never runs).

## 4. Traps

- 🔴 A new checker's first finding is about the checker — calibrate on HEAD before believing
  any red.
- 🔴 Strip comments before counting; measure the artefact, not the task file.

---

## 5. BUILT — s35, 2026-08-30. All four ACs.

**`packages/noodl-mcp/tests/sbr012RawColourGate.test.ts` — 25 specs, ~0.7 s**, over two
populations, plus **`packages/noodl-mcp/tests/siteBuilderStyleScan.ts`**, the instrument, held
apart so `sb006PublicSite.test.ts` and this gate scan from **one** definition of "colour".

### 5a. Calibrated on HEAD *before* a single assertion — and HEAD read zero

🔴 The task's own trap: *a new checker's first finding is about the checker.* Every arm was run
over the shipped template first, and all three read **zero**:

| check | artefact (289 KB) | component sets |
|---|---|---|
| raw colour — `#hex`, `rgb()`, `hsl()` | **0** | **0**, comments stripped |
| unresolved `var(--x)` | **0** of 33 distinct, 284 uses | **0** of 33 distinct |
| non-token dimensions | **12** → 9 after §5c's fix | — |

A checker reading zero everywhere and a checker that is broken produce the same output. So **every
arm is paired with a planted-defect spec that must red**, and §0 asserts the instrument's reach as
a floor in the same run: 24 components, ≥500 parameter rows, ≥30 script bodies including
`applyTheme` by name, and all four sources shrinking under comment-stripping.

### 5b. 🔴 The hole was **two** holes, and the second was not in the task file

`DiagnosticCode.RawColorLiteral` has moved to `parameterValues.ts:1001` (the task file said `:976`;
regex still `:578`). Re-read rather than trusted — s34 paid for exactly that. It has:

1. **`portTypeName(port) === 'color'`** — colour-typed ports only. The documented hole.
2. 🆕 **`RAW_COLOR = /^\s*(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/` — anchored at the value's start.**
   `'1px solid #cdc5b6'` passes it. Not in the task file, found by reading the regex.

This gate's pattern is unanchored and applied to **every string value on every port**, script
bodies included — and there is a spec that runs both patterns over one smuggled string so the
difference is demonstrated, not described.

⚠️ **The global severity is untouched.** The corpus carries 553 and imported content is not wrong
for being untokenised. The rule is promoted to FAIL for this template's two populations only.

### 5c. 🔴 The gate's first finding was real, and it was a survivor

`/Pages/Setup` → `Form` carried **`paddingTop: 24`, `paddingLeft: 24`, `paddingRight: 24`** — bare
numbers, and `--space-6` **is** `24px`.

- ⚠️ **Not a rendering defect.** `paddingTop` on a `Group` is `px`-only in `node-catalog.json`
  (`defaultUnit: "px"`, `units: ["px"]`), so it rendered 24px and `UnitlessDimension` — which fires
  only when the default unit is `%` — correctly stayed silent. **Measured in the catalog, not
  reasoned from the sibling `width` port, which *is* `%`-default.**
- 🔴 **The identical trio was already removed** from `/Pages/PageEditor`'s `Editor` group during
  SBR-007, with the sentence *"a raw dimension here had no token reason."* This one survived
  because **nothing scanned it**: SB-006's gate reads the five SB-006 components, and Setup is
  SB-005's. That is the whole argument for widening the population.
- ✅ **Fixed, not exempted.** The exemption list's own doctrine says spacing, colour, radius, face
  and font size gain no entries. `var(--space-6)` ×3; regenerated artefact diff is **those three
  lines and nothing else**.

### 5d. The exemption list, widened — and re-keyed

`TEMPLATE_DIMENSION_EXEMPTIONS` is **nine** entries covering the whole artefact. SB-006's four are
imported **by key** from `RAW_DIMENSION_EXEMPTIONS` so each reason has one copy; five are new
(`/App` width+height, `/Admin/Shell` Sidebar, `/Admin/NewPageDialog` Dialog card,
`/Pages/PageEditor` Heading).

🔴 **Keyed `component | label | port`, not `label | port`.** The template has **several** components
holding a node labelled `Heading` and exactly one sets a raw width — a label-only key would have
exempted the others without anyone deciding to. Asserted as a spec, not a comment.

🔴 **Equality in both directions.** An unnamed dimension reds, *and* an exemption matching nothing
reds — the second reads exactly like a raw value that was never introduced, which is how a stale
list becomes a hole.

⚠️ **A dangling name was found and fixed on the way**: `sb005Components.ts` told the reader the
rail's reason lived in **`ADMIN_RAW_DIMENSIONS`**, a constant that **never existed**. An exemption
list named in a comment and never written is an unenforced reason; the comment now points at the
list SBR-012 actually built.

### 5e. AC verdicts

| AC | verdict |
|---|---|
| **1** — green at HEAD; red on a planted hex in (a) a colour port, (b) a script body, (c) the artefact only | 🟢 **MET.** Three plants, three specs. (c) asserts the source population stays green in the same run, so the red is attributable to the artefact and nothing else. Each plant returns its own **edit count, asserted `=== 1`** — a mutation matching nothing leaves the arm identical to the control |
| **2** — red on a planted `var(--tpyo)` | 🟢 **MET**, and in **both directions**: a misspelled name, and a correctly-spelled name whose token was deleted. Same failure, opposite edit |
| **3** — exemption list empty or every entry reasoned | 🟢 **MET.** Nine entries, each >60 chars of reason, and a spec refusing any entry on a colour/radius/gap/face/size port |
| **4** — runs in the gate, not merely written | 🟢 **MET**, with a correction below |

🔴 **AC4 named the wrong gate, and the spec says so.** The AC says `test:ci` "(registered in the
spec barrel)" — that is the **editor's** convention, where `tests-unit/index.ts` is an explicit
export list and an unexported spec never runs. This package has **no barrel**: `jest.config.js`
matches `tests/**/*.test.ts` by glob. And **`test:ci` does not execute this package at all** — it
is `scripts/test-editor.ts --ci`. Asserting against `test:ci` would have produced a spec that
passes while measuring a gate this file is not in. So AC4 is checked where it lives:
`jest.config.js`'s glob, `test:packages` scoping `@noodl/mcp`, and `pr.yml` running
`test:packages` — all three read from disk. Confirmed independently with `jest --listTests`.

### 5f. Gates taken

- ✅ **`sbr012RawColourGate` — 25/25.**
- ✅ **The full `@noodl/mcp` package suite — 79 suites, 1040 tests, exit 0.** The suite CI runs.
  File count reconciled against `jest --listTests` (**79**), so no suite silently failed to run.
- ✅ **`sb007Template` — byte-identity holds.** `npm run template:site-builder` regenerates with no
  diff beyond §5c's three lines.
- ✅ **`sb006PublicSite` / `sb005AdminPanel` / `sb004Authoring` — 106/106**, after the two regexes
  moved out of `sb006PublicSite.test.ts` into the shared module.
- ✅ **`tsc --noEmit` on `@noodl/mcp` — exit 0, zero output.** (`jest` runs with
  `diagnostics: false`, so a type error here would otherwise never surface.)

### 5g. 🔴 SBR-004 AC3 is closed by this task

*"every style value is a token, or a named exemption"* — SBR-004's third AC was SBR-012's to own.
It is now held over **both** populations rather than over SB-006's five components, with the
exemption list reasoned and equality asserted in both directions.
