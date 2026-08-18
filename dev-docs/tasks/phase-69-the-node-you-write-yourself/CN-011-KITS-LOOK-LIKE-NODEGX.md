# CN-011 — Kits look like NodeGX

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `runtime`, `editor`, `docs` |
| **Rulings** | ✅ **D8** — tokens by default in the scaffold, **not enforced** |
| **Depends on** | CN-006 (the scaffold that carries the default) |

## 🔴 MEASURED 2026-08-18 (s26): AC1 and AC4 were ALREADY MET. The task's premise is false.

The spec below says *"The cashflow kit hardcodes hex throughout"* and the s26 handover carried
CN-011 as **all of it left, including D8's cashflow tokenisation, gating CN-007**. Measured:

| | |
|---|---|
| live (non-comment) hex in the kit | **0** |
| `var(--token)` references | **16**, over 10 distinct tokens |
| the 2 `#1F8A4C` strings a grep finds | both inside the **comment** explaining the change |

✅ **AC4 is met.** ✅ **AC1 is met and was DRIVEN in s15** — positive pills paint
`rgb(22, 163, 74)` = `--green-600` with no colour parameter set, asserted on the **computed style**
and against the discriminating triple, not on the parameter
([notes/cn-007-d8-token-drive.md](notes/cn-007-d8-token-drive.md)). So **D8's obligation does not
gate CN-007** — CN-007 was already free to cite the kit, and does.

⚠️ **The copies still differ and that is the live hazard.** `cashflow-command-centre` and
`cn069-s15-drive` carry the tokenised kit (0 live hex); `cn001-kit-drive`, `cn019-drive` and
`cn015-editor-drive` carry the **pre-D8** one (**25** hex). Driving one of the latter measures the
old kit and reads as *"the change did not land"*.

### What is genuinely left

- ✅ **AC2 — met s27, and re-scoped s28.** Token resolution and live propagation both measured. The
  *"both themes"* clause is **struck**: there is no second theme in the viewer (see AC2 below for the
  measurement and for why `ThemeManager` is not it).
- ✅ **AC3 — met s27**, on the reader path: a variant survived a full project close and reopen.

✅ **All four criteria are now met. CN-011 is closed.**

### 🔴 A finding for Richard: the semantic token set has no `--success` and no `--warning`

Measured against `DefaultTokens.ts`: `--destructive`, `--destructive-foreground` and
`--destructive-hover` exist; **`--success`, `--warning` and `--info` do not.** So a kit with three
status bands reaches into the palette scale for two of them — which is exactly what the cashflow kit
does (`--green-600`, `--amber-600` beside the semantic `--muted`, `--primary-foreground`,
`--border-subtle`). The phase's flagship worked example demonstrates the gap.

⚠️ **Not fixed here, deliberately.** Adding tokens to `DefaultTokens.ts` changes the vocabulary every
project sees and is a design-system decision, not a kit one. Recorded in CN-007's rough edges so a
reader is not left thinking the kit chose badly. **Wants a ruling.**

## The job

Make a kit node participate in the design system the same way a built-in does: design tokens,
`visualStates`, `useVariants`.

**Most of the machinery already exists.** AIB-001 taught the bridge that a units-typed input may
carry a `var(--token)` string rather than a magnitude, and that it must reach the style **untouched**
— fitting a unit produces `var(--space-4)px`, and reading `.value` off it produces `undefined`, both
silent. `useVariants` and `visualStates` are declared fields on `ReactNodeDefinition`, and the
cashflow kit picked up **"Add style variant"** in the property panel for free, without asking.

So this task is mostly **making the existing capability the default an author falls into**, rather
than building capability.

## ✅ What D8 settled, and what it deliberately did not

- The **scaffold emits `var(--token)` defaults** for colour and spacing ports (CN-006 owns the
  emission; this task owns the mechanism working and being documented).
- **Nothing validates it.** An author may hardcode. Brand colours and data-viz palettes are
  legitimate cases and a rule would block them. This is a ruling about defaults, not conformance —
  do not add a lint that fails a kit for using hex.

## ⚠️ Applies to this phase's own output

The cashflow kit hardcodes hex throughout — it was a proof, not a model. **It must be moved onto
tokens before CN-007 cites it as the worked example**, or the phase's flagship documentation teaches
the opposite of its own ruling. This is recorded in RULINGS.md under D8 and is the concrete
deliverable most at risk of being forgotten.

## What to build

