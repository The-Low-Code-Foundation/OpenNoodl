# NDA-005: Port Documentation Sweep

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-005 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — the single biggest input to the AI authoring loop, and the cheapest win in the phase |
| **Difficulty** | 🟢 Low per port, 🟠 Medium in aggregate — 2,508 ports |
| **Estimated Time** | 3–5 weeks, or much less if batched with NDA-012 |
| **Prerequisites** | None. Ports touched by NDA-003 should be documented there instead |
| **Branch** | commit directly to `cline-dev`, one commit per category |
| **Recommended executor** | 🟢 **Sonnet 5** — mechanical once the house style is fixed |

## Objective

Write a `description` for every port in the node library. 2,508 of 2,650 are blank.

## Why this is not a docs chore

Three consumers read `description`, and all three are degraded today:

1. **The property and connection panels** — where an author asks "what does this port do". Blank means
   they guess or leave the editor to search docs.
2. **The semantic validator (SUB-006) and catalog enrichment (SUB-005)** — which can only check what
   is described.
3. **The AI authoring loop (AIX-002, AIX-011)** — port descriptions are the primary signal the model
   has when choosing which port to wire. **95% blank is a direct explanation for wrong port choices**,
   and it is the cheapest quality improvement available to the authoring loop.

That third one makes this task pay for itself. Every other AI-authoring improvement competes with a
model that is guessing at ports.

## The shape of the work

| | Count |
|---|---|
| Total ports | 2,650 |
| Documented | 142 (5%) |
| Nodes where **no** port is documented | 112 of 155 |
| Nodes with no docs URL at all | 14 |

**Most of this is shared.** `node-shared-port-definitions.ts` supplies dimensions, alignment, margins,
padding, transforms, text style and pointer events to most of the 29 Visual nodes. Documenting the
shared definitions once covers a large fraction of the 2,508 — do those **first** and re-measure
before touching anything per-node, because the remaining count will be much smaller than it looks.

## House style (settle this before writing 2,508 of anything)

Proposed:

- One sentence, no trailing period, starting with a verb for signals and a noun phrase for values.
- State the **unit and the empty behaviour** where either is non-obvious — this is where NDA-003's
  decisions get written down for authors.
- Say what it does, not what it is: "Number of items to skip before the first result", not "The offset".
- Do not restate the display name. `Offset — the offset` is worse than blank, because it looks answered.

Write the style into `dev-docs/reference/` next to the two contracts, and put three worked examples in
it.

## Method

1. Document the shared port definitions in `node-shared-port-definitions.ts`. Re-measure.
2. Work by category, using the [NDA-012 worksheets](./audit/) — check C1 is exactly this task, so if
   NDA-012 is running, **do both in the same pass**. Reading the node to audit it is the expensive
   part; writing the description while it is open is nearly free.
3. Regenerate the catalog and the register after each category so the number visibly falls.
4. The 14 nodes with no docs URL need one written or the field removed — a dead link is worse than none.

## Success criteria

1. Port documentation coverage ≥ 95% (inverting today's number), measured by
   `node scripts/node-audit/register.js`.
2. No node has 0% coverage.
3. The house style exists in `dev-docs/reference/` with worked examples.
4. Spot-check the AI authoring loop before and after on the same prompt set; record whether port
   selection improved. If it did not, that is worth knowing and worth writing down.

## Out of scope

Rewriting the external docs site. This is the `description` field in node definitions only — the thing
that ships inside the product and inside the catalog.
