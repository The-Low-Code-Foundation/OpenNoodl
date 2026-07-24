# RUN-001: Runtime React 17 → 19 Migration

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RUN-001 |
| **Phase** | Phase 16 — Runtime & Deploy Health (Revival Track D) |
| **Priority** | 🟠 High |
| **Difficulty** | 🔴 Hard (backward compatibility across every existing user project) |
| **Estimated Time** | 4–6 weeks |
| **Prerequisites** | REV-003 (CI); coordinate with PLAT-003 |
| **Branch** | `task/run-001-runtime-react-19` |
| **Recommended executor** | 🟠 **Opus 4.8** — the React migration itself is well-documented, but the dual-runtime compatibility strategy touches every deployed app anyone has ever built. Sustained care about backward compatibility; the design doc already sets the direction. |

## Objective

Migrate the application runtime from React 17 to React 19 with a dual-runtime strategy and per-project opt-in, so existing deployed apps keep working while new ones get a current React.

## Background

Phase 1 migrated the *editor* to React 19. The **runtime** — the code that actually powers applications built with OpenNoodl — was left on React 17. Every app anyone has deployed with this tool renders on a React version that is now several years and two majors old.

This is a user-facing gap rather than an internal one. It affects what third-party React libraries an app can use, what performance characteristics it has, and how long deployed applications remain viable. It also blocks server-side rendering (RUN-002), because the SSR approach depends on React 19 capabilities.

The reason it was not done alongside the editor migration is the reason it needs care now: the editor is one application that the team controls and can fix, whereas the runtime is a contract with every project any user has ever built. A breaking runtime change can break applications the maintainers have never seen and cannot test.

The existing design document, `dev-docs/future-projects/PHASE-RUNTIME-REACT-19-MIGRATION.md`, anticipated exactly this and proposed the right answer: dual-runtime support with per-project opt-in and migration detection, under the principle "no one gets left behind." This task implements that design.

## Current State

> **Corrected 2026-07-24 — see [RUN-001-ASSESSMENT.md](./RUN-001-ASSESSMENT.md), which
> supersedes this section's original claims and carries the verified plan.**

- `packages/noodl-viewer-react` ships **vendored React 18.3.1 UMD files** (not 17) from
  `static/shared/`, loaded via `<script>` tags with webpack `externals` — there is no react
  npm dependency in the package. Upstream commit `1477a29` already half-migrated the source
  (createRoot/hydrateRoot entry, findDOMNode removal in the binding hub, lifecycle
  conversions) — unvalidated but sound.
- The source is already React 19-clean on every scannable axis except one `findDOMNode`
  (`src/highlighter.js:58`) and `react-draggable` missing `nodeRef` in `Drag.tsx`.
- **React 19 ships no UMD builds** — the real work is the delivery architecture. Feasibility
  of self-built global bundles is proven (assessment §2).
- The binding hub is `react-component-node.ts`, typed by PLAT-003 along with all of
  `src/nodes/`; 43 non-node `.js` files remain.
- `packages/noodl-viewer-cloud` uses **no React** — excluded, nothing to migrate.
- "Dual runtime" means **18.3.1 vs 19**, not 17 vs 19; deployed apps freeze their React at
  deploy time.

## Desired State

- New projects render on React 19 by default.
- Existing projects continue to work unchanged, either by remaining on React 17 or by opting in explicitly.
- The editor detects which runtime a project targets and offers migration with clear guidance.
- Both runtimes are buildable and testable in CI until React 17 support is eventually retired (a later decision, not this task).

## Scope

### In Scope
- [ ] Migrate `noodl-viewer-react` to React 19 (roots, lifecycle, refs, event handling, `StrictMode` behaviour)
- [ ] Dual-runtime build: produce both React 17 and React 19 runtime bundles
- [ ] Per-project runtime version setting, defaulting to 19 for new projects
- [ ] Detection and migration guidance in the editor for existing projects
- [ ] Compatibility testing across a corpus of real projects
- [ ] Documented list of behavioural differences users may encounter
- [ ] Cloud runtime (`noodl-viewer-cloud`) either migrated or explicitly deferred with reasoning

