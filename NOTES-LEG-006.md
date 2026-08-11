# NOTES — LEG-006, the description that is deleted

Branch `leg-006`, based on `80868946`. Worktree only; the primary checkout was read at most.

---

## 1. Status

Built and verified. The premise holds for the **write path** and is **wrong in one place** for the
read path (§4 below). Every acceptance criterion has a spec; all of them run green here, including
the two the brief expected to be unrunnable — see §6 for how, and for the caveat on each.

| Acceptance criterion | State | Where |
|---|---|---|
| Four-step round trip: author → save → reload → save, `created` and `modifiedBy` in the same assertion | ✅ green, run here out-of-band | `packages/noodl-editor/tests/io/component-description-roundtrip.test.ts` |
| No spurious diff — no key gained, no diff on an empty save | ✅ green, runs on every push | `packages/noodl-editor/tests-unit/leg-006/component-description-io.test.ts` |
| `list_components` returns it, truncated at a stated ceiling; tool description says the column exists | ✅ green | `packages/noodl-mcp/tests/componentDescriptions.test.ts` |
| Wire cost measured, pretty-printed, ≥20 components | ✅ measured, §5 | same file, `wire cost` spec |
| The picker shows it; two similarly-named components are distinguishable from the list | ✅ green, run here out-of-band | `packages/noodl-editor/tests/nodepicker/NodePickerSearch.test.ts` (appended describe) |

---

## 2. What changed, and why

### 2a. The write path — **four seams, not the two the spec named**

The spec (§3) says two edits: `buildComponentV2Files` and `ProjectImporter`. That is not enough, and
the reason is the thing worth carrying forward.

The real save chain is:

```
component.json  →  ProjectImporter.reconstructLegacyComponent  →  LegacyComponent
                →  ProjectModel.fromJSON → ComponentModel.fromJSON   (memory)
                →  ComponentModel.toJSON → ProjectModel.toJSON        (projectmodel.ts:662)
                →  buildComponentV2Files  →  component.json
```

`ComponentModel` held `name`, `id`, `graph` and `metadata` **and nothing else**
(`componentmodel.ts:13–47, 384`). So an exporter that writes `component.description` writes a field
the model never held — i.e. nothing — and the two-edit fix passes a one-save spec and fails the
four-step one. Confirmed by measurement, not by reading: with the `ComponentModel.fromJSON` carry
removed and both io halves in place, the round-trip spec goes **3 failed / 7 passed** (§6).

Changed:

1. `packages/noodl-editor/src/editor/src/io/ProjectExporter.ts`
   - `LegacyComponent` gains `description?`, `created?`, `modifiedBy?`.
   - `buildComponentV2Files` carries all three onto `componentFile`, each guarded on
     `typeof === 'string' && length > 0`, so an absent one gains no key (F46) and an empty string is
     treated as absent.
   - The registry `created` now prefers `component.created` and falls back to
     `component.metadata.created` (the old sole source, which nothing writes).
2. `packages/noodl-editor/src/editor/src/io/ProjectImporter.ts` — `reconstructLegacyComponent` reads
   the three back, same guard shape. This is also the seam `ComponentLoader` uses for a
   single-component reload (file-watch / live collab), so it needed its own assertion.
3. `packages/noodl-editor/src/editor/src/models/componentmodel.ts` — the seam the spec missed.
   Fields on the class, carried through `fromJSON`, written conditionally by `toJSON`.

### 2b. `created` and `modifiedBy` (L3) — carried, **not restamped**, and that is a deliberate half-measure

Both are carried. `modifiedBy` is **preserved**, not rewritten: after an editor save an MCP-authored
component still says `modifiedBy: "noodl-mcp"`, which is now stale rather than absent.

The argument for preserving: LEG-006 is "stop deleting authored data". Deciding that the editor
should stamp its own authorship is a *policy*, it would rewrite the field on every MCP-authored
component the first time a human opens the project, and it would produce a diff on that save — the
exact shape of the F46 class this task is also guarding against. It is a one-line change whenever
somebody wants to make that decision; the guard is already there to hang it on.

