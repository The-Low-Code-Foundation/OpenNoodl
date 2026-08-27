# Next session — EXP-002 after the collections slice: step 6 (statically-knowable logic), then Model2

**Where the phase stands (2026-08-27, after five sessions).** EXP-002 steps 1–5 plus the
named-stores and collections slices are done. This session landed the named client-side array
end to end:

- **Fixture**: the Cheer project grew a third page, `Pages/Notes`, plus `Components/NoteRow`,
  authored through its MCP server (`~/vscode_projects/NodeGX test projects/exp002-step5-cheer`,
  snapshot at `packages/nodegx-export/tests/fixtures/cheer`): a draft textinput write-through
  to a new Variable `noteDraft`; an Add button firing `NewModel` (`properties "text,mood"`,
  `prop-text ← noteDraftVar.value`, `prop-mood` literal `"sunny"`); `makeNote.id →
  insertNote.modifyId` + `makeNote.done → insertNote.add` (CollectionInsert, `collectionId
  "notes"`); `notesArray.items → notesList.items` (Collection2 "notes" → For Each, template
  `/Components/NoteRow`, **no mapping script** — deliberate, see below). Validated clean,
  render-reported, page registered in the router automatically.
- **The target was hand-written first**: `EXP-002-COLLECTIONS-TARGET-OUTPUT.md`. Read it (and
  NAMED-STORES-TARGET) before touching the generators. Goldens in `tests/collections.test.ts`
  hold the emitter to it byte-for-byte (`src/collections/notes.ts`, `src/pages/Notes.tsx`).
  92 tests total, ~1s, from the package dir: `../../node_modules/.bin/jest`.
- **Architecture added** (all in `packages/nodegx-export`):
  - `src/analyze/appState.ts` — `CollectionPlan` registry (name/exportName/`<Pascal>Item`
    interface/keys/readers/inserters; export names join the shared variables→channels→stores→
    collections identifier space; key types = union of insert sources, conflict ⇒ `unknown`)
    and the **shared `insertChainOf`** analyzer: `NewModel → CollectionInsert` is one chain
    when (a) properties are statically sourced (wire or literal param; absent both ⇒ the key
    is omitted from the object *and the item type*), (b) `collectionId` is literal, (c) the
    NewModel's outputs feed exactly this insert (anything else ⇒ Model2 territory, defers).
    New-map keys use `JSON.stringify([name,key])` — no NUL separators.
  - `src/analyze/plan.ts` — `collection-add` HandlerAction (fifth kind), `literal` ValueExpr
    (sixth kind), `NewModel: 'new'` in TRIGGER_PORTS with the chain compiled at the trigger
    (both nodes' dispositions `collapsed` into the handler element via the new
    `CompiledSink.collapses`), pass-5 branch for `Collection2.items → For Each.items`
    (eligibility: no wired inputs, no other outputs driving anything), and the **repeater
    mapping fix**: no script ⇒ `'template-inputs'`, resolved at emit as the identity mapping
    over the template's props — the runtime's own default (`foreach.tsx` identity-maps
    same-named inputs; step 4's `[]` fallback was silently wrong for MCP-authored graphs).
  - `src/emit/state.ts` — `src/collections/<exportName>.ts` per named array (`collection<T>([])`);
    `tsLiteral`/`propKey` now exported.
  - `src/emit/component.ts` — `useCollection` hooks (local `<exportName>Items`; map locals
    `item`/`index`, all deduped), `.add({ k: expr })` action code, per-collection imports,
    repeater mapping entries filtered to fields the item type carries (per-entry drop with a
    note; query path filters by the stub's columns + `id`).
- **Proof ran end to end**: re-emitted the extended Cheer into this session's scratchpad
  (`cheer-app/`, node_modules kept from the prior session copy, core dependency pinned to the
  local `nodegx-core-0.1.0.tgz` — still current, core src unchanged since 08-07), `tsc -b` and
  `vite build` clean, and `drive-notes.mjs` proved: zero rows initially; draft write-through;
  click appends `{text:"walked the dog", mood:"sunny"}` and the row renders; second add
  preserves order; the input stays uncontrolled. `drive-mood.mjs` and `drive-check.mjs` still
  pass on the re-emitted app.
- **Deferrals, all with notes** (target §3): CollectionNew/Remove/Clear/Filter/Map wholesale;
  wired/non-literal `collectionId`; a Collection2 with wired inputs or other outputs driving
  logic; chains failing (a)/(b)/(c); array/object-typed properties; dynamic mapping scripts.
  Recorded divergences: plain items vs live Models (no ids — mapping restricted to authored
  properties, rows keyed by index, safe because this slice translates appends only);
  unconditional `.add` vs identity-dedup (unreachable on this chain); `key: undefined` written
  vs the runtime's per-key abstain (invisible to readers); copy-on-write vs in-place.

**Next: step 6 — statically-knowable logic (the `derived()` row), then Model2.** Concretely:

- **Step 6 first**: `Condition` with literal inputs and `String Format` compile to `derived()`
  (EXP-001's table). Read the runtime sources before assuming semantics
  (`noodl-runtime/src/nodes/std-library/` — condition/stringformat nodes; the standing lesson:
  this session's repeater-mapping fix came from `foreach.tsx`, not the docs). Hand-write the
  target first on Cheer or Puppy material; extend Cheer via its MCP server if new fixture
  material is needed (bind `mcp__nodegx` by `open_project` on the exp002-step5-cheer dir;
  follow plan → stage → apply; re-copy the snapshot after edits — `diff -rq` then `cp`).
  Decide on paper where a `derived()` lives (a module? inline in the component?) before
  writing any emitter code.
- **Model2 after**: id-provenance analysis. The lone `NewModel.id → modifyId` wire built this
  session is its first, degenerate case (target §5); a literal-id Model2 read and a
  same-handler NewModel id are the next two.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`); never commit `packages/nodegx-core/dist`; untracked
files add+commit in one chain. Fixtures are snapshots — re-copy from the live project after MCP
edits. ts-morph/Prettier remain uninstalled; the goldens protect the later AST refactor. The
package is still not in root `test:packages`; wiring it in edits the shared root package.json —
do it deliberately, announced. ⚠️ jsdom drive trap: import React only AFTER installing the
jsdom globals, or change events silently never fire (drive scripts in this session's scratchpad
`cheer-app/` show the recipe). ⚠️ `src/analyze/appState.ts` contains literal NUL bytes (step
5's payload-map separator) — grep treats the file as binary; use `grep -a`. The Edit tool turns
a typed `\u0000` in its JSON args into a raw byte — write such lines via python bytes or avoid
NUL keys entirely (the collections code uses `JSON.stringify` pair keys for exactly this
reason).