1. **Verify the token path end-to-end from a kit** — a kit node with a `var(--token)` colour and a
   `var(--token)` spacing value, rendering with the token's computed value. (*"in both themes"*
   struck s28 — see AC2.) The
   AIB-001 note says it is *"provably inert for existing projects: no units-typed parameter in any of
   the 35 projects in this repository is a `var(` string"* — so a kit doing this is genuinely the
   first caller.
2. **`visualStates` from a kit** — hover/pressed states declared by a module rather than a built-in.
3. **Variants** — confirm the "Add style variant" affordance observed on the cashflow kit actually
   round-trips: create a variant, apply it, reload, still there.
4. **Document all three** in CN-007.
5. **Migrate the cashflow kit onto tokens.**

## Acceptance criteria

1. A kit node styled with `var(--token)` renders the token's value — asserted on the **computed
   style**, not on the parameter. ⚠️ `an-icon-host-that-sets-fill-sets-nothing` is the local
   precedent for a style that is set and does nothing.
2. ✅ **RE-SCOPED s28** — a kit node's token **resolves**, and a token change **propagates without a
   reload**. Both halves measured and met by s27 (T1, T3).

   🔴 **The original clause read "both themes", and it was struck rather than failed: there is no
   second theme to render in.** Re-measured s28, independently of s27: `StyleTokenRecord` is
   `{name, value, category, isCustom, description?}` — one value per token, no theme dimension — and
   `packages/noodl-viewer-react/src` contains **zero** occurrences of `data-theme`,
   `prefers-color-scheme`, `setTheme` or `themeName`. A project has exactly one token set, so the
   clause asked for a capability the product does not have. Logging it as a failure would have made
   the criterion permanently unmeetable and told a reader the kit path was broken when it is not.

   ⚠️ **The trap that will try to reopen this: `ThemeManager` exists.** Five files under
   `noodl-editor/src/editor/src` do theme work (`ThemeManager.ts`, `useThemeTokens.ts`,
   `CanvasTheme.ts`, the two Blockly ones). They theme the **editor's own chrome** — canvas, panels,
   the Blockly workspace. This criterion is about the colour a **kit node renders in the running
   app**, which is the viewer's population, and the viewer has no theme. Finding `ThemeManager` is
   not finding the second theme; measure `noodl-viewer-react/src` before reopening.
3. A variant created on a kit node survives a save/reload cycle. 🔴 **State that rides on a save is
   lost for a reader** — test the *reader* path, and note the recorded trap that a spec containing a
   save cannot catch this.
4. The cashflow kit contains no raw hex.

## Traps

- 🔴 **`tsc -p <tsconfig>` without `--noEmit` emits into `src/`** — relevant if this task touches
  package builds while verifying.
- ⚠️ Design tokens live in two border namespaces and `--border-control` is a recorded trap; see the
  older-phase pointers before inventing token names for the scaffold.

---

## 🚗 s27 (2026-08-18) — AC3 met; AC2 half met and half unmeasurable

Full readings: [notes/s27-drive-observations.md](notes/s27-drive-observations.md).

- ✅ **AC2, token resolution (T1).** A `var(--token)` colour resolves: pill background
  **`rgb(22, 163, 74)`** = `--green-600` = `#16a34a`, with `el.style.background` holding the literal
  `var(--green-600)` — the token string reaches the style object untouched.
- ✅ **AC2, live propagation (T3).** `setToken('--green-600', …)` in the editor moved the viewer's
  root property **and** the kit node's rendered colour with **no reload**. This is the half s15
  never measured.
- 🔴 **AC2's "in both themes" clause cannot be met or failed — there is no second theme.**
  `StyleTokenRecord` is `{name, value, category, isCustom, description?}`: one value per token, no
  theme dimension. 182 flat tokens in `DefaultTokens.ts`; no `data-theme`, `prefers-color-scheme`,
  `setTheme` or `themeName` anywhere in `noodl-viewer-react/src`. **The clause should be struck or
  re-scoped, not recorded as a failure.**
- ✅ **AC3 met, on the reader path.** A variant created on a kit node
  (`nodegx.grow.Gamma`, `useVariants: true`) saved to `nodegx.styles.json`, survived a full project
  close and reopen, and came back as a real `VariantModel` with `tone: var(--green-600)` intact.
  ⚠️ Variants live in `nodegx.styles.json`, **not** `nodegx.project.json` — reading the latter shows
  no `variants` key and would read as "variants do not persist".