**Recommend a follow-up row**: "an editor save preserves `modifiedBy: noodl-mcp` — the field is now
carried but no longer true. Decide whether the editor stamps."

### 2c. The MCP half

`packages/noodl-mcp/src/tools/read.ts`:

- `LIST_COMPONENTS_DESCRIPTION_CHARS = 160`, exported, with the measurement that chose it in the
  doc comment.
- `truncateRowDescription()` — cuts at 160 **including** the `…`, so the ceiling is a real bound.
- The ceiling is applied **at the tool seam, not in `ProjectStore.listComponents()`**. Four other
  callers of that method (`validate.ts`, `review.ts`, `pageRegistration.ts`, `nodeIds.ts`) are not
  wire-cost sites and must not be truncated.
- `get_component` returns the description in full — one component is not a budget question.
- The tool description now names the column, states the ceiling numerically, points at
  `get_component` for the full text, and says *"Read the descriptions before rebuilding something the
  project already has"* — which is the behaviour the field exists to produce.

### 2d. The editor surfaces (§5), in the order the spec put them

- **The node picker** (`NodePicker.search.ts`, `NodePickerPreview.tsx`). `PickerItem` gains
  `description`, read off the item's `type` — project component rows *are* `ComponentModel`s, pushed
  into the index verbatim by `createnodeindex.ts:93–110`, and `INodeType` has no such key, so the
  read is unambiguous. On the card the description **replaces the second line**, which for a project
  component read "Project components" — the group heading, repeated. A match *reason* still outranks
  it: "why is this row here" is a question the description does not answer (UIX-013), and that
  precedence is asserted.
  The full sentence lands in the preview pane, where project components previously said
  *"No documentation yet."* — they have no docs page and never will.
- **The Explain panel** (`useCanvasSelection.ts`, `ExplainPanel.tsx`). `CanvasSelection` gains
  `componentDescription`, re-read on the same triggers as the rest of the selection; the panel
  renders it under the scope line. A panel that asks an LLM what a component is for while ignoring
  the sentence written on the component was the gap the spec named.
- **No fourth surface** was invented, per §5.

### 2e. A stale gate that the fix turned red — `writePathConformance.test.ts`

The AWP-002 conformance gate keeps an `ALLOWED_DIFFERENCES` allow-list of fields the editor
round trip is *permitted* to drop, and it asserts **that no entry is dead**. Three entries —
`component.description` (A13), `component.created` (A12) and `component.modifiedBy` — were
descriptions of exactly this defect, filed-not-fixed with the note *"the fix is in ProjectExporter
and this package cannot be the place that changes it"*. LEG-006 is that fix, so the honesty check
went red the moment it landed. That is the gate working.

I removed the three entries and replaced them with a positive assertion
(`carries authored prose and provenance — LEG-006`) covering all three plus the absent-in/absent-out
control. `component.type` (A14, `inferComponentType` relabelling a non-`%rootcomponent` root as
`visual`) is untouched and still real — **not my territory, still open**.

---

## 3. The shape decision: top-level `description`, not `metadata.description`

The orchestrator's mid-task message is correct that `metadata` survives the round trip today and
would need zero io change. I had already committed to the top-level shape, and I would choose it
again. Five reasons, strongest first:

1. **Phase 50's own standing constraint forbids the alternative.** `TASKS.md`:
   *"`metadata` is a bag, and `comment` is the only key this phase may add to it."* Putting
   `description` in `metadata` is the one thing the phase told itself not to do.
2. **The field already exists at top level and already has data in it.** `ComponentV2File` declares
   `description`, `created` and `modifiedBy` (`schemas/index.ts:102–122`), `component.schema.json`
   declares all three, `assembleCreateFiles` writes them there (`noodl-mcp/tools/author.ts:150–161`),
   and **72 real descriptions across the 35 projects in `NodeGX test projects/` are on disk in that
   position today**. `metadata.description` would be a second home for a populated field: either a
   migration, or two shapes read forever.
