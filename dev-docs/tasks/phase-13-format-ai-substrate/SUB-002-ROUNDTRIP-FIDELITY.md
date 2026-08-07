# SUB-002: Round-Trip Fidelity & Golden Fixtures

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-002 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Priority** | 🔴 Critical (data safety) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | REV-002 (tests must run) |
| **Branch** | `task/sub-002-roundtrip-fidelity` |
| **Recommended executor** | 🟢 **Sonnet 5** — the defects are identified and the fix is mechanical (carry four dropped fields, add whole-object assertions, build fixtures). Verification is objective: deep-equal passes or it does not. |

## Objective

Close the known data-loss gaps in the v2 export/import round trip and replace synthetic-only test coverage with whole-object equality assertions over golden fixtures taken from real projects.

## Background

The v2 format engines are well tested by count — roughly 149 tests across exporter, importer, and detector, none skipped, with genuine value assertions rather than smoke tests. But the coverage has a specific and dangerous shape: **every fixture is synthetic**, built by small helper factories inside the test files, and **no test asserts whole-object equality** of a round-tripped project against the original. Each test checks one field at a time.

The consequence surfaced during the viability assessment: several fields are silently dropped by the exporter and no test catches it, because no fixture ever sets them. Graph `comments` and `visualRoots` are read into the legacy model but never written to the component files, and the importer reconstructs graphs from roots and connections only. Project-level `lesson` and `rootNodeId` are likewise not carried through.

Today this is harmless, because nothing in the application uses the v2 writer. The moment SUB-001 wires it into the save path, it becomes silent user data destruction — a user's comments vanish from their project on first save. This task must therefore land **before or with** SUB-001, and it is the reason the phase README lists it as a hard gate.

## Current State

- `packages/noodl-editor/src/editor/src/io/ProjectExporter.ts` — the legacy graph type includes `comments` and `visualRoots`, but the functions that build `nodes.json` and `connections.json` never read them.
- `packages/noodl-editor/src/editor/src/io/ProjectImporter.ts` — component reconstruction rebuilds the graph object with roots and connections only.
- Project-level `lesson` and `rootNodeId` are present on the legacy project type but not emitted by the exporter.
- `packages/noodl-editor/tests/io/` — `ProjectImporter.test.ts` (55 specs, ~18 round-trip), `ProjectExporter.test.ts` (68), `ProjectFormatDetector.test.ts` (26). All inputs come from local `makeProject` / `makeComponent` / `makeNode` helpers; the round-trip helper feeds exporter output straight back into the importer.
- No fixture directory of real project data exists anywhere in the repo.

## Desired State

- Every field of a real project survives export → import unchanged, verified by whole-object deep equality.
- A golden fixture corpus of real projects (small, medium, large, and awkward) lives in the repo and is exercised by CI.
- Any future field added to the project model that the exporter forgets to carry causes a test failure rather than silent loss.

## Scope

### In Scope
- [ ] Carry `comments` and `visualRoots` through export and import
- [ ] Carry project-level `lesson` and `rootNodeId`
- [ ] Audit **every** field of the legacy project/component/graph types for carriage; fix all gaps found
- [ ] Add `expect(roundTrip(project)).toEqual(project)` whole-object assertions
- [ ] Build a golden fixture corpus from real projects (anonymised if needed)
- [ ] Add a guard test that fails when a project-model field is not represented in the v2 schemas
- [ ] Exercise the awkward cases the current fixtures never set: dynamic ports, variants, state transitions, conflicts, metadata, deep component nesting

### Out of Scope
- Editor integration (SUB-001)
- Migration UI (SUB-003)
- Schema redesign — this task preserves fidelity within the existing format rather than changing it

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `.../io/ProjectExporter.ts` | Emit `comments`, `visualRoots` in the component files; emit `lesson`, `rootNodeId` at project level |
| `.../io/ProjectImporter.ts` | Reconstruct those fields on import |
| `.../schemas/*.schema.json` | Add the corresponding field definitions with descriptions |
| `packages/noodl-editor/tests/io/*.test.ts` | Whole-object round-trip assertions; fixture-driven cases |

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-editor/tests/io/fixtures/` | Golden real-project corpus (v1 inputs + expected v2 outputs) |
| `packages/noodl-editor/tests/io/roundtrip-fidelity.test.ts` | Whole-object equality suite over the corpus |

## Implementation Steps

1. **Field audit first.** Enumerate every property on the legacy project, component, and graph types and mark whether the exporter emits it and the importer restores it. This audit is the real deliverable; the code fixes follow from it. Record it in NOTES.md as a table.
2. **Fix the identified gaps** — the four known fields, plus anything the audit surfaces.
3. **Build the fixture corpus.** Take real projects (Richard's own, plus any sample/template projects in the repo). Include at least: a trivial project, a project with comments and visual roots, one with variants and state transitions, one with dynamic-port nodes (Function/Expression), and one large enough to be interesting (100+ components if available).
4. **Whole-object round-trip suite** over every fixture. Where key ordering causes spurious failures, normalise deliberately and document why — do not weaken the assertion to make it pass.
5. **Add the drift guard**: a test that reflects over the project model's fields and fails if one is absent from the schemas, so future additions cannot silently escape the format.
6. **Re-run the existing 149 tests** to confirm no regressions.

## Testing Plan

- Whole-object equality for each golden fixture.
- Targeted specs for each previously-dropped field, so a regression names the field rather than reporting an opaque object diff.
- Negative test: remove a field from the exporter deliberately and confirm the suite fails clearly.

## Success Criteria

- [ ] Field audit table complete and recorded
- [ ] `comments`, `visualRoots`, `lesson`, `rootNodeId` — and any other gaps found — carried through
- [ ] Whole-object `toEqual` round-trip passes for every golden fixture
- [ ] Golden fixture corpus committed and used in CI
- [ ] Drift guard test in place
- [ ] All pre-existing io tests still pass

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Real projects contain private or licensed content | Anonymise fixtures; strip assets; keep only structure |
| Whole-object equality is brittle over key ordering | Normalise ordering explicitly with a documented comparator; never relax the assertion to hide a real difference |
| The audit finds far more gaps than expected, expanding scope | That is a finding, not a failure — it strengthens the case for this task gating SUB-001. Report it and, if needed, split the long tail into a follow-up |
| Fixtures go stale as the model evolves | The drift guard test is precisely the mitigation |

## References

- [Viability report — §4.2 and Appendix G](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track A](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Related: SUB-001 (must not ship without this), SUB-003 (migration relies on fidelity)

## Checklist

- [ ] Branch `task/sub-002-roundtrip-fidelity`
- [ ] Complete and record the field audit
- [ ] Fix all carriage gaps in exporter/importer/schemas
- [ ] Build the golden fixture corpus
- [ ] Whole-object round-trip suite passing
- [ ] Drift guard test added
- [ ] CHANGELOG; open PR (flag to SUB-001 owner that the gate is clear)
