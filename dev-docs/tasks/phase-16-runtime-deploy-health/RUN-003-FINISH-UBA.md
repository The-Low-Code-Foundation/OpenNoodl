# RUN-003: Finish the Universal Backend Adapter

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RUN-003 |
| **Phase** | Phase 16 — Runtime & Deploy Health (Revival Track D) |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–5 weeks |
| **Prerequisites** | REV-001 |
| **Branch** | `task/run-003-finish-uba` |
| **Recommended executor** | 🟢 **Sonnet 5** — the architecture exists and works; this is end-to-end testing, a reference implementation, and a second adapter following an established pattern. Escalate to Opus if the Supabase adapter reveals gaps in the abstraction. |

## Objective

Take the Universal Backend Adapter from "built" to "dependable": end-to-end tested against a real backend, with a reference implementation and a second adapter proving the abstraction generalises.

## Background

"How do I hook up my backend?" is, according to `dev-docs/future-projects/NATIVE-BAAS-INTEGRATIONS.md`, the single most common question new OpenNoodl users ask. The Universal Backend Adapter was the answer: a config-driven system that lets the editor understand any backend's schema and generate appropriate data nodes and property UI, rather than hard-coding support for one service.

The February 2026 sprint delivered essentially all of it — UBA-001 through UBA-009 covering the type system, schema parser, eight field renderers, the configuration panel, an HTTP+SSE client, the panel UI, sidebar registration, and a health indicator, with tests. (The top-level phase-6 tracker still says 0%, which is wrong; REV-006 corrects that record.)

What is missing is the part that converts an architecture into a usable feature: nobody has proven it works end to end against a real backend. There is no reference implementation a user can copy, no second adapter demonstrating the abstraction is genuinely universal rather than accidentally shaped around one service, and no end-to-end test. A backend adapter system that has never been pointed at a backend is a hypothesis.

This is finishing work with a high value-to-effort ratio, and it is independent of the other tracks — good work to run in parallel.

## Current State

- `dev-docs/tasks/phase-6-uba-system/` — UBA-001…006 documented; per-developer progress notes record UBA-001…009 complete as of the 2026-02-18 sprint.
- Delivered: UBA types, `SchemaParser`, eight field-type renderers, `ConfigPanel`, `UBAClient` (HTTP and server-sent events), `UBAPanel`, sidebar registration, backend health indicator, plus tests.
- Remaining per the phase notes: **UBA-010 end-to-end test**, a **reference backend** (Directus is the documented candidate), and community/marketplace sharing of adapter configurations.
- No adapter has been verified against a live backend.
- `NATIVE-BAAS-INTEGRATIONS.md` proposes schema-aware nodes ("pick a table, see the fields") mirroring the existing Parse node experience, estimating 2–4 weeks per backend.

## Desired State

- A user can point OpenNoodl at a Directus instance, see their real collections and fields, and build against them without writing configuration by hand.
- A second backend (Supabase) works through the same mechanism, proving the abstraction generalises.
- End-to-end tests run against real backend instances in CI (containerised).
- Adapter configurations are shareable, so the community can add backends without core changes.

## Scope

### In Scope
- [ ] UBA-010: end-to-end test suite against a real containerised backend
- [ ] Directus reference adapter, fully working and documented
- [ ] Supabase adapter as the generalisation proof
- [ ] Schema-aware node experience per `NATIVE-BAAS-INTEGRATIONS.md` (pick a table, see the fields)
- [ ] Adapter configuration sharing (export/import a config; a full marketplace is ECO-002)
- [ ] Documentation: connecting a backend, and writing a new adapter
- [ ] Fix whatever the first real-backend contact breaks — expect something

### Out of Scope
- A marketplace UI for adapters (ECO-002, Phase 20)
- Backend hosting (ECO-004)
- Migrating the existing Parse integration onto UBA (possible later; not now)
- More than two adapters — two proves generality; the rest is community work

## Technical Approach

### Method

Start with the end-to-end test, not the adapter. Standing up a containerised Directus and driving the existing `UBAClient` against it is the fastest way to discover what the untested code actually does, and everything after benefits from that harness existing.

Then build Directus as the reference: complete, documented, and treated as the example every future adapter is written against. Only then attempt Supabase — and treat any awkwardness there as **feedback about the abstraction**, not merely as Supabase-specific work. A second adapter that requires bending the framework is telling you something important about UBA-001's design, and recording that is more valuable than quietly working around it.

## Implementation Steps

1. **Containerised backend harness** — Directus in Docker, seeded with a schema covering the interesting cases (relations, enums, files, timestamps, permissions).
2. **UBA-010 end-to-end tests** driving `UBAClient` and `SchemaParser` against it. Fix what breaks; the first real contact usually breaks something.
3. **Complete the Directus adapter** including schema discovery, all eight field types, and the health indicator against a real instance.
4. **Schema-aware node UX** — table/collection picker showing real fields, mirroring the Parse node experience users already know.
5. **Supabase adapter**, recording every place the abstraction resists.
6. **Adapter config export/import.**
7. **Documentation**: user-facing (connect your backend) and developer-facing (write an adapter), with Directus as the worked example.

## Testing Plan

- End-to-end against containerised Directus in CI: schema discovery, CRUD, relations, error handling, auth.
- Same suite against containerised Supabase.
- Field-renderer coverage: all eight types against real schema data.
- Failure modes: backend unreachable, credentials wrong, schema changed underneath — the health indicator should reflect reality.
- Manual: connect to a real hosted instance of each and build a small CRUD page.

## Success Criteria

- [ ] End-to-end tests pass against containerised Directus and Supabase in CI
- [ ] Directus adapter complete, documented, and usable as the reference
- [ ] Supabase adapter working through the same abstraction
- [ ] Any abstraction limitations found during the second adapter are recorded
- [ ] Schema-aware node experience implemented
- [ ] Adapter configs exportable/importable
- [ ] Both user and adapter-author documentation published

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| First real-backend contact reveals significant gaps | Expected — step 2 is scheduled early precisely so discovery happens before the estimate is committed elsewhere |
| The abstraction turns out to be Directus-shaped | Supabase is the test; record resistance rather than working around it silently |
| Containerised backends make CI slow or flaky | Run end-to-end tests on a nightly schedule rather than every PR if needed |
| Auth models differ enough between backends to leak into the abstraction | Address explicitly during the Supabase adapter; document the supported auth patterns |

## References

- [`dev-docs/tasks/phase-6-uba-system/`](../phase-6-uba-system/) — UBA-001…009 (built) and remaining tasks
- [`dev-docs/future-projects/NATIVE-BAAS-INTEGRATIONS.md`](../../future-projects/NATIVE-BAAS-INTEGRATIONS.md)
- [Viability report — §5 (UBA is further along than its tracker says)](../../reviews/NOODL-VIABILITY-REPORT.md)
- Related: REV-006 (corrects the phase-6 progress record), ECO-002 (marketplace)

## Checklist

- [ ] Branch `task/run-003-finish-uba`
- [ ] Containerised Directus harness with a rich seed schema
- [ ] UBA-010 end-to-end tests; fix what first contact breaks
- [ ] Complete and document the Directus reference adapter
- [ ] Schema-aware node picker UX
- [ ] Supabase adapter; record abstraction resistance
- [ ] Config export/import; both documentation sets
- [ ] CHANGELOG; open PR
