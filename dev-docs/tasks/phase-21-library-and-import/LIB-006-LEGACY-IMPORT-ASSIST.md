# LIB-006: Legacy Project Import — Best Effort, Honest Report, AI Repair

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LIB-006 |
| **Phase** | Phase 21 — Library & Import Overhaul |
| **Priority** | 🟡 Medium (nothing is blocked on it; it is the *promise* half of a decision already taken) |
| **Difficulty** | 🟠 Medium — the engine exists; the novelty is the report format and the assistant hand-off |
| **Estimated Time** | 1–1.5 wks |
| **Prerequisites** | LIB-004 (import engine — built), SUB-004/005 (node catalog), SUB-006 (semantic validator), AIX-002 (authoring loop). All four exist. |
| **Recommended executor** | 🔵 **Fable 5** — the deliverable is a *contract* (what the report says, who consumes it) more than it is code. Implementation is Sonnet-tier once the format is settled. |
| **Created** | 2026-07-30, as the counterpart obligation to [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md) |

## Objective

Make "existing Noodl projects will not reliably import" an **honest** position rather than a
careless one. Convert what is mechanically convertible, report precisely what is not, leave the
unconvertible parts visible in the imported project, and hand the user's AI assistant enough
structured context to attempt the repair — or to say plainly that rebuilding is cheaper.

## Why this task exists