3. **Every MCP reader already reads it there.** `ProjectStore.listComponents()` (`:358`) and
   `get_component` (`read.ts:144`) both read `c.description`. Moving the write to `metadata` would
   have silently emptied the column this task exists to fill.
4. **The register row is about the top-level field.** AWP-002's A13 names `component.description`.
   Fixing a different field would have left the allow-list entry alive and the register row true.
5. **`metadata` is untyped.** A `Record<string, unknown>` bag gives no compile-time protection; the
   top-level field is typed on `ComponentV2File`, `LegacyComponent` and `ComponentModel`, and the
   non-vacuity run in §6 shows a missing seam surfacing as a **type error** before it surfaces as a
   failing assertion.

**The aliasing question, answered even though I did not take shape 1.** The component-level bag has
**the same by-reference exposure** as the node-level one, in both directions:

- `ComponentModel.fromJSON` assigns `metadata: json.metadata` by reference (`componentmodel.ts:43`);
- `ComponentModel.toJSON()` returns `metadata: this.metadata` by reference (`:389`), so a caller that
  mutates the returned JSON mutates the live model.

There is also a **third, worse** thing on the component path that is not aliasing at all:
`ProjectModel.duplicateComponent` (`projectmodel.ts:335`) constructs the copy with `{ name, graph, id }`
and **no `metadata` argument**, so a duplicated component loses its entire metadata bag. Whatever
LEG-001 puts in the node-level bag, note that the component-level bag is dropped wholesale by
duplicate today. **Not fixed here — outside LEG-006's territory, reported per the brief.**

---

## 4. ⚠️ The spec's §4 premise is wrong, and it changes what the task was

> "`read.ts:85-101` returns `store.listComponents()` rows verbatim — path, legacyName, type, node
> and connection counts. An agent choosing between fourteen components sees fourteen paths and no
> purpose."

**`listComponents()` has returned `description` since SUB-008** — `ProjectStore.ts:353–374` reads
`component.json` and attaches it, and `ComponentListRow` (`:52`) has declared the field since the
same commit (`6aa8fd6c`). Verified with `git log -L`. So the column was never missing.

What *was* missing, and is what I built:

- **no ceiling** — an agent could write a 2,000-character description and every listing would carry
  it, on a budget AWP-005 spent a session shrinking;
- **no mention in the tool description**, so a model had no reason to expect the column and the
  responses.ts type was the only place it was written down.

The rest of §4 stands, and the deeper point survives intact: the column was empty *in practice*
because the write path deleted the data before any listing could show it. Fixing the read side alone
would have shown an empty column.

---

## 5. Measurements — every number, with its method

### 5a. The corpus (the input to the ceiling decision)

Method: parse every `components/**/component.json` under
`/Users/richardosborne/vscode_projects/NodeGX test projects/` (35 projects), take
`description` where non-empty. Run 2026-08-11.

| | |
|---|---|
| Descriptions found | **72** (across 19 of the 35 projects) |
| Mean length | **98.6 chars** |
| Median | **84 chars** |
| Min / max | **40 / 274 chars** |
| Over a 160 ceiling | **11 of 72 (15%)** |
| Over 100 / 120 / 200 / 240 | 17 / 16 / 6 / 3 |

Extracted verbatim into `packages/noodl-mcp/tests/fixtures/real-descriptions.corpus.json` so the
measurement is reproducible from the repo rather than from a machine-local directory.

**Why 160**: round in the printed unit (characters — a token count is model-specific and cannot be
asserted in a spec), clears the field's own instruction ("one or two sentences"), and leaves 61 of
72 real descriptions whole while bounding the pathological one.

### 5b. Wire cost — pretty-printed, on a 24-component project

Method: build a real v2 project of 24 components on disk (22 described, 2 deliberately not), serve
it through the real MCP server over the real in-memory transport, and take `callRawText()` — which
is `JSON.stringify(payload, null, 2)`, exactly what `jsonResult` puts on the wire
(`tools/util.ts:32`). The two counterfactuals are built from the same rows so the only variable is
the description text. Reproducible: the `wire cost` spec prints this on every run.

