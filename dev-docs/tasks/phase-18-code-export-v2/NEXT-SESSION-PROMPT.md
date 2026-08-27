# Next session — EXP-002 after step 5: the named stores, then statically-knowable logic

**Where the phase stands (2026-08-27, after three sessions).** EXP-002 steps 1–5 are done. Step 5
(this session) landed stores, events, and the wired text input:

- **New fixture: Cheer** — a real project authored through the MCP server for exactly this
  purpose (`~/vscode_projects/NodeGX test projects/exp002-step5-cheer`, snapshot at
  `packages/nodegx-export/tests/fixtures/cheer`), because Puppy test 3 contains none of these
  constructs. One page: textinput → Variable `visitorName` (write-through), read by a
  GreetingBadge component; button → Event Sender `celebrate` (payload `message` from the
  variable); CheerBanner hosts the Event Receiver whose payload a Set Variable writes into
  `lastCheer`, read back by a Text. Validated clean, render-reported, driven.
- **The target was hand-written first**: `EXP-002-STEP5-TARGET-OUTPUT.md` — read it before
  touching the generators; the goldens in `tests/stores-events.test.ts` hold the emitter to it
  byte-for-byte (5 golden files). 64 tests total, ~1s, from the package dir:
  `../../node_modules/.bin/jest`.
- **The architecture step 5 added** (all in `packages/nodegx-export`):
  - `src/analyze/appState.ts` — project-wide registry: Variables (literal `name`) and channels
    (literal `channelName`), writer/sender provenance, and **type inference over statically-known
    writes** (textinput → string; payload keys follow sender wires; variables follow their
    writers; recursive with cycle guard; untypable writer ⇒ `unknown` ⇒ render bindings defer).
  - `src/analyze/plan.ts` — wire handling is now six targeted passes: sink compilation
    (RouterNavigate / Event Sender / Set Variable → `HandlerAction`), trigger attachment (DOM
    event or receiver `useSignal`, with context validation — `payload.*` only in its receiver,
    `event.target.value` only in its own input's onChange), variable write-through, variable
    render bindings, the step-4 prop/repeater rules, then a nothing-silently-dropped catch-all.
  - `src/emit/state.ts` — `src/stores/variables.ts` (one module for all Variables, mirroring the
    interpreter's single shared record) and `src/events.ts` (typed `channel()` per literal
    channel; payload interface = union of senders' keys).
  - `src/emit/component.ts` — `useValue` hooks (local name = last camel word of the export,
    deduped), `useSignal` blocks, action rendering (`.get()` in handlers vs hook in render — the
    same wire, two translations chosen by sink), `onChange` write-through, `@nodegx/core/react`
    imports.
  - `src/emit/emitApp.ts` — `@nodegx/core@^0.1.0` joins the emitted package.json **only when a
    generated file imports it** (scan-the-output, TARGET-OUTPUT §3).
- **Proof ran end to end**: emitted Cheer app `npm install` (core packed locally from
  `packages/nodegx-core` — rebuild dist first, it predated its last commit) + `tsc -b && vite
  build` clean; a jsdom drive (scripts in the session scratchpad, `drive-check.mjs`) proved the
  behavior chain: typing re-renders the badge through the shared variable; the click emits, the
  receiver fires, the Set Variable lands, the banner shows the payload. ⚠️ jsdom trap: import
  React **after** installing the jsdom globals — imported at top of file, the change-event
  plugin silently never fires (clicks still do), which reads exactly like a broken generator.
- **Scaffold correction**: `tokens.css` was emitting only `customTokens`; every export (Puppy's
  included) had unresolved `var()` references for the 182 shipped defaults. `parseProject` now
  merges defaults (imported from the editor's `DefaultTokens.ts` — read, not restated) with
  overrides, shipped order.

**Deliberately deferred from step 5, all reported in notes** (see STEP5-TARGET §6): Model2 /
Collection2 / GlobalStore; signal chains whose handler owner is not a DOM event or receiver;
payload outputs bound into rendered content; non-literal names; non-global propagation;
non-string `setWith`. Known cosmetic divergence recorded there too (unset variable → interpreter
shows the Text default, export renders empty).

**Next: the named stores — GlobalStore, Model2, Collection2 — then step 6 (statically-knowable
logic).** Concretely:

- **GlobalStore first.** EXP-001 §3 *is* its hand-written target (`store(name, initial)` +
  `useStore` selector + `.set` in handlers), the node family exists in this runtime
  (`net.noodl.GlobalStore`, `.Set`, `.Subscribe` — `packages/noodl-editor/...` search the viewer
  for their sources and read them before assuming semantics). Fixture material does not exist:
  extend the Cheer project through its MCP server (a second page or component is fine) or author
  another small one. Hand-write the target first, as every step has.
- **Collection2 → `collection()`** needs the write idiom (NewModel → CollectionInsert chain) to
  be worth anything — a read-only client array renders an empty list forever. That chain is one
  deterministic shape (compile the pair into one `todos.add({...})` action); decide it on paper
  in the target doc before coding.
- **Model2** is the hardest of the three (parameter-dependent `prop-*` ports, id-addressed
  instances) — fine to defer again, but say so in the notes and the doc.
- Step 6 borders this: Condition with literal inputs, String Format — the `derived()` row.
  Separate slice.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2` — this session also touched
`packages/nodegx-core/dist` only via rebuild, don't commit dist). Fixtures are snapshots — the
live Cheer project and the fixture diverge deliberately if either changes. ts-morph/Prettier
remain uninstalled; template-string emission is Prettier-shaped and the goldens protect the
later AST refactor. The package is still not in root `test:packages`; wiring it in edits the
shared root package.json — do it deliberately, announced.
