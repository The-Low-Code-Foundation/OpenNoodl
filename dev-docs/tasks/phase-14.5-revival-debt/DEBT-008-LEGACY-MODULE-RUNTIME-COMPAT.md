# DEBT-008: Legacy ES5 Modules vs the Class-Based Runtime

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-008 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2–3 days |
| **Prerequisites** | None |
| **Recommended executor** | 🟠 **Opus 4.8** — the incompatibility is characterised, but the right response is a semantics decision (shim, or declare unsupported with detection) that needs the module ecosystem surveyed first |

## Objective

Decide — and implement — what NodeGX does about legacy Noodl modules written in ES5 constructor style, which crash against today's class-based runtime and currently make at least one real project fail to render, in the editor *and* in deploys.

## Background

SUB-009's live-preview spike found this with the 176-component `big-merge-test-mine` corpus project ([SUB-009-LIVE-PREVIEW-HARNESS.md](../phase-13-format-ai-substrate/SUB-009-LIVE-PREVIEW-HARNESS.md), lines ~204–213): the project loads, validates, and exports in 733 ms — **but does not paint**, because its bundled module `noodl_modules/se-topp-fovea` calls `Noodl.Collection.apply(this, arguments)` (ES5 Backbone-style inheritance) against `class Collection extends Array` in `noodl-runtime/src/collection.js`. ES2015 class constructors throw when invoked without `new` — so the module's constructor chain dies. The docs verified this is **pre-existing, not a spike artifact**: `deployToFolder` fails identically.

Two aggravating facts. First, `Collection extends Array` with a patched prototype is *load-bearing* (PLAT-003 established this) — "just un-class it" is not on the table. Second, any old Noodl project that bundled community modules from the Backbone-inheritance era carries this pattern; the corpus project is unlikely to be alone, and "revive abandoned Noodl projects" is close to the product's pitch.

## Implementation Steps

1. **Survey the blast radius.** Grep available corpus/legacy projects' `noodl_modules/` for `.apply(this`, `.call(this` against runtime exports (`Collection`, `Model`, etc.). Determine whether this is one module's pattern or the era's standard idiom (it was Backbone-style — expect the latter).
2. **Decide between:**
   - **(a) Compat shim** — make the affected runtime exports callable without `new` (e.g. a wrapper that detects non-constructor invocation and routes through `Reflect.construct`, preserving the class internally). Transparent to old modules; small permanent complexity tax on core types.
   - **(b) Declare unsupported, but loudly** — detect the ES5-invocation crash at module load, and surface an actionable diagnostic ("module X uses a legacy API style; needs porting") in the editor and the SUB-006 Problems panel, instead of a silent blank render.
   - Recommend (a) for `Collection`/`Model` specifically if the survey shows the idiom is widespread — a blank canvas with no error is the worst outcome for the revive-old-projects story; (b) is the floor either way (the shim can't cover every pattern).
3. Implement; add a characterisation test that constructs a Collection both ways (`new` and ES5 `.apply`).
4. **Acceptance check:** `big-merge-test-mine` paints in the editor preview and via `deployToFolder` — or, under (b), fails with the diagnostic clearly pointing at the module.

## Success Criteria

- [ ] Blast-radius survey recorded (which patterns, how common)
- [ ] Decision recorded with rationale (this doc + PROGRESS)
- [ ] The corpus project renders, or fails with an actionable module-compat diagnostic — never a silent blank
- [ ] Characterisation tests for the chosen behaviour; runtime jest baseline not worsened
- [ ] `catalog:check` unaffected

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The shim subtly changes `Collection` semantics for modern callers | The Array-patching behaviour is load-bearing and tested; run the full runtime suite plus PLAT-003's gates. The shim wraps construction only, never the prototype |
| The survey finds a long tail of incompatible idioms beyond construction | Don't chase the tail — shim the construction pattern (the crash actually observed), diagnostic for the rest |

## References

- [SUB-009-LIVE-PREVIEW-HARNESS.md](../phase-13-format-ai-substrate/SUB-009-LIVE-PREVIEW-HARNESS.md) — discovery record
- `packages/noodl-runtime/src/collection.js`; PLAT-003-NOTES on why the Array patch is load-bearing
- Related: DEBT-002 (uses the same corpus project for its large-project checks — coordinate so it renders first, or scope DEBT-002 around it)