On 2026-07-30 the project took a standing decision
([`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md)): NodeGX is a fresh start,
legacy projects are not a design constraint, and the fallback for anything the importer cannot
handle is "the importing user's AI assistant fixes it, or they delete and rebuild it."

That decision buys the whole roadmap a great deal of speed. It also incurs exactly one debt: **the
fallback has to be real.** An assistant cannot repair what it was never told about, and a silent
drop is indistinguishable from a bug. Without this task, "the assistant will fix it" is a phrase
that lets us avoid work rather than a mechanism that works.

The reason it is credible at all is that the substrate already exists — the node catalog (SUB-004
/005) describes every node and port, the semantic validator (SUB-006) can tell a valid graph from
an invalid one, the authoring loop (AIX-002) can apply repairs as a reviewable diff, and the MCP
server (SUB-008) already exposes the project to an external agent. This task is the missing seam
between them, not a new capability.

## Current State

- **The engine is capable.** LIB-004's `analyze` / `plan` / `apply` is typed, three-stage, and
  reports per-item outcomes in `ImportResult`. LIB-005's `ImportFlow` surfaces it as
  Select → Review → Done. Both are code-complete with live-QA residuals.
- **But it was built for a different job.** All five flows it serves (prefab install, module
  install, import-from-project, import-from-URL, component export) move *NodeGX-shaped* content
  between projects. Collisions are its problem; **unconvertible legacy constructs are not a concept
  it has.**
- **Format migration is separate and done.** SUB-003 shipped the v1→v2 migration engine (wizard UI
  deferred). That converts the *file layout*. It does not evaluate whether the graph inside still
  means anything.
- **Nothing produces a machine-readable "what went wrong" artifact.** `ImportResult` reports what
  was added, skipped, or renamed — not what was lowered, approximated, or abandoned.

## Desired State

Opening a legacy Noodl project produces three things, always, even on a bad import:

1. **A project that opens.** Whatever converted is present and editable. Nothing is silently
   dropped; unconvertible nodes survive as visible, clearly-marked placeholders that carry their
   original type name and parameters, so neither the user nor an assistant has to consult the source
   file to know what was there.
2. **An import report**, written into the project, machine-readable and human-readable from the same
   source. Per item: what it was, what happened (`converted` / `converted-with-changes` /
   `placeholder` / `dropped`), why, and — where known — what the NodeGX equivalent would be.
3. **An assistant hand-off.** The report is addressed to an AI assistant as much as to a person:
   enough context, with catalog references, for it to attempt repairs through the authoring loop and
   present them as a reviewable diff. Including the honest verdict when there is one: *this project
   is small and 40% unconvertible; rebuilding it will cost you less than fixing it.*

## Scope

### In Scope
- [ ] **The report format.** One schema, both audiences. Decide where it lives in the project (a
      committed file, so it survives, and so a diff shows repairs landing against it).
- [ ] **Outcome taxonomy** — the four states above, defined precisely enough that two different
      converters classify the same construct identically.
- [ ] **Placeholder nodes.** A runtime node type that renders as a visible unconverted marker,
      carries `originalType` + original parameters, fails loudly rather than silently no-op'ing, and
      is caught by the semantic validator as an error the user must resolve.
- [ ] **A legacy-construct inventory**, derived from the register and the deprecated-node set: which
      constructs convert mechanically, which convert lossily, which cannot convert. This is the
      task's real research output and it should be committed as a table.
- [ ] **Mechanical conversions worth doing** — take them where the DSL is structured enough. NDA-011's
      REST → HTTP Request rewrite is the worked example and should land here or be referenced here.
- [ ] **Assistant hand-off path** — report → catalog-grounded context → authoring-loop diff. Wire it;
      do not merely document that it could be wired.
- [ ] **The rebuild verdict** — a computed, stated recommendation when conversion quality is poor.
- [ ] **A real legacy fixture.** At least one genuinely old project, converted end to end, with its
      report committed as the acceptance artifact.

### Out of Scope
- **Raising fidelity as a goal in itself.** Per the policy: no NodeGX improvement is blocked, and no
  legacy code path is maintained, to make a fidelity number look better. Convert what is cheap to
  convert; report the rest.
- **Guaranteeing the imported app runs.** Explicitly not promised.
- **Compatibility shims in the runtime.** A placeholder that fails loudly is the sanctioned
  mechanism. A shim that makes an old node keep working is not.
- **The v1→v2 file-layout migration** — SUB-003 owns that; this task consumes it.
- **An interactive repair UI of its own** — AIX-002's diff review is the surface.

## Implementation Steps

1. **Inventory first, code second.** Walk the node register and the deprecated set; classify every
   construct into the four outcomes. Commit the table. Expect this to change the shape of the rest.
2. Settle the report schema against that table — the taxonomy has to survive contact with real
   constructs before it is worth implementing.
3. Build the placeholder node; wire it into the semantic validator as an error class.
4. Extend the import path to emit the report and place placeholders. Reuse LIB-004's staging; do not
   fork the engine.
5. Take the mechanical conversions the inventory says are cheap.
6. Wire the assistant hand-off; prove it on the fixture by having an agent repair at least one
   real unconverted construct through the authoring loop.
7. Compute and present the rebuild verdict.

## Success Criteria

- [ ] A genuinely legacy project imports without crashing, and every construct in it is accounted
      for in the report — no silent drops, verified by diffing report coverage against the source
      inventory
- [ ] Unconverted constructs are visible on the canvas, carry their original type and parameters,
      and are flagged as errors by the semantic validator
- [ ] The report is committed into the imported project and is parseable by an agent without
      scraping prose
- [ ] An AI assistant, given only the report and the catalog, repairs at least one real unconverted
      construct and it arrives as a reviewable diff — demonstrated, not asserted
- [ ] The rebuild verdict fires on a project where it should, and does not on a clean import
- [ ] Nothing in this task added a compatibility shim to the runtime

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **The task quietly becomes a fidelity project.** The pull toward "just support this one more construct" is exactly the reflex the policy removes. | The inventory table is committed *first* and is the scope boundary. Additions to it need a reason that is not "it would import better." |
| The report is written for humans and an agent cannot use it (or vice versa). | One schema, both renderings, and criterion 4 is an agent actually consuming it. |
| Placeholders become a silent tolerance — projects ship with them. | Validator error class, not a warning. |
| No genuinely old project is available to test against. | Find one early; this is a step-1 blocker, not a step-7 surprise. If none can be found, say so plainly rather than substituting a synthetic fixture and calling it verified. |

## References

- [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md) — the decision this task is the counterpart to
- [LIB-004](./LIB-004-IMPORT-ENGINE.md) / [LIB-005](./LIB-005-IMPORT-UX.md) — the engine and surface being extended
- [SUB-003](../phase-13-format-ai-substrate/SUB-003-MIGRATION-AND-REAL-TESTS.md) — v1→v2 layout migration, consumed
- [SUB-006](../phase-13-format-ai-substrate/SUB-006-SEMANTIC-VALIDATOR.md) — where placeholders become errors
- [AIX-002](../phase-15-ai-collaboration/AIX-002-AUTHORING-LOOP.md) — the repair surface
- [NDA-011](../phase-30-node-library-audit/NDA-011-REST-TO-HTTP.md) — the worked mechanical-conversion example
