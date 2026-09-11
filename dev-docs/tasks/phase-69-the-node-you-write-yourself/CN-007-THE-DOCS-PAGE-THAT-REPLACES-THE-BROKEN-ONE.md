# CN-007 — The docs page that replaces the broken one

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M |
| **Surface** | `docs-site-content`, `editor` (the entry point) |
| **Rulings** | ⚠️ **D5** — carries a **required mitigation** · ✅ **D2**, ✅ **D8** |
| **Depends on** | CN-005 (types the examples must typecheck against), CN-006 (the scaffold it documents) |

## ✅ s26 (2026-08-18) — AC5's stale clause rewritten, and four sections the page still owed

🔴 **AC5 said: *"do not claim the logic half works — CN-012 has not run."* CN-012 has run and it
works**, so the page was carrying a disclaimer about its own product. The note now reads *"Two kinds
of node, and both are covered"* and points at a real section.

Added to `docs-site/docs/custom-nodes.md`:

| Section | Owner |
|---|---|
| **Logic nodes: no React, no DOM** | CN-012 — a complete `Accumulator` sample, compiled by the gate against `LogicNodeDefinition`, plus the `runOnValueChange` caution (it declares the checkbox and **does not wire it**) |
| **Where your kit runs** | CN-013 — the `runtimes` table, cloud carrying logic nodes only and unable to `require`, and why there is no `"ssr"` value |
| **Ports that appear only when they are relevant** | ✅ **CN-010 AC4** — a worked conditional port group, and D12's `channelPort` refusal |
| **Telling people what your node is for** | ✅ **D10** — the `docs` / `docsUrl` pair, and why a URL in `docs` is the wrong field |

⚠️ **The rough edges were re-measured, not copied.** *"The preview does not always pick up a new
kit"* is corrected — CN-014 AC1 (s20) fixed the library half, so a reload now does deliver a new
node and a renamed port. Two new edges added: the missing `--success`/`--warning` tokens, and the
open property panel that does not refresh itself (D11).

✅ **AC1 holds.** The sample gate's fragment budget rose **4 → 7**, each new fragment named in the
test so a deliberate rise is distinguishable from drift, and it gained a **floor on the compiled
count** — otherwise the budget could be satisfied by turning complete samples into fragments.

⚠️ **AC2 is still open and is the one thing left**: *"following the page from scratch produces a
working node in the picker"*, done by someone who has not read this phase, recording where they
stall. It cannot be self-graded by the person who wrote the page.

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

> ✅ **DONE (s14) and DRIVEN (s15, 2026-08-17).** The kit is on tokens and the rendered result is
> measured, not inferred: positive pills paint **`rgb(22, 163, 74)`** (`--green-600`) with no colour
> parameter set anywhere — not the old `#1F8A4C`, and not `rgba(0,0,0,0)`. 🔴 **That last exclusion is
> the one that mattered:** s14 also removed the in-JSX `props.positiveColor || '#1F8A4C'` fallbacks on
> the reasoning that a declared `default` is assigned to props at initialize, and if that reasoning
> had been wrong every pill, band and banner would have rendered with no background. It was right.
> Both banner arms measured by flipping the driving value (`--green-50`/`--green-600` safe,
> `--red-50`/`--red-600` danger). Full readings: [notes/cn-007-d8-token-drive.md](notes/cn-007-d8-token-drive.md).
>
> 🔴 **The kit that was driven is `cashflow-command-centre`'s copy — the ONLY tokenised one.** The
> copies in `cn001-kit-drive` and `cn019-drive` are still pre-D8 (0 × `var(--`, 6 × live `#1F8A4C`).
> Driving either would have measured the old kit and read as "the change did not land". This is the
> unversioned-kit risk in §Carried made concrete.

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
