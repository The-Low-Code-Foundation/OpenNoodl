# FLD-003 — Advanced Columns, as a prefab

🟢 **BUILT 2026-09-11 (s17) — 5 of 5 ACs, driven in a real browser and opened in the real editor.**
`library/prefabs/advanced-columns`, four bands, plus the pointer to it on the Columns node's
`Small Layout` port. 🔴 **Read
[FLD-003-WHAT-WAS-BUILT.md](./FLD-003-WHAT-WAS-BUILT.md) §1 before believing anything below: two of
this file's claims are wrong, and one of them is the blocker this task was held on.** In short —
the gaps were **never** broken by the FLD-004 typo (static library ports never reach it; the value
path is byte-identical to `v0.2.2`), so this never hard-depended on FLD-004; and AC1's *"change one
breakpoint width in the States node"* is not a thing a States node can hold, because it publishes
only the state it is in.

**Severable.** Richard's own proposal, in his own words, and the honest answer to "we need more
breakpoint settings" without a hundred new ports. Gated on **R3**.

## 1. The person sentence

**Someone who needs more than two breakpoints installs Advanced Columns from the library, opens it,
and sees how the States node drives the Columns node's existing inputs — with sensible defaults
already set.**

## 2. What was reported, and what the code says

[#22](https://github.com/The-Low-Code-Foundation/NodeGX/issues/22): *"I have a feeling adding a
hundred new fields to the Columns node isn't the right way to go about this… I actually wonder if a
prefab is the right call here… I think shipping a simple prefab like this with default values would
show users how easy it is to do advanced Columns node work with a States node."*

Measured 2026-09-09 — **the shipping mechanism exists and the precedent is close:**

- Content lives in-repo: `library/prefabs/<slug>/{library.json, icon.png, project/project.json}`
  (43 prefabs today) and `library/modules/` (31).
- Gate, build and publish: `npm run library:check` → `scripts/library/check.ts` against
  `scripts/library/schema.json`, then `scripts/library/build.js`, `verify-dist.ts`,
  `verify-origin.ts`, `origin-baseline.json`; served from `getContentEndpoint()`.
- Editor surface: `NodePickerSearchView.tsx:115` → `ModuleCard.tsx`, with `minEditorVersion` gating.
- 🔴 **Closest precedent, and a warning:** `library/prefabs/media-query/` — four components built on
  `window.matchMedia`. It is **viewport**-keyed, and Columns breakpoints are **container**-keyed, so
  it does **not** compose with them. Advanced Columns must key off the Columns node's own new
  `Breakpoint` output (FLD-002), not off Media Query.
- The other relevant precedent is `library/prefabs/states-kit/`; the node is
  `nodes/std-library/states.ts:125`.

🔴 **The workaround this prefab is built on is itself broken today.** Wiring a number into
`Medium Below`, `Horizontal Gap`, `Vertical Gap` or `Min Column Width` does nothing, and for the gaps
it *zeroes* them — the `type`/`unit` typo in **FLD-004**. A States node driving those inputs cannot
work until FLD-004 lands. That is a hard dependency, not a nicety.

⚠️ **There is no precedent for a node card pointing at a prefab.** Library entries live in a separate
tab of the node picker and are never mixed into node search results. The available hooks, cheapest
first: the enrichment file's `relatedNodes`/`patterns` (rendered in the picker preview **and** served
to the MCP loop); an extended port tooltip (precedent: the `packing` enum, `columns.ts:213-233`); the
node's `docs:` URL. `relatedNodes` currently accepts **node type names only** — pointing it at a
prefab slug is a small schema extension, and that is the honest cost of "discoverable from the node".

## 3. Scope

- Author the prefab: a visual component wrapping a States node wired into the Columns node's existing
  inputs, shipped with defaults that work unedited.
- Decide and implement **one** discoverability hook. Do not build three.
- If `relatedNodes` is the chosen hook, extend the schema to accept a prefab slug and gate it.

## 4. Acceptance criteria

1. **(person)** Install Advanced Columns from the library into a new project, place it, and it lays
   out at three breakpoints **without editing anything**. Then change one breakpoint width in the
   States node and the layout follows.
2. `library:check` passes and the prefab appears in the picker with its icon and `minEditorVersion`.
3. The prefab's own States node drives at least one **numeric** Columns input, asserted end to end —
   this is the arm that proves FLD-004 actually landed and is not a claim about it.
4. The discoverability hook is asserted: a spec reads whatever surface was chosen and finds the
   pointer, so it cannot rot silently the way the enrichment did.
5. The prefab does not key off `window.matchMedia`. Asserted, because the nearest precedent does and
   copying it would be wrong.

## 5. Traps

- 🔴 **Gated on R3.** Richard proposed it, but "I wonder if" is not a ruling. Confirm before authoring
  library content, which is expensive to unship.
- 🔴 **Hard-depends on FLD-004.** Build this on the broken workaround and it will appear to work in
  the editor while doing nothing for numeric ports.
- ⚠️ Prefabs are published content with an origin baseline. Regenerate to `--out-dir` and diff; a
  wholesale regeneration of the library artefacts is an unperformed merge.
- ⚠️ Do not ship a prefab that only demonstrates. It must be useful as-is, or it is documentation
  wearing a component's clothes.