**Arm 1 — the first 22 of the real corpus in order** (mean 84 chars, 2 over the ceiling):

| | chars | vs no column |
|---|---:|---|
| no description column | 3,936 | — |
| uncut | 6,339 | +2,403 (+61.1%) |
| **cut at 160 (shipped)** | **6,212** | **+2,276 (+57.8%)** |
| ceiling saves | | 127 chars |

**Arm 2 — the 22 *longest* real descriptions** (mean 164 chars, 11 over the ceiling):

| | chars | vs no column |
|---|---:|---|
| no description column | 3,936 | — |
| uncut | 8,084 | +4,148 (+105.4%) |
| **cut at 160 (shipped)** | **7,518** | **+3,582 (+91.0%)** |
| ceiling saves | | 566 chars |

**Read this honestly, both ways.**

- The column is not cheap: **+57.8%** on a typical 24-component listing, roughly **+95 chars per
  described row**. At ~4 chars/token (an estimate, not a measurement — no tokenizer was run) that is
  about **+570 tokens** per `list_components` call on a 24-component project, and it scales linearly
  with component count.
- The ceiling saves almost nothing on today's corpus (127 chars, 2%). Its job is the *worst* case,
  where it takes 105.4% down to 91.0%. Arm 2 is included precisely so nobody reads arm 1 and
  concludes the ceiling is doing work it is not.
- The trade is still worth it: an agent that reads the column and reuses a component instead of
  rebuilding it saves an entire `get_component` (whole graphs) plus the write. But the number is real
  and it goes in the register whether or not it is comfortable, per the spec.

---

## 6. Verification — what I ran, and the exact commands

Everything below was run **inside the worktree**. No `npm install`, no `test:ci`, no `dev:*`, no
Electron launch.

### Ran green here

