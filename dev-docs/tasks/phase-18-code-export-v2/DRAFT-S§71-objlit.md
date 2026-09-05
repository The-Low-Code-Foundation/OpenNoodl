## §71 An `Object` node's OWN typed-in `prop-<key>` values are the runtime's per-mount write — §68.5's third row, built (session 94, lane objlit, 2026-09-05)

**Picker 117/127 unchanged** — `Model2` has been a translated node since Tier 1.1 (§47 for the explicit form); this closes a
**divergence inside a translated node**, the fourth of the §60.5/§67.5/§68.5 family and the only one that was SILENT: §69's refusal
dropped a chain, §68's dropped a key with no note — this one dropped the values with no note, no refusal and a green report.

### §71.0 What the runtime does, measured before a line of code

`$SCRATCH/runtime.log` (a ten-row runtime spec, `runtime-probe.test.ts`, run once in `noodl-runtime`'s own harness and moved out of the
repo): `nodescope.ts:203-211` registers and queues every authored parameter at node creation; `modelnode2.ts:461-470`
`registerInputIfNeeded` registers ANY `prop-*` input on demand (a typed-in parameter has an input to land in — not an "obsolete
parameter"); `userInputSetter` (479-490) marks the key dirty and `scheduleStore` (307-332) writes `model.set(key, value)` in the same
pass once a model is bound. So an Object `board` with `prop-headline: 'Welcome'` typed in writes `{ headline: 'Welcome' }` into
`Model.get('board')` **on every creation of the node — every mount of its component** (Q2: a second creation rewrote a value a Set had
changed in between), in either parameter order (Q1/Q1b), for numbers and booleans as themselves (Q1c), for a key the Properties list does
NOT name (Q1d — the Object never consults its list on the write path, unlike §68's Set) and with no list at all (Q1e); a Set Object
Properties' Do lands over it afterwards (Q2b); a wired Id holds the value and writes it when the Id arrives (Q3 — refused by §47 anyway).

**Who can author it.** The port is `type: { name: '*', allowConnectionsOnly: true }` (modelnode2.ts:503-506) — the editor's property
panel HIDES it (`Ports.ts:1075-1081`), so a person cannot type it in; the MCP (the agent authoring path) ACCEPTS it: the catalog holds only
static ports, `Model2` is `runtime-discovered`, so `checkParameterValues` files the parameter under `dynamicSkips` — one
`dynamic-port-skipped` notice, severity **info** (parameterValues.ts:947-979, 1197-1220), which `noodl-mcp/validate.ts` never blocks on.
The `connection-only-parameter` ERROR ("this value is discarded and the node renders as if it were never set") cannot fire for a dynamic
port — and its sentence is false for this node: the runtime writes the value. Registered §71.5.

**Measured first, the export side** (`$SCRATCH/probe-reverted.log`, profile-desk with `prop-motto: 'Hello'` typed into the Object):
no note, no refusal, no `useEffect`, `motto?: unknown`, `String(motto ?? '')` — the literal vanished with a green report. **The corpus**
(`corpus.log`, a walk over all 432 fixture json files): 3 `Model2` nodes, **0** with a `prop-*` parameter, 0 under a wire.

### §71.1 What is emitted

`appState.ts`: one exported `objectSeedsOf(node, wiredPorts)` — the typed-in `prop-<key>` primitives with nothing wired over the same
port, in **parameter order** (the order the runtime queues them and writes `dirtyValues` in; `parseProject` keeps `Object.entries`
order) — used by BOTH files so the interface and the patch cannot disagree. Discovery pushes the Object as a **writer** carrying
`seeds` (a new optional field on `VariableWriter`) and registers each literal as a `SourceRef` under `storeKeySources`, so **the literal
types the key** — `'Welcome'` ⇒ `headline?: string`, `2` ⇒ `priority?: unknown` — and earns it (no list needed, as the runtime).
`plan.ts`: `ObjectSeedPlan { nodeId, storeName, entries, comment }` on `ComponentPlan.objectSeeds`, filled in the Model2 pre-pass right
after the node collapses into its module (so every §47 gate — a wired prop input, a wired Fetch, a consumed signal, a wired or blank Id,
the collision — stands in front, sentences unchanged); `objectSeedAction(seed)` is the `object-set` action it prints, `then: []`. A
value that is not a string, number or boolean literal is named in a note (*its authored "x" property value is not a string, number or
boolean literal — not written into "board" at mount*) while the node's reads still translate. `component.ts`: the seeds join
`allActions` (the module import is earned by the write alone), `useEffect` is imported for a seed alone, and the effect prints with
§67's variable seeds, before the §60 mirrors. `state.ts`: the provenance line.

```tsx
  // Board object — its authored property values are stored on every mount of this component (modelnode2.ts: each prop-* setter runs at node creation and schedules a store).
  useEffect(() => {
    board.set({ headline: 'Welcome', priority: 2 });
  }, []);
```
```ts
 * Seeded with { headline: 'Welcome', priority: 2 } by "Board object" (Model2 `board` on /Pages/Home) on every mount of its component.
```

### §71.2 The fixture — `tests/fixtures/notice-desk`, NEW (profile-desk untouched)

profile-desk's shape, smaller: a page with an Object `board` (`prop-headline: 'Welcome'`, `prop-priority: 2` typed in, nothing wired
over them), a Set Object Properties writing `headline` from an input on a button, three Texts reading `headline`/`priority`/`footer`, and
a `NoticeBadge` component whose own Object seeds `footer` — two effects in two files, one module. A new fixture rather than a
re-authoring because typing a value into profile-desk's Object would move §47's writer-less-key rows (A3, B4), the golden module and D4;
**profile-desk's emit is byte-identical to session 93's `post69.json`** (`snap.ts`, `cmp` equal) — no pin moved anywhere.

### §71.3 Gates and arms

Spec `tests/object-store.test.ts`, **63 rows** (+12, §G): G1 the fixture whole (the effect text exactly, once, after the state hooks and
before the render, the imports, the module's types and seed line, the reads — bare and `String()` — the Set's write untouched, nothing
refused, the plan row, **the app typechecks**); G2 the literal types the key (a boolean ⇒ `unknown`, a string on the number key ⇒
`string` and the read binds bare, both typecheck); G3 **parameter order, not list order**; G4 a wire into the same port ⇒ §47's sentence
unchanged, no effect, the literal does NOT type the key (`headline?: unknown`, the badge's read through `String()`) beside the presence
control (wire gone ⇒ `string`); G5 an unlisted key is written and earned, no note, typechecks; G6 an `expression` and a `json` value ⇒ the
note, not written, the node still collapsed and its reads translating, the other key still seeded; G7 the control — literals gone ⇒ no
effect, no `useEffect` import, no seed line, `priority`/`footer` fall to `unknown`; G8 two components ⇒ two effects, writer lines in
component order; G9 a component that only seeds still imports the module; G10 the §47 refusals stand with the literals typed in; G11
profile-desk carries no effect and the corpus no other carrier; G12 deterministic, the ledger row names the write. Pkg tsc 0. Ledger
`OK — 176 types, 124 translated`; picker 117/127. **13 arms, 13 killed** (`mut.py`, md5-restored, every arm compiled — 63 total on
each): the helper blind to the parameter (8 rows), the source registered as a string (3), the writer without its seeds (3), the key never
ensured (G5 — TS2353 in the built app), registered under a wire (G4), the pass never plans (7), the note dropped (G6), key order instead
of parameter order (G3 G5), the action printing strings (5), the effect never printed (7), `useEffect` not imported (4), the import sweep
forgetting the seeds (G9), the seed line demoted (3). Whole package: **79 files (79 on disk, no new spec file), 2958/2958, exit 0** — run once at load 5.17 after a 6½-minute wait; no pin outside this spec moved (profile-desk byte-identical).

### §71.4 What building it found

1. 🔴 **A silent divergence has no sentence to grep.** §68 and §69 each left a note or a refusal a probe could read; this one left
   nothing — a green report, a typed key, a value gone. Only typing the value in and asserting the effect sees it (G1 vs the reverted
   probe). The four-sibling family's last member was the quietest.
2. 🔴 **The editor's own diagnostic would tell an agent the opposite of the truth.** `connection-only-parameter` says the value "is
   discarded and the node renders as if it were never set"; for `Model2`'s `prop-*` the runtime writes it. The rule cannot reach these
   ports today (dynamic), so nobody has read the false sentence yet — registered §71.5.
3. ⚠️ **A refused node's other literal still types the key and still prints "Seeded with"** — discovery is blind to the plan's refusal,
   §47's convention for a refused Set's "Written by" line and §69.5's for a refused Set Variable. G4 pins it as it is. Registered §71.5.
4. ⚠️ **The typing rule and the write rule live in two files — for the fourth time — and a shared helper does not make them one arm.**
   `objectSeedsOf` is one function, but M2/M3/M4/M5 (discovery) and M6–M9 (plan) are different kills; a spec that only reads the handler
   text sees half of them, exactly as §68.4 #1 and §69.4 #2 said.
5. ⚠️ **Parameter order is the write order here, not list order.** §68 transcribed the Set's `_pushInputValues` (the list); the Object
   writes `dirtyValues` in insertion order (the queued parameter order). G3 pins the difference; on the page it is invisible (one patch).

### §71.5 What this leaves (owner NONE unless named)

- **A literal under a wire on the same port** — refused whole by §47's sentence; the runtime shows the literal until the wire's source
  first delivers. The same residual as §67.5 #1 / §68.5 #1 / §69.5 #1, one construct over. Owner NONE.
- **The `connection-only-parameter` sentence is false for `Model2`'s `prop-*`** (and for any node whose `registerInputIfNeeded` accepts a
  parameter on a connection-only port): "discarded" ≠ written at creation. Today unreachable (dynamic ports are `dynamicSkips`); the day
  the validator learns dynamic ports it will tell agents to delete a working value. Owner NONE (editor validation, not EXP-011).
- **A provenance line for a refused node** ("Seeded with … on every mount" while the export prints no effect) — the §47 convention
  ("Written by" for a refused Set) extended, not changed. Owner NONE.
- **`''` and `null` literals** — the runtime writes both (Q5); `''` is a string literal and IS seeded; `null` is not a `ParamValue`
  literal the parser carries. Owner NONE.
- **The editor cannot author this shape at all** (the panel hides connection-only ports); an author who wants a default on an Object
  today reaches for a Set on a mount pulse. Not a divergence — a product surface question. Owner NONE.
- StrictMode's dev double-mount writes the seed twice (idempotent); `vite preview` is production. Owner NONE (§67.5's row).
- §67.5 #2 (a no-source variable typed `string`) — lane vartype's row this session.

### §71.6 The drive — prepared, NOT run (session 94, lane objlit)

`$SCRATCH/EXPECTED-DRIVE.md` FIRST (five steps + two controls), `build.sh` (emit → `notice-desk-out`, node_modules from s93's
`profile-desk-out`, `tsc -b && vite build`) then `drive.sh` (`vite preview` 4371, Chrome headless CDP 9372). **P1 boot** predicted
`["Notice Desk","Welcome","2","Posted by the desk","Welcome"]`, errs `[]` — the two mount effects wrote the record where the pre-change
export reads `["Notice Desk","","","",""]`; **P3 Post** ⇒ `Sale` in both headline Texts, priority and footer untouched (the Do lands over
the seed, runtime Q2b); **P4 reload** ⇒ P1 again (nothing persists; the mount effect re-runs — the per-mount rewrite); **C1** the reverted
source emits no `useEffect`, `headline?: string` from the Set's wire alone, no `Seeded with`, refusals 0 — the silence.
