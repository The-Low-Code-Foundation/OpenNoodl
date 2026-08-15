# CN-007 — The docs page that replaces the broken one

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M |
| **Surface** | `docs-site-content`, `editor` (the entry point) |
| **Rulings** | ⚠️ **D5** — carries a **required mitigation** · ✅ **D2**, ✅ **D8** |
| **Depends on** | CN-005 (types the examples must typecheck against), CN-006 (the scaffold it documents) |

## The reader

Someone who tried the Noodl 2.7 `create-react-lib` guide and gave up — the single most-cited dead end
in the community — plus everyone who concluded from that failure that custom visual components were
out of reach. They arrive **expecting this to be hard and to have been lied to before**. The page
earns trust by being specific and by naming what is still rough.

## ⚠️ The D5 obligation — the most important line in this task

**D5 was ruled against the recommendation:** the kit shipped in the library is a deliberately
minimal 1–2 node kit, chosen to be read as a starting point.

The accepted cost is that **a minimal kit cannot demonstrate P2 or composition**. So:

> ✅ **This page MUST carry the cashflow kit as its worked example.** It is the only artefact that
> shows a running-balance rule living in a stock `Function` node, ~60 decisions exposed as ports, and
> custom nodes composing with `Static Data` / `For Each` / `Object` / `Set Object Properties` /
> `Array Changed`.

If this page shrinks to the minimal kit, **P2 loses its only demonstration anywhere in the product**,
and the ruling's cost becomes uncontained. A task that drops the worked example must say so out loud
and re-open D5. This is written into RULINGS.md; it is not a preference.

⚠️ **Before the cashflow kit can be cited, it must be moved onto design tokens** (✅ D8). It hardcodes
hex throughout today — it was a proof, not a model. Citing it as-is teaches the opposite of D8 and
P2 simultaneously.

## What the page must contain

1. **The 21-line node, first.** "It is this small" is the thesis; anything before it is throat-clearing.
2. **Why it works** — `window.React` loaded before module scripts; one React guaranteed because
   `build-react-globals.js` aliases `react-dom`'s own `require('react')` at the global; the same
   `createNodeFromReactComponent` bridge every built-in visual node goes through.
3. **What the old path required and why it failed** — the SDK + webpack route bundled a second React,
   two dispatchers, `Invalid hook call`, unfixable from inside a project. Naming the old failure is
   what convinces the reader who already burned a weekend on it.
4. **Both runtimes** — React 18.3.1 default, 19 opt-in via `runtimeVersion`, identical deployed
   filenames, so a kit written once runs on both with nothing to recompile.
5. **The inherited ports table** — `Width`/`Height`/`screenPosition`, `allowChildren` default true,
   style variants, `Did Mount`. What you get without asking.
6. **P2, taught by example**, via the cashflow kit.
7. **The rough edges, stated plainly.** A reader hits them within an hour; having named them first is
   worth more than a clean-looking page.

## Discoverability

A docs page nobody finds is the failure mode that produced this task in the first place — the
mechanism existed the whole time and was invisible. Ship an **in-editor entry point**: from the kits
surface (CN-006b), and from wherever "New node kit" lives.

## Acceptance criteria

1. Every code sample **typechecks against the published types** (CN-005). Samples that drift are how
   the 2.7 guide became a trap — `a-doc-that-lies-has-examples-that-lie-too`.
2. Following the page **from scratch** produces a working node in the picker. Have someone (or an
   agent) who has not read this phase do it, and record where they stall.
3. The cashflow kit appears as the worked example, on tokens.
4. Reachable from inside the editor without knowing the mechanism exists.
5. The public docs claim nothing this phase has not measured. In particular, **do not claim the logic
   half works** — CN-012 has not run.

## Raw material

The community artifact drafted 2026-08-15 already carries the structure, the verified claims and the
honest rough-edges section, and can be adapted rather than rewritten. It deliberately states that
`Noodl.defineModule({ reactNodes })` is **inherited from Noodl, not new** — keep that. The credible
claim is that we kept the contract alive through React 19's removal of UMD builds, and it is stronger
than "we invented it".