| What | Command (from the worktree root) | Result |
|---|---|---|
| MCP — the description column, ceiling, tool text, wire cost | `cd packages/noodl-mcp && npx jest tests/componentDescriptions.test.ts` | 5/5 |
| MCP — the AWP-002 conformance gate, with the allow-list retired | `cd packages/noodl-mcp && npx jest tests/writePathConformance.test.ts` | 10/10 |
| MCP — whole suite minus the four process-spawning files | `cd packages/noodl-mcp && npx jest --testPathIgnorePatterns "/node_modules/" "tests/provision.test.ts" "tests/reaper.test.ts" "tests/backendTools.test.ts" "tests/renderTools.test.ts"` | 265 passed, 9 skipped, 0 failed |
| Editor — the io + saver halves and the F46 property | `cd packages/noodl-editor && npx jest tests-unit/leg-006` | 12/12 |
| Editor — the whole jest gate (`test:main`) | `cd packages/noodl-editor && npx jest` | **115 suites / 1612 tests, 0 failed** |
| Typecheck — editor source | `npx tsc -p packages/noodl-editor --noEmit` | clean |
| Typecheck — editor tests | `npx tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | clean |
| Typecheck — MCP | `npx tsc -p packages/noodl-mcp --noEmit` | 6 errors, **all pre-existing** in `interfaceGate.test.ts` / `stagingDiagnostics.test.ts`, none in files I touched |
| Lint — every changed editor source file | `npx eslint <the 7 files>` | 12 errors, **byte-identical to the HEAD baseline** for the same files (verified by linting the `git show HEAD:` versions). No new lint debt. |

⚠️ On the first full `npx jest` in `packages/noodl-editor`, two suites failed —
`tests-main/relay-auth.test.js` (a websocket-timing `peerDisconnected` assertion) and one other. Two
subsequent full runs were **115/115 green**. Flaky, unrelated to this change, and named here so the
orchestrator is not surprised by it.

### Ran green here **out-of-band** — read the caveat

Two suites live in the Jasmine/Electron renderer suite and cannot run under `test:main`. Rather than
hand them over unverified, I ran each under a **scratchpad-only jest config** (never committed, in
`…/scratchpad/pickercheck/`) that substitutes the runner and nothing else:

| Suite | Substitution | Result |
|---|---|---|
| `tests/io/component-description-roundtrip.test.ts` | `@noodl/platform-node` installed instead of `@noodl/platform-electron`; module aliases mapped from `tsconfig` | **10/10** |
| `tests/nodepicker/NodePickerSearch.test.ts` (13 pre-existing + 6 new) | `@noodl-utils/capability-gating/pickerReason` stubbed to `undefined` — it reaches `ProjectModel` and thence the Electron platform | **19/19** |

**The caveat, plainly**: the platform under test differs from the platform in CI. Neither suite's
subject touches the platform (one is pure io + `ProjectModel.fromJSON`, the other is a pure ranking
function), so I believe the results transfer — but *believe* is the operative word, and the real run
is still the orchestrator's. Both are exported from their barrels and will run in the serial window.

### Non-vacuity — the specs were seen failing before they were seen passing

Each seam was reverted individually and the suite re-run. Restored immediately after; all suites
re-verified green afterwards.

| Seam removed | Round-trip spec | io spec |
|---|---|---|
| Exporter + importer both (i.e. HEAD) | — | **fails to compile**: `Property 'description' does not exist on type 'LegacyComponent'` ×6 |
| Importer half only | **4 failed / 6 passed** | 2 failed / 10 passed |
| `ComponentModel.fromJSON` half only | **3 failed / 7 passed** | 12 passed (correctly — the io spec does not reach the model) |

The middle and bottom rows are the L2 trap made concrete: the file-halves-only spec is green while
the description is still being destroyed on the second save.

### Could not verify here — for the orchestrator's serial window

Both are already exported from their barrels; a spec not in its `index.ts` never runs, and both are.

1. **The Jasmine suite, for real.**
   `npm run dev:stop && npm run test:ci` from the **primary checkout**.
   New/changed specs to look for in the `Jasmine:` line (the only line that counts):
   - `LEG-006 — a component description survives the editor` (4 specs)
   - `LEG-006 — a component without a description gains nothing (F46)` (4 specs)
   - `LEG-006 — the exporter/importer pair on their own` (2 specs)
   - `NodePicker buildResults — component descriptions (LEG-006)` (6 specs)
   Barrel wiring: `tests/io/index.ts` gained **one** line
   (`export * from './component-description-roundtrip.test';`); `tests/nodepicker/index.ts` needed no
   change because the picker specs were appended to a file it already exports.
   ⚠️ **`tests/components/index.ts` was not touched** — no line to reconcile from this task.
2. **Live QA of the two editor surfaces.** Nothing here drove the running editor. Worth ten minutes
   in the next drive:
   - open the node picker in a project with MCP-authored components → the card's second line should
     be the component's sentence, not "Project components", and the preview pane should show the full
     text instead of "No documentation yet.";
   - open the Explain panel on such a component → the sentence should appear under the scope line
     before anything is asked of the model.
3. **The end-to-end loss, re-measured.** The definitive proof is BEN-005's own drive repeated:
   author a component through MCP with a description, open the project in the editor, close it,
   `git diff` the `component.json`. Expected now: `modified` changes and nothing else.

---

## 7. Deviations from the spec

1. **Four seams, not three edits** (§2a). `ComponentModel` was added to the fix. Without it the spec
   as written produces a change that passes a one-save test and fails the four-step one.
2. **§4's premise is wrong** (§4). `list_components` already returned the description; I built the
   ceiling and the tool-description half, not the column.
3. **`modifiedBy` is preserved, not restamped** (§2b) — carried per L3, with the policy question
   left open and named.
4. **`ALLOWED_DIFFERENCES` in `noodl-mcp`'s conformance gate was edited** (§2e). Strictly this is a
   test in another package, but it is a gate that this fix turns red by design and leaving it red
   was not an option.
5. **A second, jest-runnable spec was added** (`tests-unit/leg-006/`) alongside the Jasmine one. Not
   asked for. The reason: the F46 no-spurious-diff property protects every autosave of every project,
   and a property that only runs in a serial Electron window is a property that runs rarely.
6. **A test fixture was added** — `packages/noodl-mcp/tests/fixtures/real-descriptions.corpus.json`,
   72 real descriptions extracted from the 35 test projects, so the wire measurement is reproducible
   from the repo alone.

## 8. Found outside my territory — reported, not fixed

- **`ProjectModel.duplicateComponent` drops the whole `metadata` bag** (`projectmodel.ts:335`) and
  now also drops `description`/`created`/`modifiedBy`. For `created`/`modifiedBy` that is arguably
  right; for `description` it is arguably wrong, and for `metadata` it is a pre-existing loss nobody
  has filed. Relevant to LEG-001.
- **`ComponentModel` aliases its `metadata` bag by reference** in both `fromJSON` and `toJSON`
  (§3) — the component-side twin of the node-side defect LEG-001 just confirmed.
- **`ComponentV2File` has four more fields nothing carries**: `displayName`, `category`, `tags`,
  `dependencies`, `settings`. Same class as A12/A13, same seam, not in this task's scope. Any of them
  could be the next silent deletion.
- **A14 remains open** in `ALLOWED_DIFFERENCES`: `inferComponentType` relabels a root component
  `root` → `visual` on save unless its name contains `%rootcomponent`.

---

## 9. Register entry text — for the orchestrator to fold into the spec file

Replace the Register table in `LEG-006-THE-DESCRIPTION-THAT-IS-DELETED.md` with:

| # | Finding | State |
|---|---|---|
| L1 | `description` is declared in the authoring vocabulary and in `planTools`, and `buildComponentV2Files` wrote six keys that did not include it. **Authorable, then deleted, silently** | ✅ fixed — carried by exporter, importer **and `ComponentModel`** |
| L2 | The importer half is invisible in the obvious spec. Round-trip twice or the fix looks done and is not | ✅ closed — and it was **worse than filed**: the chain is four seams, because `ComponentModel.fromJSON/toJSON` held only `name`/`id`/`graph`/`metadata`. With the model half removed the four-step spec goes 3/10 red while the file-halves spec stays 12/12 green |
| L3 | `created` and `modifiedBy` are dropped by the same save | ✅ both carried. ⚠️ `modifiedBy` is **preserved, not restamped**: an MCP-authored component still reads `noodl-mcp` after an editor save. Stamping is a policy decision, deliberately not made here |
| L4 | Adding a description to every `list_components` row is a token cost. Ceiling stated, delta measured on the wire | ✅ ceiling **160 characters** (corpus of 72 real descriptions: mean 99, median 84, max 274; 11 over). Measured pretty-printed on 24 components: **3,936 → 6,212 chars, +2,276 (+57.8%)**; worst-case corpus **3,936 → 7,518, +91.0%** (uncut would be +105.4%) |
| L5 | ⚠️ **§4's premise was wrong.** `ProjectStore.listComponents()` has returned `description` since SUB-008 (`6aa8fd6c`) and `ComponentListRow` has declared it since the same commit. The column was never absent — it had **no ceiling** and **was not named in the tool description**, and it read empty in practice only because the write path destroyed the data first | ⚠️ corrected |
| L6 | AWP-002's conformance gate held three allow-list entries describing this exact defect (A12 `created`, A13 `description`, and `modifiedBy`), each *"filed not fixed, the fix is in ProjectExporter"*. Its own "no entry is dead" check went red when the fix landed | ✅ entries retired, replaced by a positive assertion. **A14 (`component.type` relabelling) is still live** |
| L7 | `metadata.description` was considered and rejected: phase 50's standing constraint reserves the bag for `comment`, the top-level field is already declared on `ComponentV2File` and already holds 72 real descriptions on disk, and both MCP readers already read it there | 📋 decided |
| L8 | Same class, still open: `displayName`, `category`, `tags`, `dependencies` and `settings` are declared on `ComponentV2File` and carried by nothing. `duplicateComponent` drops the entire component `metadata` bag, and `ComponentModel` aliases that bag by reference in both directions | 📋 filed |
