# Next session — EXP-002, step 5: stores, events, and the logic that is statically knowable

**Where the phase stands (2026-08-27, after two sessions).** EXP-002 steps 1–4 are done and
committed. Step 4 (the visual-node generator + style extraction) landed in the second session:

- **`packages/nodegx-export` now runs the whole pipeline**: `parseProject` (v2 → Graph IR) →
  `planProject` (`src/analyze/plan.ts` — dispositions, wire resolution, queries, repeaters,
  navigation, file identity) → `emitApp` (`src/emit/emitApp.ts` — scaffold + visual generator +
  typed api stubs). Per-component emission is `src/emit/component.ts`; the content-vs-style split
  and parameter→CSS tables are `src/emit/style.ts`; all naming is `src/emit/naming.ts`.
- **The PuppyCard golden matches TARGET-OUTPUT §1 byte-for-byte** (TSX and CSS module, including
  property order, shorthand folding and `.card`/`.body` dedup-suffix stripping). Landing matches
  §2's shape: typed stub + `useState`/`useEffect`, identity-mapped `puppies.map()`, resolved
  `navigate('/thank-you')`, bare uncontrolled `<input>`s, hoisted `<title>`/`<meta>`,
  `.field`/`.label`/`.input` merges.
- **Proof ran end to end**: 45 jest tests green (`../../node_modules/.bin/jest` from the package
  dir), `tsc --noEmit` clean, emitted app `npm install && npm run build` clean, SSR render of
  PuppyCard/Landing/ThankYou verified, and a jsdom client render with a seeded `fetchPuppies`
  put **2 cards in the grid** — the effect→state→map chain works, not just the markup.

**Decisions made in step 4 (the diff-as-design-conversation ledger):**
- **Merging is vocabulary-gated.** Byte-identical style sets merge only when ids share a first or
  last camelCase word (`partitionMergeGroup`): `field*` → `.field`, `*Label` → `.label`. Without
  shared vocabulary each keeps its own class — `sectionHead` styled identically to the field
  wrappers stays `.sectionHead`. Two divergences from the hand-written CSS, both *consistent
  applications of the doc's own merge rule* where the hand-writer didn't merge:
  `puppiesSection`/`formSection` → `.section`, `puppiesHeading`/`contactHeading` → `.heading`.
- **A routed component is a page whatever component.json says** — the editor home page
  (`#__page__/Home`) declares `type: "visual"`.
- **A Page whose sole visual child is a Group collapses** into one div, classed after the Page
  node id (disposition `collapsed`), which is why every page's wrapper is `.page`.
- **Missing box-shadow pieces take catalog port defaults** (offsets 0, blur 5px, spread 2px) —
  the interpreter falls back to the same, so the Thank You card renders identically.
- **Machine ids (UUIDs) never name anything**: label, else style role (`page`, `text`).
- The scaffold tsconfig now includes `"types": ["vite/client"]` (CSS-module imports need it).

**What step 4 deliberately left on the table (all reported in `emitApp().notes`, nothing silent):**
- Signal wires whose target is not a resolvable RouterNavigate (Admin's Condition-gated
  navigations, LogIn/LogOut flows, `onTextChanged` → record-write nodes) — all deferred EXP-003.
- Value wires from logic outputs (Counter → Text in the Bench components) — deferred.
- Unhandled style params are reported per node; unsupported visual types (Circle, Video, …)
  disposition as deferred.

**Next: implementation step 5 — state stores, then events, then routing.** Routing is largely
done (route table, RouterNavigate); the real work is stores and events, which are exactly the
constructs that earn `@nodegx/core` imports (EXP-001 §3–§4 settled the shapes). Concretely:
- Variable/Object/Array nodes → `createStore`-family output; signals crossing component
  boundaries → the EXP-001 event shapes; `@nodegx/core` joins the emitted package.json **only
  when a generated file imports it** (the mechanism in `scaffold.ts` packageJson is ready).
- **Puppy test 3 contains none of these constructs** (that is the zero-core headline). Step 5
  needs fixture material: either extend a copy-fixture with store/event components, or hand-write
  the target for a second small real project first (the EXP-001 target components are the spec).
- `net.noodl.controls.textinput` with a *wired* `text`/`onTextChanged` should then earn
  controlled state — the Admin page is the natural test bed and its wires are already in notes.
- Statically-analysable logic (step 6) borders this: Condition with literal inputs, string
  formatting — keep it out of step 5 unless trivially adjacent.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export` and
`dev-docs/tasks/phase-18-code-export-v2` are the pathspecs), never stage-then-commit-all.
Fixture is a snapshot — if Puppy test 3 changes on disk, the fixture deliberately does not.
ts-morph/Prettier remain uninstalled; template-string emission is Prettier-shaped and the goldens
protect the later AST refactor. The package is still not in root `test:packages` — wiring it in
edits the shared root package.json; do it deliberately, announced.
