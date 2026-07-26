# SUB-012: Duplicate node ids pass both project validators

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-012 |
| **Phase** | Phase 13 — Format & AI Substrate |
| **Priority** | 🟠 High — a corrupt project validates clean today |
| **Difficulty** | 🟢 Low |
| **Estimated Time** | Half a day |
| **Found by** | AIX-005, 2026-07-27, while hand-authoring `project-examples/agent-chat` |
| **Recommended executor** | 🟢 **Sonnet 5** — the rule is unambiguous and mechanically verifiable |

## The defect

A project containing two nodes with the same `id` passes **both** validators:

- `scripts/node-catalog/validate-project.js`
- the SUB-006 `SemanticValidator`, in strict mode (0 errors, 0 warnings)

Both build a `Map<id, node>` while indexing. The second node with a given id silently displaces the first, so the duplicate is not merely unreported — it is erased from the validator's own view of the project, which is why every downstream check also passes.

This was hit for real: the AIX-005 example project was authored by hand, contained a duplicated id, and validated clean through both gates. It was found by observing wrong behaviour, not by any tool.

## Why it matters more than it looks

Node ids are the substrate's primary key. Phase-13's whole premise is that the graph is a legible, checkable artifact, and several shipped systems assume id uniqueness:

- SUB-007's graph diff keys changes by node id; a duplicate makes a diff quietly wrong rather than failing.
- AIX-003's review closures (`requires`/`excludedWith`) are id-keyed, so an invalid partial accept could become representable.
- AIX-002's authoring loop generates ids; the id-keeping behaviour of update mode depends on them being unique.
- MCP's id-backfill path assumes it.

A validator that cannot see a duplicate id is therefore not a small gap in coverage — it is a hole under the assumption every id-keyed feature rests on.

## Scope

### In Scope
- [ ] A uniqueness rule in the SUB-006 `SemanticValidator`, reported as an **error** (not a warning): a duplicate id is never intentional
- [ ] The same rule in `validate-project.js`, so both gates agree
- [ ] Report **both** offending nodes and their component paths — "id X is duplicated" without locations is not actionable in a 262-node project
- [ ] Detect during indexing, before the `Map` swallows the collision
- [ ] Specs: duplicates within one component, across two components, and a three-way collision
- [ ] Run the rule over the existing corpus and `project-examples/`, and fix anything it finds

### Out of Scope
- Auto-repair or id reassignment — report, do not rewrite; the safe fix depends on which node is the intended one
- Connection endpoint validation (already covered)
- Any change to how ids are generated

## Success Criteria

- [ ] Both validators reject a duplicate id, with both locations named
- [ ] The corpus and every project under `project-examples/` pass
- [ ] A spec proves the collision is caught *during* indexing, so it cannot be masked by map displacement
- [ ] `npm run catalog:validate` and the SUB-006 strict path agree on the same project

## References

- `dev-docs/tasks/phase-15-ai-collaboration/aix005-notes/EXAMPLE-AND-DOCS.md` — where this was found
- `scripts/node-catalog/validate-project.js`
- SUB-006 (semantic validator), SUB-007 (graph diff — the id-keyed consumer most at risk)
