# PLAT-006: Ship Type Declarations from @noodl/runtime

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PLAT-006 |
| **Phase** | Phase 14 — Editor Platform Health (Revival Track B) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟠 Medium (small volume, one genuinely hard module-resolution decision) |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | PLAT-003 (complete — this task is its named residual) |
| **Branch** | none — work lands on `cline-dev` directly |

## Objective

Make `@noodl/runtime` resolvable through *declarations* rather than sources, so that
`noodl-viewer-react`'s TypeScript program stops compiling runtime `.ts` files it imports —
which is the one thing blocking the conversion of the runtime's last seven `.js` modules.

## Background

PLAT-003 finished with `noodl-runtime/src` at 8 `.js` / 117 `.ts`. Seven of those eight are
not unconverted for volume reasons — they were **converted, typechecked clean, and reverted**
(or deliberately not attempted) because of the module boundary described in
[PLAT-003-NOTES §29.1–29.2](./PLAT-003-NOTES.md):

- `noodl-viewer-react` compiles at `module: es6` with `allowJs: false`. A runtime `.js`
  file it imports is never in its program; **converting that file to `.ts` is what puts it
  there.** Inside that ESM program, `export =` / `import = require()` are errors (`TS1202`)
  and the runtime's ambient `src/globals.d.ts` is out of scope (`TS2304`).
- The seven affected modules — `model`, `collection`, `javascriptnodeparser`,
  `api/cloudstore`, `api/records`, `api/configservice`, `api/cloudfile` — are each
  ESM-imported from react-viewer `.ts` files (`uploadfile`, `userservice`, `cloudfunction`,
  two `nodes-deprecated` files, `color.ts`'s neighbours).

Of §29.2's three ways out, option 2 — declarations from `@noodl/runtime` — was recommended
and is this task. Option 1 (pure-ESM rewrites) breaks every plain-JS `require()` consumer;
option 3 (react viewer to CommonJS) has the largest blast radius (tree-shaking, SSR build).

The eighth `.js` file, `src/events.js` (vendored Joyent EventEmitter), is **out of scope
permanently**: PLAT-003 closed it as keep-as-vendored-JS — third-party code whose value per
line of conversion is zero and whose risk is not, the same reasoning that kept
`register-nodes.js` in JavaScript.

## Current State

- `packages/noodl-runtime/package.json` has **no `types` field and no build step** —
  `main` points straight at `noodl-runtime.js` (source), and four packages consume the
  sources directly (react viewer, cloud viewer, nodegx-backend via esbuild, the editor's
  catalog build).
- `noodl-runtime.js` itself is untyped, and its constructor-assigned
  `NoodlRuntime.instance` is invisible to `.js` inference — ~10 converted files work
  around it with a bare `const NoodlRuntime = require(…)` ([NOTES §29.4](./PLAT-003-NOTES.md)).

## Desired State

- The react viewer's `tsc` program resolves runtime imports to declarations, not sources.
- The seven blocked modules convert to `.ts` with the runtime's own conventions
  (`export =`, ambients) without breaking the viewer program or any bundle.
- `noodl-runtime.js` is either converted or covered by a hand-written declaration that
  names `NoodlRuntime.instance`, retiring the bare-require workaround.

## Scope

### In Scope
- [ ] Decide and implement the resolution mechanism (see the constraint below)
- [ ] Convert the seven blocked modules
- [ ] Type the package entry point (`noodl-runtime.js` / its declaration)
- [ ] Re-run the full PLAT-003 gate set: `catalog:check` byte-identical, runtime jest,
      viewer/deploy/ssr/cloud production bundles, nodegx-backend build + tests +
      `check:persistence`, live editor pass

### Out of Scope
- `src/events.js` (kept as vendored JavaScript, permanently)
- `register-nodes.js` in the viewer (the CJS/ESM bridge — NOTES §27.4)
- Raising `strict` anywhere

## The hard part, stated up front

**Do not assume sibling `.d.ts` files solve this.** When both `foo.ts` and `foo.d.ts` exist
next to each other, `tsc` prefers the `.ts` — so emitting declarations beside the sources
changes nothing for a viewer program that reaches them by relative-into-package paths
(`@noodl/runtime/src/…` resolves into the workspace-linked source tree). The mechanism that
actually works has to make the *viewer's program* see declarations instead of sources, and
the candidates differ in blast radius:

1. A `types`/`typesVersions`/`exports` map in the runtime's package.json that points
   type resolution at a generated `dist-types/` tree while `main` keeps pointing at source
   (every bundler consumes sources today and must continue to).
2. `paths` mappings in the viewer's tsconfig redirecting `@noodl/runtime/src/*` to a
   declarations tree.
3. Excluding `../noodl-runtime` from the viewer's program and relying on ambient module
   declarations.

Prototype against the real failing case first: convert `api/configservice.js` (the
smallest of the seven), run the **viewer production bundle**, and count `[tsl] ERROR`
lines. The `typecheck:viewer` gate alone cannot see this class of error (NOTES §29.6
trap 1) — the prod bundle is the gate that decides.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Declarations drift from sources | Generate them (`tsc --emitDeclarationOnly`) rather than hand-writing; wire into CI |
| Bundlers accidentally resolve `dist-types` | `main`/bundler fields untouched; verify all five bundle outputs byte-behave (catalog:check, prod bundles) |
| The mechanism works for tsc but not ts-jest | The viewer's jest compiles runtime imports at a pre-ES2015 target (PLAT-003 slice 14 hit TS2802 three times); run the viewer jest suite against the converted modules |

## References

- [PLAT-003-TYPE-THE-RUNTIME.md](./PLAT-003-TYPE-THE-RUNTIME.md) — the parent task
- [PLAT-003-NOTES.md](./PLAT-003-NOTES.md) — §29.1 (the export rule), §29.2 (the reverted
  conversions and the three options), §29.4 (the untyped entry point), §31 (final state)
