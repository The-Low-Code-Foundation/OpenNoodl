# Next session — EXP-002 after the named-stores slice: Collection2, then statically-knowable logic

**Where the phase stands (2026-08-27, after four sessions).** EXP-002 steps 1–5 plus the
named-stores slice are done. This session landed GlobalStore end to end:

- **Fixture**: the Cheer project grew a second page, `Pages/Mood`, authored through its MCP
  server (`~/vscode_projects/NodeGX test projects/exp002-step5-cheer`, snapshot at
  `packages/nodegx-export/tests/fixtures/cheer`): a `net.noodl.GlobalStore` declarer
  (`storeName "mood"`, `initialState {"note":"","theme":"sunny"}`), a textinput writing key
  `note` through the write-through pair (`onTextChanged → Set.value` + `textChanged → Set.set`),
  two single-key Subscribes rendering `note` and `theme` into Texts, and a button copying the
  step-5 Variable `visitorName` into key `theme`. Validated clean, render-reported (Mood shows
  "sunny" from the initial state in the interpreter), registered in the router automatically.
  ⚠️ The Variable2 node id got remapped to `readVisitor-2` on create (project-wide id
  uniqueness) — the fixture uses that id.
- **The target was hand-written first**: `EXP-002-NAMED-STORES-TARGET-OUTPUT.md`. Read it before
  touching the generators. It also **decides Collection2's write idiom on paper** (§5) and
  defers Model2 with reasons (§6). Goldens in `tests/global-store.test.ts` hold the emitter to
  it byte-for-byte (`src/stores/mood.ts`, `src/pages/Mood.tsx`). 80 tests total, ~1.2s, from
  the package dir: `../../node_modules/.bin/jest`.
- **Architecture added** (all in `packages/nodegx-export`):
  - `src/analyze/appState.ts` — `StorePlan` registry beside variables/channels: declarers,
    writers, key set with types (initial-state JSON literal decides required keys' types;
    writer-wire inference types the optional rest; `storeNameOf` defaults absent/empty to
    `'app'` and returns undefined for wired/non-literal names; `initialStateOf` accepts a JSON
    object parameter or JSON text, the runtime's own `coerceState` rule). Subscribe.value joins
    `typeOfSource` so store keys feed variable/payload inference. Export names share the
    variables/channels identifier space with `variables` reserved; interfaces are
    `<Pascal>State`.
  - `src/analyze/plan.ts` — `globalstore-set` HandlerAction (fourth kind), `store-key`
    BindingSource, `net.noodl.GlobalStore.Set` in TRIGGER_PORTS (`set`), a rendered input's
    `textChanged` pulse attaching actions into `changeHandlers` (so the write-through pair is
    one onChange), pass 4b for single-key Subscribe render bindings, dispositions: declarer →
    collapsed into its store module, bound Subscribe → collapsed into the component file.
  - `src/emit/state.ts` — one `src/stores/<exportName>.ts` per non-deferred store.
  - `src/emit/component.ts` — `useStore` hooks (local name = the key), per-store imports,
    `.set({ key: expr })` action code.
- **Proof ran end to end**: re-emitted the extended Cheer into a scratch copy of the step-5 app
  (kept node_modules + the packed core tgz — core src unchanged since 08-07, the old tgz is
  current), `tsc -b` and `vite build` clean, and `drive-mood.mjs` (this session's scratchpad,
  `cheer-app/`) proved: initial render shows the initial state; typing writes through and the
  selector re-renders the echo; the theme key is untouched by note writes; clicking snapshots
  `visitorName.get()` into `theme` and the readout re-renders. The step-5 Home drive still
  passes on the re-emitted app.
- **Deferrals, all with notes** (target §3): `persist` defers the whole store; `merge` /
  `transaction` defer the Set; multi-key and whole-store subscriptions; wired/non-literal
  names/keys; number/boolean-typed keys refuse string writes but still render; unparseable
  initialState defers the declarer only. Recorded divergences: core store notifies on every
  write where the runtime equality-gates (absorbed by React's bail-out; signal chains defer
  anyway); export writes synchronously in the handler vs the runtime's end-of-frame.

**Next: Collection2, then step 6 (statically-knowable logic).** Concretely:

- **Collection2 first — the write idiom is already decided on paper** (NAMED-STORES-TARGET §5):
  `NewModel → CollectionInsert` in one handler compiles to a single `todos.add({...})` when the
  property wires resolve in handler context, `collectionName` is literal, and nothing else
  consumes the NewModel's outputs; item type = union of statically-known inserted property
  sets, optional-keyed; the read side is `For Each.items ← Collection2.items` →
  `useCollection(todos)`. Runtime node names: `Collection2`, `CollectionNew`,
  `CollectionInsert`, `NewModel` (`noodl-runtime/src/nodes/std-library/data/`) — **read their
  sources before assuming semantics** (the standing lesson; e.g. check how NewModel wires into
  an insert and what `add to collection` does on the node itself). Fixture material does not
  exist: extend Cheer again through its MCP server (a small list page — notes list with an add
  button is the natural fit over the existing store) or author fresh. Hand-write the target
  first, as every slice has. Watch the repeater path: step 4's For Each currently requires a
  DbCollection2-fed query — the Collection2-fed repeater is a new branch there.
- **Model2 stays deferred** until after Collection2 (id provenance argument in target §6).
- **Step 6 borders this**: Condition with literal inputs, String Format — the `derived()` row.
  Separate slice; hand-write its target on Cheer or Puppy material first.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`); never commit `packages/nodegx-core/dist`. Fixtures
are snapshots — re-copy from the live project after MCP edits. ts-morph/Prettier remain
uninstalled; the goldens protect the later AST refactor. The package is still not in root
`test:packages`; wiring it in edits the shared root package.json — do it deliberately,
announced. ⚠️ jsdom drive trap: import React only AFTER installing the jsdom globals, or
change events silently never fire. ⚠️ `src/analyze/appState.ts` contains literal NUL bytes
(step 5's payload-map separator, in a comment and two template literals) — grep treats the file
as binary and silently matches nothing; use `grep -a`. The store-map code added this session
uses the visible `\u0000` escape in source instead.
