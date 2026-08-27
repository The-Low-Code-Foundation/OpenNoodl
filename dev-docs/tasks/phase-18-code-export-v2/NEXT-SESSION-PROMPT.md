# Next session — EXP-002, step 4: the visual-node generator

**Where the phase stands (2026-08-27).** EXP-002 began. Steps 1–3 of its implementation plan are
done and committed:

1. **IR designed** — [EXP-002-IR-DESIGN.md](./EXP-002-IR-DESIGN.md). Graph IR + manifest are the
   shared contract (EXP-003/005/006/007 requirements traced clause by clause); Emit Plan stays
   EXP-002-internal. Determinism rules D1–D7. Identity is adopted, never minted (node ids,
   GraphSnapshot connectionKey, `Pages/Landing` paths).
2. **Target output hand-written** — [EXP-002-TARGET-OUTPUT.md](./EXP-002-TARGET-OUTPUT.md), from
   the real v2 project **Puppy test 3**. PuppyCard + Landing in full, plus the decision table
   (style extraction, naming, stubs, routing, deps-computed-from-output). Headline: the whole
   project exports with **zero `@nodegx/core` imports** — the library is earned per-construct.
3. **Walking skeleton** — `packages/nodegx-export` (new, self-contained, hoisted jest/tsc only, no
   root `npm install` needed). `src/ir/types.ts` (the contract in code), `src/parse/parseProject.ts`
   (v2 → Graph IR, catalog-resolved), `src/emit/scaffold.ts` (tokens.css, route table from
   Router+`urlPath` join, placeholder pages, Vite config), 16 tests over the fixture copy of Puppy
   test 3 (`tests/fixtures/puppy-test-3/`). Proof ran: `scripts/emit-scaffold.ts` → emitted app →
   `npm install && npm run build` → clean dist. Run tests from the package dir:
   `../../node_modules/.bin/jest` (and `tsc --noEmit`).

**What the fixture already taught (don't relearn):**
- A node can be **id + position only** (editor debris in `Pages/Admin Login`). Parse never fails on
  content: empty type → `catalogRef: null` → analysis dispositions it `unknown-type`.
- The For Each **mapping script usually isn't in `parameters`** — the identity `map({...})` lives
  as the *declared port's default*. The effective-mapping rule must consult port defaults.
- Component paths keep the `#` namespace: the home page is `#__page__/Home`.
- Catalog: `isSignal` on ports; `dynamicPorts.mechanisms` drives `portKnowledge`
  (`JavaScriptFunction`/`Javascript2` → `unknown`; other non-null → `partial`).

**Next: implementation step 4 — visual-node generator + style extraction**, the largest single
block of value. Concretely:
- An analysis stage that walks a component's visual tree (`Page`/root node down `children`),
  assigns dispositions, and plans one component file + one CSS module per component.
- The per-node content-vs-style parameter split, catalog-driven (TARGET-OUTPUT §1 settles the
  semantics: `sizeMode`, `clip`→`overflow`, `boxShadow*` folding, radius folding, shorthands,
  dimension objects, token passthrough).
- Class naming per TARGET-OUTPUT: camelCased node id, editor dedup suffixes stripped when
  unambiguous, identical style sets merged (longest common suffix, else first id).
- Component instances (`/Components/PuppyCard`) → imports + props from `Component Inputs` ports;
  `Component Inputs` → typed props interface.
- Target the golden test: generated `PuppyCard.tsx`/`.module.css` should match TARGET-OUTPUT §1
  closely enough that a diff is a design conversation, then the emitted app should *render* the
  card grid (For Each identity mapping + the `fetchPuppies` stub can land with it or next).
- **ts-morph + Prettier are not yet in the repo** — the skeleton emits via template strings.
  Adding them needs a root `npm install`; coordinate that (shared checkout — announce, don't
  surprise peers). Until then, template-string emission + Prettier-compatible formatting is fine;
  the AST pipeline is a refactor the golden tests will protect.

**Standing repo practice:** work on `cline-dev` (not the task branch the EXP-002 checklist names);
commit by pathspec, never stage; the phase-18 docs and `packages/nodegx-export` are the pathspecs.
Fixture is a snapshot — if Puppy test 3 changes on disk, the fixture deliberately does not.
