# LIB-003: Module Audit, Hygiene & Expansion

## Metadata

| Field | Value |
|-------|-------|
| **ID** | LIB-003 |
| **Phase** | Phase 21 — Library & Import Overhaul |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 1–1.5 wks |
| **Prerequisites** | LIB-001 (tracked sources + pipeline). Step 0 has no prerequisites. |
| **Recommended executor** | 🟠 **Opus 4.8** — module authoring requires runtime-registration understanding plus judgment about what's worth adding; the hygiene half is Sonnet-shaped if split. |

## Objective

The existing modules verifiably work end to end (install → inject → register → nodes usable), the module-loading plumbing loses its known bug and its duplicate scanner, and the library grows by a small set of high-leverage UI/utility modules — explicitly **not** an integration library.

## Background

Modules are zips of Noodl projects whose `noodl_modules/<name>/` folders (a `manifest.json`, usually an `index.js`) get copied into the target project. Registration is presence-on-disk; at preview/deploy time `ProjectModules.injectIntoHtml` writes script/style tags into the HTML, the module calls `Noodl.defineModule(...)`, and the viewer registers its nodes ([projectmodules.js](../../../packages/noodl-editor/src/shared/utils/projectmodules.js) → [viewer.jsx:152–164](../../../packages/noodl-viewer-react/src/viewer.jsx) → [noodl-runtime.js:213–223](../../../packages/noodl-runtime/noodl-runtime.js)).

The plumbing has known defects: the `startsWith['http']` property-access bug (projectmodules.js:47) means http dependency URLs get path-prefixed; two parallel scanners exist (`shared/utils/projectmodules.js` and `projectmodel.modules.ts`, whose own line 5 asks "can we merge this?"); manifests are unvalidated, so a malformed one fails silently downstream.

The RUN-001 React 19 work matters here: module `index.js` files ship compiled against the global React the viewer exposes; every module must be verified on both runtime pairings.

## Current State

- Live module inventory unknown until fetched (step 1); the only in-repo modules are the template's manifest-only `material-icons` iconset and test fixtures.
- No manifest schema, no typed loading, no validation, no versioning.
- Modules have no catalog presence: nodes a module registers are invisible to SUB-004's catalog and therefore to the validator and the AI authoring stack (they fall into the dynamic-node "skip port checks" path at best).

## Desired State

- **Step 0 (anytime fix):** `projectmodules.js:47` fixed, with a regression test covering http and local dependency paths.
- One scanner: `projectmodel.modules.ts` and `shared/utils/projectmodules.js` merged into a single typed implementation with one manifest type, used by editor model, web server, deploy processor, and headless preview alike.
- Manifest schema (typed + runtime-validated): loading a project with a malformed module manifest surfaces a warning naming the module, never a silent skip.
- Every live module audited: installs, injects, registers, nodes function on both React pairings; broken ones fixed or retired with a recorded reason.
- Module-authoring documented: `library/modules/README.md` covering manifest fields, `defineModule`, `runtimes`, the iconset type, and the dev loop.
- **Expansion set** (new modules, tracked in `library/modules/`, each with catalog entries for its nodes where the node shape is static): shortlist decided in-task from this candidate pool, target 3–5 shipped —
  - charts (one good charting module beats five bad ones),
  - markdown renderer,
  - Lottie/animation player,
  - QR code (render and/or scan),
  - an icon set beyond Material (Lucide or similar, via the existing `iconset` manifest type),
  - confetti/celebration micro-interactions (cheap, high delight for the education wedge).
  Constraint: nothing requiring API keys or a backend — that's the permanently-parked integration library.

## Scope

### In Scope
- [ ] Step 0 fix + test, shipped independently
- [ ] Scanner unification + manifest schema/validation (loud failures)
- [ ] Live-module audit with recorded outcomes; fixes or retirements
- [ ] Both-pairings verification per module (RUN-001 matrix)
- [ ] Expansion shortlist decision recorded in PROGRESS.md, then 3–5 modules authored, each: manifest, source, catalog entries (static-shape nodes), verified live in preview **and** in a deploy build
- [ ] Authoring docs

### Out of Scope
- A module SDK/CLI or npm-based distribution — the folder+manifest format stays
- Backend/integration modules of any kind
- Sandboxing or trust review of module JS — real, but it's ECO-002's hardest question, not solvable in a sprint
- Runtime `registerModule` API changes

## Implementation Steps

1. Step 0 fix; ship.
2. Fetch the live module index; audit table with triage.
3. Unify the scanners behind one typed module (start from the TS one, absorb the JS one's inject logic); manifest validation; update the four call sites (web-server, html-processor, noodl-preview loader, project model).
4. Work the audit list; fix or retire.
5. Expansion: record the shortlist decision, then author modules one at a time — manifest, implementation, catalog entries, live verification in preview and deploy.
6. Docs; full `library:build` + publish via LIB-001.

## Success Criteria

- [ ] `startsWith` bug fixed with a test; http-URL module dependencies inject as URLs
- [ ] One scanner implementation; all four consumers on it; existing behavior verified (deploy build of a module-using project works)
- [ ] Malformed manifest produces a visible, named warning
- [ ] 100% of pre-existing modules audited; every kept module verified on both React pairings
- [ ] 3–5 new modules shipped, each verified in preview and deploy, static-shape nodes present in the catalog
- [ ] `catalog:check` (the regression gate) stays green

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Scanner unification breaks deploy HTML injection subtly | The inject output is deterministic — snapshot-test `injectIntoHtml` before refactoring, diff after |
| Module JS incompatible with React 19 globals | RUN-001's pairing delivery defines the target; verify per pairing, pin `runtimes`/compat metadata where a module can't span both |
| Catalog entries for module nodes fight the dynamism detection | Only static-shape nodes get entries; dynamic ones stay in the skip path — same policy SUB-004 already established |
| Expansion scope-creeps toward integrations | The candidate pool is the menu; anything needing keys/backends is auto-rejected by the in-task constraint |

## References

- [README.md](./README.md) — loader/injection data flow with file:line map
- LIB-001 (pipeline), RUN-001 (React pairings), SUB-004 (catalog, dynamism policy)
- `packages/noodl-editor/tests/testfs/import_proj5/` — real code-module fixtures (manifest + index.js shape)