### Out of Scope
- Editor React work (already on 19)
- SSR (RUN-002 — this task only unblocks it)
- Rewriting node implementations beyond what migration requires
- Retiring React 17 support (a future decision once adoption data exists)

## Technical Approach

### Key areas of change

The migration's real work concentrates in the React binding hub, where the runtime creates roots, forces re-renders, manages refs, and measures DOM. React 19's changes around root APIs, ref handling, automatic batching, and strict-mode double-invocation are the categories most likely to surface behavioural differences.

**Automatic batching deserves specific attention.** Noodl's runtime has its own scheduling model — a dirty-flag system that batches updates per frame and calls into React to re-render. React 19's batching interacts with that, and the failure mode is subtle: not a crash, but updates landing in a different order or frame than before, which in a dataflow-driven app can change visible behaviour. Test signal-heavy and animation-heavy projects specifically.

### Dual-runtime strategy

Follow the design document. Practically: keep the runtime source single but build against two React versions, with compatibility shims isolated in as few files as possible. Resist the temptation to fork the runtime source — two divergent copies would be a maintenance liability far worse than a handful of version-conditional modules.

## Implementation Steps

1. **Coordinate with PLAT-003** on `noodl-viewer-react` file boundaries before starting.
2. **Assemble a compatibility corpus** — real projects covering visual layout, animation/transitions, data/query nodes, navigation, and signal-heavy logic. This corpus is the actual safety net; without it, "it works" is a guess.
3. **Migrate the binding hub** to React 19, isolating version-conditional code.
4. **Dual build** producing both runtime bundles from one source.
5. **Per-project runtime setting**, defaulting new projects to 19.
6. **Detection and migration guidance** in the editor for existing projects, including what might change.
7. **Run the corpus on both runtimes** and diff behaviour; investigate every difference rather than assuming it is benign.
8. **Document behavioural differences** for users.
9. **Decide on the cloud runtime** — migrate or defer with recorded reasoning.

## Testing Plan

- Compatibility corpus rendered on both runtimes, compared visually and behaviourally.
- Signal-ordering tests: projects with chained signals and rapid state changes, checking update ordering under React 19's batching.
- Animation and transition smoothness comparison.
- Preview-in-editor and deployed-build paths both exercised.
- Existing runtime tests green on both builds in CI.

## Success Criteria

- [ ] Runtime builds and runs on React 19
- [ ] Both runtime versions build from a single source; no forked copy
- [ ] New projects default to React 19; existing projects unaffected until they opt in
- [ ] Editor detects runtime version and offers guided migration
- [ ] Compatibility corpus behaves identically on both runtimes, or differences are understood and documented
- [ ] Behavioural-difference documentation published for users
- [ ] CI builds and tests both runtimes

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Silent behavioural changes break user apps the team never sees | The compatibility corpus is the mitigation and must be broad; opt-in rather than forced migration means users control their exposure |
| Batching interactions change update ordering subtly | Test signal-heavy projects explicitly; compare ordering, not just final state |
| Dual-runtime maintenance burden grows unbounded | Isolate version-conditional code to as few modules as possible; plan (but do not execute) a React 17 retirement once adoption data exists |
| Untyped runtime makes the migration error-prone | Coordinate with PLAT-003; migrating typed code is materially safer, so sequencing PLAT-003 first for the affected files is worth considering |

## References

- [`dev-docs/future-projects/PHASE-RUNTIME-REACT-19-MIGRATION.md`](../../future-projects/PHASE-RUNTIME-REACT-19-MIGRATION.md) — the design this implements
- [Viability report — §5 roadmap triage](../../reviews/NOODL-VIABILITY-REPORT.md)
- Related: RUN-002 (depends on this), PLAT-003 (file overlap)

## Checklist

- [ ] Branch `task/run-001-runtime-react-19`; agree boundaries with PLAT-003
- [ ] Assemble the compatibility corpus first
- [ ] Migrate the binding hub; isolate version-conditional code
- [ ] Dual build; per-project runtime setting
- [ ] Editor detection + migration guidance
- [ ] Corpus comparison on both runtimes; investigate every difference
- [ ] Publish behavioural-difference docs; decide on cloud runtime
- [ ] CHANGELOG; open PR
