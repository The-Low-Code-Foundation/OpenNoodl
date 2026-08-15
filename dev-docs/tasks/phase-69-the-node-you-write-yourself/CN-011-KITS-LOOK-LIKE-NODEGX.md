# CN-011 — Kits look like NodeGX

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M |
| **Surface** | `runtime`, `editor`, `docs` |
| **Rulings** | ✅ **D8** — tokens by default in the scaffold, **not enforced** |
| **Depends on** | CN-006 (the scaffold that carries the default) |

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
   `var(--token)` spacing value, rendering with the token's computed value in both themes. The
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
2. Both themes, and a token change propagates without a reload.
3. A variant created on a kit node survives a save/reload cycle. 🔴 **State that rides on a save is
   lost for a reader** — test the *reader* path, and note the recorded trap that a spec containing a
   save cannot catch this.
4. The cashflow kit contains no raw hex.

## Traps

- 🔴 **`tsc -p <tsconfig>` without `--noEmit` emits into `src/`** — relevant if this task touches
  package builds while verifying.
- ⚠️ Design tokens live in two border namespaces and `--border-control` is a recorded trap; see the
  older-phase pointers before inventing token names for the scaffold.
